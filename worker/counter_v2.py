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


def draw_annotations(frame, tracks, counted_ids, line_y, total_count, roi_x_start, roi_x_end):
    h, w = frame.shape[:2]
    out = frame.copy()
    x_start = int(w * roi_x_start)
    x_end = int(w * roi_x_end)

    # Counting line
    for x in range(x_start, x_end, 20):
        cv2.line(out, (x, line_y), (min(x + 10, x_end), line_y), GREEN, 2)

    cv2.putText(out, "ZONA DE CONTAGEM", (x_start + 5, line_y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, GREEN, 1)

    # Bounding boxes — show when approaching or counted
    for track in tracks:
        if not track.is_confirmed():
            continue
        tid = track.track_id
        ltrb = track.to_ltrb()
        x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
        cy = (y1 + y2) // 2
        dist = cy - line_y
        is_counted = tid in counted_ids
        approaching = -80 < dist < 20
        if not approaching and not is_counted:
            continue
        color = GREEN if is_counted else RED
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

    # Count display
    txt = f"Veiculos: {total_count}"
    (tw, th_t), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), BLACK, -1)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), GREEN, 1)
    cv2.putText(out, txt, (10, th_t + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, GREEN, 2)
    return out


def start_ffmpeg_pipe(rtsp_url, width, height, fps=24):
    """Start FFmpeg subprocess that pipes raw frames to MediaMTX via RTSP."""
    cmd = [
        'ffmpeg', '-y',
        '-use_wallclock_as_timestamps', '1',
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}',
        '-i', '-',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-r', str(fps),
        '-g', str(fps),
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        rtsp_url,
    ]
    print(f"[Worker] FFmpeg pipe → {rtsp_url}")
    return sp.Popen(cmd, stdin=sp.PIPE, stderr=sp.DEVNULL)


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
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}&select=round_number,phase,current_count",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}"},
            timeout=8,
        )
        data = r.json()
        if data and len(data) > 0:
            result = (data[0].get("round_number", 0), data[0].get("phase", "waiting"), data[0].get("current_count", 0))
            _last_known[market_id] = result
            return result
    except Exception as e:
        print(f"[Worker] DB poll failed (cached): {e}")
    return _last_known.get(market_id, (0, "waiting", 0))


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

    # Sync round state from DB
    current_round, phase, db_count = get_current_round(args.supabase_url, args.supabase_key, args.market_id)
    print(f"[Worker v2] Synced: round={current_round} phase={phase} count={db_count}")

    # Open input stream
    resolved = get_stream_url(args.stream_url, args.stream_type)
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
    total = db_count
    last_db_count = total
    counted = set()
    last_tracks = []  # Cache tracks for drawing on non-YOLO frames
    t_log = t_round_check = t_db = time.time()
    line_y_px = int(h * args.line_y)
    roi_x_start_px = int(w * args.roi_x_start)
    roi_x_end_px = int(w * args.roi_x_end)
    known_round = current_round
    known_phase = phase
    counting_paused = phase == "waiting"

    print(f"[Worker v2] Running. count={total} round={known_round}")

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
        run_yolo = True  # Run YOLO on every frame for 1-by-1 counting

        if run_yolo:
            results = model(frame, conf=args.confidence, verbose=False)
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

        # Check round/phase changes
        if args.supabase_url and now - t_round_check >= 5:
            new_round, new_phase, _ = get_current_round(args.supabase_url, args.supabase_key, args.market_id)

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
                last_db_count = -1
                tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)
                persist_count_to_db(args.supabase_url, args.supabase_key, args.market_id, 0)
                counting_paused = False

            known_round = new_round
            known_phase = new_phase
            t_round_check = now

        # Count vehicles APPROACHING the line (count earlier for snappier feel)
        # Asymmetric zone: detect 80px BEFORE line, 20px AFTER
        if run_yolo and not counting_paused:
            for t in tracks:
                if not t.is_confirmed():
                    continue
                tid = t.track_id
                bb = t.to_ltrb()
                cx = (bb[0] + bb[2]) / 2
                cy = (bb[1] + bb[3]) / 2
                in_roi = roi_x_start_px <= cx <= roi_x_end_px
                # Count when approaching: vehicle is within 80px above or 20px below line
                dist_to_line = cy - line_y_px
                approaching = -80 < dist_to_line < 20
                if tid not in counted and in_roi and approaching:
                    counted.add(tid)
                    total += 1

        # Persist to DB immediately on count change
        if total != last_db_count and args.supabase_url:
            last_db_count = total
            Thread(target=persist_count_to_db, args=(args.supabase_url, args.supabase_key, args.market_id, total), daemon=True).start()

        # Draw annotations on EVERY frame and pipe to MediaMTX
        annotated = draw_annotations(frame, tracks, counted, line_y_px, total,
                                     args.roi_x_start, args.roi_x_end)
        try:
            ffmpeg.stdin.write(annotated.tobytes())
        except:
            print("[Worker v2] FFmpeg pipe broken, restarting...")
            ffmpeg = start_ffmpeg_pipe(rtsp_out, w, h, fps=24)

        # Log
        if now - t_log >= 5:
            print(f"[Worker v2] #{fc} | Round {known_round} | Veiculos: {total} | Rastreados: {len(counted)}")
            t_log = now

    cap.release()
    ffmpeg.stdin.close()
    ffmpeg.wait()


if __name__ == "__main__":
    main()
