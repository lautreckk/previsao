#!/usr/bin/env python3
"""
Vehicle Counter Worker — GPU Max FPS v4
- yolov8n (nano) for speed
- Ultralytics built-in ByteTrack (no DeepSORT overhead)
- 540p processing
- No FFmpeg/MediaMTX — pure counting + Supabase broadcast
"""

import argparse
import time
import cv2
import numpy as np
import requests
import torch
import threading
from threading import Thread
from ultralytics import YOLO

VEHICLE_CLASSES = {2, 5, 7}  # car, bus, truck


class FrameGrabber:
    """Always returns the latest frame, drops stale buffer."""
    def __init__(self, cap):
        self.cap = cap
        self.frame = None
        self.ret = False
        self.lock = threading.Lock()
        self.stopped = False
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while not self.stopped:
            ret, frame = self.cap.read()
            with self.lock:
                self.ret, self.frame = ret, frame
            if not ret:
                time.sleep(0.1)

    def read(self):
        with self.lock:
            return self.ret, self.frame if self.frame is not None else (False, None)

    def release(self):
        self.stopped = True
        self.cap.release()


def get_stream_url(url, stream_type):
    if stream_type == "youtube":
        import yt_dlp
        with yt_dlp.YoutubeDL({"format": "best[height<=480]", "quiet": True}) as ydl:
            return ydl.extract_info(url, download=False)["url"]
    return url


def broadcast_count(supa_url, supa_key, market_id, count, boxes=None):
    """Broadcast count.sync with optional boxes for canvas overlay."""
    try:
        payload = {"count": count, "timestamp": int(time.time() * 1000)}
        if boxes:
            payload["boxes"] = boxes
        requests.post(
            f"{supa_url}/realtime/v1/api/broadcast",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}", "Content-Type": "application/json"},
            json={"messages": [{"topic": f"cars-stream-{market_id}", "event": "count.sync", "payload": payload}]},
            timeout=2,
        )
    except:
        pass


def persist_count(supa_url, supa_key, market_id, count):
    try:
        requests.patch(
            f"{supa_url}/rest/v1/camera_markets?id=eq.{market_id}",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}",
                     "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"current_count": count, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            timeout=5,
        )
    except:
        pass


# Background round poller
_rs = {"round": 0, "phase": "waiting", "count": 0}
_rl = threading.Lock()


def round_poller(su, sk, mid):
    global _rs
    while True:
        try:
            r = requests.get(f"{su}/rest/v1/camera_markets?id=eq.{mid}&select=round_number,phase,current_count",
                             headers={"apikey": sk, "Authorization": f"Bearer {sk}"}, timeout=3)
            d = r.json()
            if d:
                with _rl:
                    _rs = {"round": d[0].get("round_number", 0), "phase": d[0].get("phase", "waiting"),
                           "count": d[0].get("current_count", 0)}
        except:
            pass
        time.sleep(5)


def get_rs():
    with _rl:
        return _rs["round"], _rs["phase"], _rs["count"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--market-id", required=True)
    p.add_argument("--stream-url", required=True)
    p.add_argument("--stream-type", default="hls")
    p.add_argument("--api-url", required=True)
    p.add_argument("--secret", required=True)
    p.add_argument("--supabase-url", default="")
    p.add_argument("--supabase-key", default="")
    p.add_argument("--confidence", type=float, default=0.30)
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--roi-x-start", type=float, default=0.0)
    p.add_argument("--roi-x-end", type=float, default=1.0)
    p.add_argument("--line-y", type=float, default=0.55)
    p.add_argument("--resolution", type=int, default=540)
    a = p.parse_args()

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    if dev == "cuda":
        print(f"[W] GPU: {torch.cuda.get_device_name(0)} ({torch.cuda.get_device_properties(0).total_memory/1e9:.1f}GB)")

    print(f"[W] Market: {a.market_id} | Model: {a.model} | Res: {a.resolution}px")

    # Background round poller
    if a.supabase_url:
        Thread(target=round_poller, args=(a.supabase_url, a.supabase_key, a.market_id), daemon=True).start()
        time.sleep(1)

    cr, ph, dbc = get_rs()
    print(f"[W] Synced: round={cr} phase={ph} count={dbc}")

    # Open stream
    resolved = get_stream_url(a.stream_url, a.stream_type)
    cap = cv2.VideoCapture(resolved)
    if not cap.isOpened():
        print("[W] ERROR: Cannot open stream!")
        return

    ow, oh = int(cap.get(3)), int(cap.get(4))
    sc = min(a.resolution / ow, 1.0)
    w, h = int(ow * sc), int(oh * sc)
    print(f"[W] {ow}x{oh} → {w}x{h}")

    # Load YOLO + real warmup
    model = YOLO(a.model)
    model.to(dev)
    print("[W] CUDA warmup...")
    dummy = np.zeros((h, w, 3), dtype=np.uint8)
    model.track(dummy, conf=0.5, verbose=False, half=(dev == "cuda"), persist=True, tracker="bytetrack.yaml")
    print("[W] Warmup done!")

    # Threaded frame grabber
    grabber = FrameGrabber(cap)

    # State
    fc = 0
    total = dbc
    last_db = total
    counted = set()
    t_log = time.time()
    ly = int(h * a.line_y)
    rxs, rxe = int(w * a.roi_x_start), int(w * a.roi_x_end)
    kr, kp = cr, ph
    paused = ph == "waiting"
    fpsc, fpst, afps = 0, time.time(), 0.0

    print(f"[W] Running. count={total} round={kr}")

    while True:
        ts = time.time()

        ret, frame = grabber.read()
        if not ret or frame is None:
            time.sleep(0.01)
            continue

        if sc < 1.0:
            frame = cv2.resize(frame, (w, h))

        fc += 1

        # YOLO + ByteTrack in one call (fastest path)
        results = model.track(frame, conf=a.confidence, verbose=False,
                              half=(dev == "cuda"), persist=True, tracker="bytetrack.yaml")

        # Check round (non-blocking)
        nr, np_, _ = get_rs()
        if np_ == "waiting" and not paused:
            paused = True
        elif np_ != "waiting":
            paused = False
        if ((nr != kr) and nr > 0 and nr > kr) or (kp == "waiting" and np_ == "betting" and nr > 0):
            print(f"[W] RESET: round {kr}->{nr}")
            total = 0
            counted.clear()
            last_db = -1
            # Reset tracker by re-running with persist=False
            model.track(frame, conf=a.confidence, verbose=False, half=(dev == "cuda"), persist=False, tracker="bytetrack.yaml")
            if a.supabase_url:
                Thread(target=persist_count, args=(a.supabase_url, a.supabase_key, a.market_id, 0), daemon=True).start()
            paused = False
        kr, kp = nr, np_

        # Count vehicles from tracked results
        if not paused and results and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                cid = int(boxes.cls[i])
                if cid not in VEHICLE_CLASSES:
                    continue
                tid = int(boxes.id[i])
                if tid in counted:
                    continue
                x1, y1, x2, y2 = boxes.xyxy[i].cpu().numpy()
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                if rxs <= cx <= rxe and -100 < (cy - ly) < 25:
                    counted.add(tid)
                    total += 1

        # Persist + broadcast on change
        if total != last_db and a.supabase_url:
            last_db = total
            Thread(target=persist_count, args=(a.supabase_url, a.supabase_key, a.market_id, total), daemon=True).start()

        # Broadcast boxes + count every 3rd frame for canvas overlay
        if fc % 3 == 0 and a.supabase_url and results and results[0].boxes is not None:
            blist = []
            rboxes = results[0].boxes
            for i in range(len(rboxes)):
                cid = int(rboxes.cls[i])
                if cid not in VEHICLE_CLASSES:
                    continue
                x1b, y1b, x2b, y2b = rboxes.xyxy[i].cpu().numpy()
                tid = int(rboxes.id[i]) if rboxes.id is not None else 0
                blist.append({
                    "x1": round(float(x1b) / w, 4), "y1": round(float(y1b) / h, 4),
                    "x2": round(float(x2b) / w, 4), "y2": round(float(y2b) / h, 4),
                    "c": 1 if tid in counted else 0,
                })
            Thread(target=broadcast_count, args=(a.supabase_url, a.supabase_key, a.market_id, total, blist if blist else None), daemon=True).start()

        # FPS
        fpsc += 1
        now = time.time()
        if now - fpst >= 5:
            afps = fpsc / (now - fpst)
            fpsc = 0
            fpst = now
        if now - t_log >= 5:
            ms = (now - ts) * 1000
            print(f"[W] #{fc} | {afps:.1f} FPS | Round {kr} | Veiculos: {total} | {ms:.0f}ms/frame")
            t_log = now


if __name__ == "__main__":
    main()
