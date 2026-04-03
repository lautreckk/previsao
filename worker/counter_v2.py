#!/usr/bin/env python3
"""
Vehicle Counter Worker v2 — Annotated Stream Pipeline

Reads HLS → YOLO detection → draws boxes/count on frames → pipes to MediaMTX via FFmpeg
Browser receives annotated video via WebRTC (sub-1s latency, zero sync issues)
Count also persisted to Supabase for betting/round resolution.
"""

import argparse
import time
import cv2
import requests
import subprocess as sp
from threading import Thread
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

VEHICLE_CLASSES = {2, 5, 7}  # car, bus, truck

GREEN = (0, 255, 0)
RED = (0, 0, 255)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
YELLOW = (0, 255, 255)
CYAN = (255, 255, 0)


def get_stream_url(url, stream_type):
    if stream_type == "youtube":
        import yt_dlp
        with yt_dlp.YoutubeDL({"format": "best[height<=480]", "quiet": True}) as ydl:
            return ydl.extract_info(url, download=False)["url"]
    return url


def draw_annotations(frame, tracks, counted_ids, line_y, total_count, roi_x_start, roi_x_end, just_counted_ids=None, recently_counted=None):
    h, w = frame.shape[:2]
    out = frame.copy()
    x_start = int(w * roi_x_start)
    x_end = int(w * roi_x_end)

    # Counting line (dashed green, thicker)
    for x in range(x_start, x_end, 20):
        cv2.line(out, (x, line_y), (min(x + 10, x_end), line_y), GREEN, 3)

    cv2.putText(out, "ZONA DE CONTAGEM", (x_start + 5, line_y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, GREEN, 1)

    # Bounding boxes — show approaching + recently counted vehicles
    for track in tracks:
        if not track.is_confirmed():
            continue
        tid = track.track_id
        ltrb = track.to_ltrb()
        x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
        front_y = y2
        dist = front_y - line_y
        is_counted = tid in counted_ids
        just_now = just_counted_ids and tid in just_counted_ids
        recent = recently_counted and tid in recently_counted

        # Show box when: approaching (150px above line) OR recently counted (lingers ~2s)
        approaching = -150 < dist < 30
        if not approaching and not just_now and not recent:
            continue

        if just_now:
            # Just crossed — bright green flash
            cv2.rectangle(out, (x1, y1), (x2, y2), GREEN, 3)
            cv2.putText(out, "+1", (x1 + 2, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, GREEN, 2)
        elif recent:
            # Recently counted (within 2s) — fading green
            cv2.rectangle(out, (x1, y1), (x2, y2), GREEN, 2)
        elif not is_counted:
            # Approaching — red box, thicker
            cv2.rectangle(out, (x1, y1), (x2, y2), RED, 2)
            # Small dot at front
            cv2.circle(out, ((x1+x2)//2, front_y), 4, YELLOW, -1)

    # Count display (larger, more visible)
    txt = f"Veiculos: {total_count}"
    (tw, th_t), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 2)
    cv2.rectangle(out, (5, 5), (tw + 20, th_t + 20), BLACK, -1)
    cv2.rectangle(out, (5, 5), (tw + 20, th_t + 20), GREEN, 2)
    cv2.putText(out, txt, (10, th_t + 12), cv2.FONT_HERSHEY_SIMPLEX, 1.0, GREEN, 2)
    return out


def start_ffmpeg_pipe(rtsp_url, width, height, fps=24):
    """Start FFmpeg subprocess that pipes raw frames to MediaMTX via RTSP."""
    cmd = [
        'ffmpeg', '-y',
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}',
        '-r', str(fps),
        '-i', '-',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-vsync', 'cfr',          # constant frame rate — prevents stutter
        '-r', str(fps),
        '-g', str(fps * 2),       # keyframe every 2s
        '-bf', '0',               # no B-frames for lower latency
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        rtsp_url,
    ]
    print(f"[Worker] FFmpeg pipe → {rtsp_url} (cfr {fps}fps)")
    return sp.Popen(cmd, stdin=sp.PIPE, stderr=sp.DEVNULL)


def broadcast_detections(supa_url, supa_key, market_id, boxes, count):
    """Send detection boxes to frontend via Supabase broadcast."""
    try:
        requests.post(
            f"{supa_url}/realtime/v1/api/broadcast",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}", "Content-Type": "application/json"},
            json={"channel": f"cars-stream-{market_id}", "event": "detections", "payload": {"boxes": boxes, "count": count}},
            timeout=2,
        )
    except:
        pass


def persist_count_to_db(supa_url, supa_key, market_id, count):
    """Save count to DB for betting/round resolution."""
    try:
        r = requests.patch(
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}",
            headers={
                "apikey": supa_key,
                "Authorization": f"Bearer {supa_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={"current_count": count, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            timeout=5,
        )
        if r.status_code >= 400:
            print(f"[Worker] DB persist failed: {r.status_code}")
    except Exception as e:
        print(f"[Worker] DB persist error: {e}")


_last_known = {}

def get_current_round(supa_url, supa_key, market_id):
    """Fetch current round from Supabase. Returns cached on failure."""
    try:
        r = requests.get(
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}&select=round_number,phase,current_count,stream_url,camera_id",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}"},
            timeout=8,
        )
        data = r.json()
        if data and len(data) > 0:
            d = data[0]
            result = (d.get("round_number", 0), d.get("phase", "waiting"), d.get("current_count", 0),
                      d.get("stream_url", ""), d.get("camera_id", ""))
            _last_known[market_id] = result
            return result
    except Exception as e:
        print(f"[Worker] DB poll failed (cached): {e}")
    return _last_known.get(market_id, (0, "waiting", 0, "", ""))


def main():
    p = argparse.ArgumentParser(description="Vehicle Counter Worker v2")
    p.add_argument("--market-id", required=True)
    p.add_argument("--stream-url", required=True)
    p.add_argument("--stream-type", default="hls", choices=["youtube", "hls", "rtsp"])
    p.add_argument("--api-url", required=True)
    p.add_argument("--secret", required=True)
    p.add_argument("--supabase-url", default="")
    p.add_argument("--supabase-key", default="")
    p.add_argument("--mediamtx-url", default="rtsp://localhost:8554")
    p.add_argument("--confidence", type=float, default=0.30)
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--roi-x-start", type=float, default=0.0)
    p.add_argument("--roi-x-end", type=float, default=1.0)
    p.add_argument("--line-y", type=float, default=0.55)
    p.add_argument("--tolerance", type=int, default=35)
    args = p.parse_args()

    print(f"[Worker v2] Market: {args.market_id}")
    print(f"[Worker v2] Stream: {args.stream_url} ({args.stream_type})")
    print(f"[Worker v2] MediaMTX: {args.mediamtx_url}/{args.market_id}")

    # Sync round state from DB (includes camera info for rotation)
    current_round, phase, db_count, db_stream_url, db_camera_id = get_current_round(args.supabase_url, args.supabase_key, args.market_id)
    # Use DB stream_url if available (camera rotation), otherwise use CLI arg
    active_stream_url = db_stream_url if db_stream_url else args.stream_url
    active_camera_id = db_camera_id or "unknown"
    print(f"[Worker v2] Synced: round={current_round} phase={phase} count={db_count} camera={active_camera_id}")

    # Open input stream
    resolved = get_stream_url(active_stream_url, args.stream_type)
    cap = cv2.VideoCapture(resolved)
    if not cap.isOpened():
        print("[Worker v2] ERROR: Cannot open stream!")
        return

    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    # Downscale to 640px wide for faster processing + encoding
    scale = min(640 / orig_w, 1.0)
    w = int(orig_w * scale)
    h = int(orig_h * scale)
    print(f"[Worker v2] Stream opened: {orig_w}x{orig_h} → {w}x{h}")

    # Load YOLO
    model = YOLO(args.model)
    tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)

    # Start FFmpeg pipe to MediaMTX
    rtsp_out = f"{args.mediamtx_url}/{args.market_id}"
    ffmpeg = start_ffmpeg_pipe(rtsp_out, w, h, fps=24)

    # State
    fc = 0
    total = db_count if phase in ("betting", "observation") else 0
    last_db_count = total
    if total != db_count:
        print(f"[Worker v2] Starting fresh at 0 (phase={phase})")
    recently_counted = {}  # tid → timestamp when counted (for lingering green boxes)
    counted = set()
    last_tracks = []  # Cache tracks for drawing on non-YOLO frames
    t_log = t_round_check = t_db = time.time()
    line_y_px = int(h * args.line_y)
    roi_x_start_px = int(w * args.roi_x_start)
    roi_x_end_px = int(w * args.roi_x_end)
    known_round = current_round
    known_phase = phase
    counting_paused = phase == "waiting"

    # Frame pacing — output at steady 24 FPS regardless of input timing
    TARGET_FPS = 24
    frame_interval = 1.0 / TARGET_FPS
    next_frame_time = time.monotonic()

    print(f"[Worker v2] Running. count={total} round={known_round} target={TARGET_FPS}fps")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[Worker v2] Reconnecting in 5s...")
            cap.release()
            time.sleep(5)
            try:
                resolved = get_stream_url(args.stream_url, args.stream_type)
                cap = cv2.VideoCapture(resolved)
                w2 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h2 = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                if w2 != w or h2 != h:
                    w, h = w2, h2
                    line_y_px = int(h * args.line_y)
                    roi_x_start_px = int(w * args.roi_x_start)
                    roi_x_end_px = int(w * args.roi_x_end)
                    ffmpeg.stdin.close()
                    ffmpeg.wait()
                    ffmpeg = start_ffmpeg_pipe(rtsp_out, w, h, fps=24)
            except:
                pass
            continue

        # Downscale for faster processing
        if scale < 1.0:
            frame = cv2.resize(frame, (w, h))

        fc += 1
        run_yolo = (fc % 2 == 0)

        # Night detection — lower confidence threshold when frame is dark
        if fc % 120 == 1:  # Check every ~5s
            brightness = cv2.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))[0]
            is_night = brightness < 80
            conf = max(0.18, args.confidence - 0.10) if is_night else args.confidence
        else:
            conf = getattr(args, '_active_conf', args.confidence)
        args._active_conf = conf

        if run_yolo:
            results = model(frame, conf=conf, verbose=False)
            dets = []
            for r in results:
                for box in r.boxes:
                    cid = int(box.cls[0])
                    if cid in VEHICLE_CLASSES:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        dets.append(([x1, y1, x2 - x1, y2 - y1], float(box.conf[0]), cid))
            tracks = tracker.update_tracks(dets, frame=frame)
            last_tracks = tracks
        else:
            tracks = last_tracks

        now = time.time()

        # Check round/phase changes + camera rotation
        if args.supabase_url and now - t_round_check >= 5:
            new_round, new_phase, _, new_stream_url, new_camera_id = get_current_round(args.supabase_url, args.supabase_key, args.market_id)

            if new_phase == "waiting":
                if not counting_paused:
                    print(f"[Worker v2] Phase -> waiting. Pausing.")
                    counting_paused = True
            else:
                counting_paused = False

            is_new_round = (new_round != known_round) and new_round > 0 and new_round > known_round
            is_start = (known_phase == "waiting" and new_phase == "betting") and new_round > 0

            if is_new_round or is_start:
                print(f"[Worker v2] RESET: round {known_round}->{new_round}")
                total = 0
                counted.clear()
                recently_counted.clear()
                last_db_count = -1
                tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)
                persist_count_to_db(args.supabase_url, args.supabase_key, args.market_id, 0)
                counting_paused = False

                # Camera rotation — switch to new stream if changed
                if new_stream_url and new_stream_url != active_stream_url:
                    print(f"[Worker v2] CAMERA SWITCH: {active_camera_id} -> {new_camera_id}")
                    active_stream_url = new_stream_url
                    active_camera_id = new_camera_id
                    cap.release()
                    resolved = get_stream_url(active_stream_url, args.stream_type)
                    cap = cv2.VideoCapture(resolved)
                    if cap.isOpened():
                        new_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        new_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        new_scale = min(640 / new_w, 1.0)
                        w, h = int(new_w * new_scale), int(new_h * new_scale)
                        scale = new_scale
                        line_y_px = int(h * args.line_y)
                        roi_x_start_px = int(w * args.roi_x_start)
                        roi_x_end_px = int(w * args.roi_x_end)
                        # Restart FFmpeg for new resolution
                        try:
                            ffmpeg.stdin.close()
                            ffmpeg.wait(timeout=3)
                        except:
                            pass
                        ffmpeg = start_ffmpeg_pipe(rtsp_out, w, h, fps=24)
                        print(f"[Worker v2] New camera opened: {new_w}x{new_h} -> {w}x{h}")
                    else:
                        print(f"[Worker v2] ERROR: Cannot open new camera {new_camera_id}")

            known_round = new_round
            known_phase = new_phase
            t_round_check = now

        # Count vehicles — trigger when FRONT of vehicle touches the line
        just_counted = set()
        if run_yolo and not counting_paused:
            for t in tracks:
                if not t.is_confirmed():
                    continue
                tid = t.track_id
                bb = t.to_ltrb()
                cx = (bb[0] + bb[2]) / 2
                front_y = bb[3]  # bottom of box = front of vehicle
                in_roi = roi_x_start_px <= cx <= roi_x_end_px
                dist_to_line = front_y - line_y_px
                # Count when front touches or just passed the line
                touching = -5 < dist_to_line < 25
                if tid not in counted and in_roi and touching:
                    counted.add(tid)
                    total += 1
                    just_counted.add(tid)
                    recently_counted[tid] = now

        # Clean old recently_counted (older than 2 seconds)
        recently_counted = {tid: t for tid, t in recently_counted.items() if now - t < 2.0}

        # Persist count to DB on change
        if total != last_db_count and args.supabase_url:
            last_db_count = total
            Thread(target=persist_count_to_db, args=(args.supabase_url, args.supabase_key, args.market_id, total), daemon=True).start()

        # Draw annotations — boxes linger for 2s after counting
        annotated = draw_annotations(frame, tracks, counted, line_y_px, total,
                                     args.roi_x_start, args.roi_x_end,
                                     just_counted_ids=just_counted if just_counted else None,
                                     recently_counted=recently_counted if recently_counted else None)

        # Frame pacing — wait until it's time to send the next frame
        # This prevents burst sending when HLS segments arrive in chunks
        now_mono = time.monotonic()
        sleep_time = next_frame_time - now_mono
        if sleep_time > 0:
            time.sleep(sleep_time)
        next_frame_time = max(time.monotonic(), next_frame_time + frame_interval)

        try:
            ffmpeg.stdin.write(annotated.tobytes())
        except:
            print("[Worker v2] FFmpeg pipe broken, restarting...")
            ffmpeg = start_ffmpeg_pipe(rtsp_out, w, h, fps=24)
            next_frame_time = time.monotonic()

        # Log
        if time.time() - t_log >= 5:
            print(f"[Worker v2] #{fc} | Round {known_round} | Veiculos: {total} | Rastreados: {len(counted)}")
            t_log = time.time()

    cap.release()
    ffmpeg.stdin.close()
    ffmpeg.wait()


if __name__ == "__main__":
    main()
