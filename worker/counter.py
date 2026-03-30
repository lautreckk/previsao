#!/usr/bin/env python3
"""
Vehicle Counter Worker — Round-Aware, Near Real-Time

- Polls Supabase every 5s to check current round_number
- Resets count to 0 when a new round starts
- Updates count DIRECTLY in Supabase for instant frontend updates
"""

import argparse
import time
import cv2
import requests
import numpy as np
from threading import Thread
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

VEHICLE_CLASSES = {2, 5, 7}  # car, bus, truck

RED = (0, 0, 255)
GREEN = (0, 255, 0)
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

    overlay = out.copy()
    if roi_x_start > 0:
        cv2.rectangle(overlay, (0, 0), (x_start, h), BLACK, -1)
    if roi_x_end < 1.0:
        cv2.rectangle(overlay, (x_end, 0), (w, h), BLACK, -1)
    cv2.addWeighted(overlay, 0.3, out, 0.7, 0, out)

    cv2.line(out, (x_start, 0), (x_start, h), CYAN, 1)
    cv2.line(out, (x_end, 0), (x_end, h), CYAN, 1)

    for x in range(x_start, x_end, 20):
        cv2.line(out, (x, line_y), (min(x + 10, x_end), line_y), GREEN, 2)
    for x in range(x_start + 60, x_end, 120):
        cv2.arrowedLine(out, (x - 20, line_y), (x + 20, line_y), GREEN, 1, tipLength=0.4)

    cv2.putText(out, "ZONA DE CONTAGEM", (x_start + 5, line_y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, GREEN, 1)

    for track in tracks:
        if not track.is_confirmed():
            continue
        tid = track.track_id
        ltrb = track.to_ltrb()
        x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
        is_counted = tid in counted_ids
        color = GREEN if is_counted else RED
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        label = f"#{tid}"
        (tw, th_t), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(out, (x1, y1 - th_t - 8), (x1 + tw + 6, y1), color, -1)
        cv2.putText(out, label, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, WHITE, 1)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.circle(out, (cx, cy), 3, YELLOW, -1)

    txt = f"Veiculos: {total_count}"
    (tw, th_t), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), BLACK, -1)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), GREEN, 1)
    cv2.putText(out, txt, (10, th_t + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, GREEN, 2)
    return out


def upload_frame(frame, market_id, supa_url, supa_key):
    try:
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
        requests.put(
            f"{supa_url}/storage/v1/object/camera-frames/{market_id}/latest.jpg",
            headers={"Authorization": f"Bearer {supa_key}", "Content-Type": "image/jpeg", "x-upsert": "true"},
            data=buf.tobytes(), timeout=5)
    except:
        pass


def update_count_direct(supa_url, supa_key, market_id, count):
    """Update count directly in Supabase via PostgREST."""
    try:
        requests.patch(
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}",
            headers={
                "apikey": supa_key,
                "Authorization": f"Bearer {supa_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={"current_count": count, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            timeout=3,
        )
    except:
        pass


def update_count_async(supa_url, supa_key, market_id, count):
    Thread(target=update_count_direct, args=(supa_url, supa_key, market_id, count), daemon=True).start()


def get_current_round(supa_url, supa_key, market_id):
    """Fetch current round_number and phase from Supabase."""
    try:
        r = requests.get(
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}&select=round_number,phase,current_count",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}"},
            timeout=5,
        )
        data = r.json()
        if data and len(data) > 0:
            return data[0].get("round_number", 0), data[0].get("phase", "waiting"), data[0].get("current_count", 0)
    except:
        pass
    return 0, "waiting", 0


def main():
    p = argparse.ArgumentParser(description="Vehicle Counter Worker")
    p.add_argument("--market-id", required=True)
    p.add_argument("--stream-url", required=True)
    p.add_argument("--stream-type", default="hls", choices=["youtube", "hls", "rtsp"])
    p.add_argument("--api-url", required=True)
    p.add_argument("--secret", required=True)
    p.add_argument("--supabase-url", default="")
    p.add_argument("--supabase-key", default="")
    p.add_argument("--confidence", type=float, default=0.30)
    p.add_argument("--count-interval", type=int, default=2)
    p.add_argument("--frame-interval", type=int, default=2)
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--roi-x-start", type=float, default=0.0)
    p.add_argument("--roi-x-end", type=float, default=1.0)
    p.add_argument("--line-y", type=float, default=0.55)
    p.add_argument("--tolerance", type=int, default=35)
    args = p.parse_args()

    print(f"[Worker] Market: {args.market_id}")
    print(f"[Worker] Stream: {args.stream_url} ({args.stream_type})")
    print(f"[Worker] ROI: x=[{args.roi_x_start:.0%}-{args.roi_x_end:.0%}] line_y={args.line_y:.0%} tol={args.tolerance}px")

    # Read current round from DB on startup to sync state
    current_round, phase, db_count = get_current_round(args.supabase_url, args.supabase_key, args.market_id)
    print(f"[Worker] Synced from DB: round={current_round} phase={phase} count={db_count}")

    resolved = get_stream_url(args.stream_url, args.stream_type)
    print(f"[Worker] Resolved: {resolved[:80]}...")

    model = YOLO(args.model)
    tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)

    cap = cv2.VideoCapture(resolved)
    if not cap.isOpened():
        print("[Worker] ERROR: Cannot open stream!")
        return

    print(f"[Worker] Stream opened. FPS: {cap.get(cv2.CAP_PROP_FPS):.0f}")

    fc = 0
    total = 0  # Always start fresh at 0 for this round
    last_sent_count = -1
    counted = set()
    t_log = t_frame = t_round_check = time.time()
    line_y = None
    roi_x_start_px = None
    roi_x_end_px = None
    known_round = current_round

    # Set DB count to 0 for the current round (clean start)
    if args.supabase_url:
        update_count_direct(args.supabase_url, args.supabase_key, args.market_id, 0)
        print(f"[Worker] Reset count to 0 for round {known_round}")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[Worker] Reconnecting in 5s...")
            cap.release()
            time.sleep(5)
            try:
                resolved = get_stream_url(args.stream_url, args.stream_type)
                cap = cv2.VideoCapture(resolved)
            except:
                pass
            continue

        fc += 1
        if fc % 3 != 0:
            continue

        h, w = frame.shape[:2]
        if line_y is None:
            line_y = int(h * args.line_y)
            roi_x_start_px = int(w * args.roi_x_start)
            roi_x_end_px = int(w * args.roi_x_end)

        results = model(frame, conf=args.confidence, verbose=False)
        dets = []
        for r in results:
            for box in r.boxes:
                cid = int(box.cls[0])
                if cid in VEHICLE_CLASSES:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    dets.append(([x1, y1, x2 - x1, y2 - y1], float(box.conf[0]), cid))

        tracks = tracker.update_tracks(dets, frame=frame)
        for t in tracks:
            if not t.is_confirmed():
                continue
            tid = t.track_id
            bb = t.to_ltrb()
            cx = (bb[0] + bb[2]) / 2
            cy = (bb[1] + bb[3]) / 2
            in_roi = roi_x_start_px <= cx <= roi_x_end_px
            near_line = abs(cy - line_y) < args.tolerance
            if tid not in counted and in_roi and near_line:
                counted.add(tid)
                total += 1

        now = time.time()

        # Check for new round every 5 seconds — reset count if round changed
        if args.supabase_url and now - t_round_check >= 5:
            new_round, new_phase, _ = get_current_round(args.supabase_url, args.supabase_key, args.market_id)
            if new_round != known_round:
                print(f"[Worker] NEW ROUND {known_round} -> {new_round}! Resetting count.")
                known_round = new_round
                total = 0
                counted.clear()
                last_sent_count = -1
                tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)
                update_count_direct(args.supabase_url, args.supabase_key, args.market_id, 0)
            t_round_check = now

        # Update Supabase directly when count changes
        if total != last_sent_count and args.supabase_url:
            last_sent_count = total
            update_count_async(args.supabase_url, args.supabase_key, args.market_id, total)

        # Upload annotated frame every 2s
        if args.supabase_url and now - t_frame >= args.frame_interval:
            ann = draw_annotations(frame, tracks, counted, line_y, total,
                                   args.roi_x_start, args.roi_x_end)
            Thread(target=upload_frame, args=(ann, args.market_id, args.supabase_url, args.supabase_key), daemon=True).start()
            t_frame = now

        # Log every 5s
        if now - t_log >= 5:
            print(f"[Worker] #{fc} | Round {known_round} | Veiculos: {total} | Rastreados: {len(counted)}")
            t_log = now

    cap.release()


if __name__ == "__main__":
    main()
