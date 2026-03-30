#!/usr/bin/env python3
"""
Vehicle Counter Worker for Camera Prediction Markets

Detects and counts vehicles using YOLOv8 + DeepSORT.
Draws bounding boxes and counting line on frames.
Uploads annotated frames to Supabase Storage every 2 seconds.
Sends vehicle count to API every N seconds.

Supports ROI (Region of Interest) to focus counting on the main road only.

Usage:
  python counter.py \
    --market-id cam_rodovia_sp123 \
    --stream-url "https://34.104.32.249.nip.io/SP055-KM073/stream.m3u8" \
    --stream-type hls \
    --api-url "https://previsao-tau.vercel.app" \
    --secret "wk_xxx" \
    --supabase-url "https://xxx.supabase.co" \
    --supabase-key "eyJhbG..." \
    --roi-x-start 0.1 --roi-x-end 0.7 \
    --line-y 0.55
"""

import argparse
import time
import cv2
import requests
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

# Vehicle classes: car=2, bus=5, truck=7 (NOT motorcycle=3)
VEHICLE_CLASSES = {2, 5, 7}

# Colors (BGR)
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

    # Dim area outside ROI (darken non-counting zones)
    overlay = out.copy()
    if roi_x_start > 0:
        cv2.rectangle(overlay, (0, 0), (x_start, h), BLACK, -1)
    if roi_x_end < 1.0:
        cv2.rectangle(overlay, (x_end, 0), (w, h), BLACK, -1)
    cv2.addWeighted(overlay, 0.3, out, 0.7, 0, out)

    # ROI border (subtle cyan lines)
    cv2.line(out, (x_start, 0), (x_start, h), CYAN, 1)
    cv2.line(out, (x_end, 0), (x_end, h), CYAN, 1)

    # Counting line (green dashed) — only within ROI
    for x in range(x_start, x_end, 20):
        cv2.line(out, (x, line_y), (min(x + 10, x_end), line_y), GREEN, 2)

    # Direction arrows on line
    for x in range(x_start + 60, x_end, 120):
        cv2.arrowedLine(out, (x - 20, line_y), (x + 20, line_y), GREEN, 1, tipLength=0.4)

    # ROI label
    cv2.putText(out, "ZONA DE CONTAGEM", (x_start + 5, line_y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, GREEN, 1)

    # Bounding boxes
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

    # Count overlay (top-left)
    txt = f"Veiculos: {total_count}"
    (tw, th_t), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), BLACK, -1)
    cv2.rectangle(out, (5, 5), (tw + 18, th_t + 18), GREEN, 1)
    cv2.putText(out, txt, (10, th_t + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, GREEN, 2)

    return out


def upload_frame(frame, market_id, supa_url, supa_key):
    try:
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
        r = requests.put(
            f"{supa_url}/storage/v1/object/camera-frames/{market_id}/latest.jpg",
            headers={
                "Authorization": f"Bearer {supa_key}",
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
            },
            data=buf.tobytes(),
            timeout=5,
        )
        return r.status_code
    except Exception as e:
        return f"ERR:{e}"


def main():
    p = argparse.ArgumentParser(description="Vehicle Counter Worker")
    p.add_argument("--market-id", required=True)
    p.add_argument("--stream-url", required=True)
    p.add_argument("--stream-type", default="youtube", choices=["youtube", "hls", "rtsp"])
    p.add_argument("--api-url", required=True)
    p.add_argument("--secret", required=True)
    p.add_argument("--supabase-url", default="")
    p.add_argument("--supabase-key", default="")
    p.add_argument("--confidence", type=float, default=0.35)
    p.add_argument("--count-interval", type=int, default=2)
    p.add_argument("--frame-interval", type=int, default=2)
    p.add_argument("--model", default="yolov8n.pt")
    # ROI parameters — focus counting on the main road
    p.add_argument("--roi-x-start", type=float, default=0.0, help="Left edge of ROI (0.0-1.0)")
    p.add_argument("--roi-x-end", type=float, default=1.0, help="Right edge of ROI (0.0-1.0)")
    p.add_argument("--line-y", type=float, default=0.55, help="Counting line Y position (0.0-1.0)")
    args = p.parse_args()

    print(f"[Worker] Market: {args.market_id}")
    print(f"[Worker] Stream: {args.stream_url} ({args.stream_type})")
    print(f"[Worker] ROI: x=[{args.roi_x_start:.0%} - {args.roi_x_end:.0%}], line_y={args.line_y:.0%}")
    print(f"[Worker] Frames: {'Supabase' if args.supabase_url else 'disabled'}")

    resolved = get_stream_url(args.stream_url, args.stream_type)
    print(f"[Worker] Resolved URL: {resolved[:80]}...")

    model = YOLO(args.model)
    tracker = DeepSort(max_age=30, n_init=3, nn_budget=100, max_iou_distance=0.7)

    cap = cv2.VideoCapture(resolved)
    if not cap.isOpened():
        print("[Worker] ERROR: Cannot open stream!")
        return

    print(f"[Worker] Stream opened. FPS: {cap.get(cv2.CAP_PROP_FPS):.0f}")

    fc = 0
    total = 0
    counted = set()
    t_count = t_frame = time.time()
    line_y = None
    roi_x_start_px = None
    roi_x_end_px = None

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

        # Detect
        results = model(frame, conf=args.confidence, verbose=False)
        dets = []
        for r in results:
            for box in r.boxes:
                cid = int(box.cls[0])
                if cid in VEHICLE_CLASSES:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    dets.append(([x1, y1, x2 - x1, y2 - y1], float(box.conf[0]), cid))

        # Track
        tracks = tracker.update_tracks(dets, frame=frame)
        for t in tracks:
            if not t.is_confirmed():
                continue
            tid = t.track_id
            bb = t.to_ltrb()
            cx = (bb[0] + bb[2]) / 2
            cy = (bb[1] + bb[3]) / 2
            # Only count if vehicle center is within ROI and crossing the line
            in_roi = roi_x_start_px <= cx <= roi_x_end_px
            near_line = abs(cy - line_y) < 25
            if tid not in counted and in_roi and near_line:
                counted.add(tid)
                total += 1

        now = time.time()

        # Upload annotated frame
        if args.supabase_url and now - t_frame >= args.frame_interval:
            ann = draw_annotations(frame, tracks, counted, line_y, total,
                                   args.roi_x_start, args.roi_x_end)
            st = upload_frame(ann, args.market_id, args.supabase_url, args.supabase_key)
            t_frame = now

        # Send count to API
        if now - t_count >= args.count_interval:
            try:
                r = requests.post(f"{args.api_url}/api/camera/ingest",
                    json={"market_id": args.market_id, "count": total,
                          "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                          "secret": args.secret}, timeout=10)
                api = r.status_code
            except Exception as e:
                api = f"ERR:{e}"
            print(f"[Worker] #{fc} | Veiculos: {total} | Rastreados: {len(counted)} | API: {api}")
            t_count = now

    cap.release()


if __name__ == "__main__":
    main()
