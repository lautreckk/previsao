"""
Modal deployment for camera workers.

Strategy: Run ONE worker at a time for the camera with the active round.
The tick_rounds cron manages round transitions for ALL cameras.
The single active worker handles detection for the current camera.

Deploy: modal deploy modal_app.py
Run single camera: modal run modal_app.py --market-id cam_sp055_km073
Run all cameras: modal run modal_app.py
"""

import modal
import subprocess
import os

app = modal.App("winify-camera-worker")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(["libgl1-mesa-glx", "libglib2.0-0"])
    .pip_install([
        "ultralytics==8.3.0",
        "deep-sort-realtime==1.3.2",
        "opencv-python-headless==4.10.0.84",
        "requests==2.32.3",
        "yt-dlp==2024.11.18",
        "numpy==1.26.4",
    ])
    .add_local_file("counter.py", "/root/counter.py")
)

# Per-camera ROI configuration
# Format: (camera_id, roi_x_start, roi_x_end, line_y, confidence, tolerance)
CAMERAS = {
    "cam_sp008_km095":  ("SP008-KM095",  0.08, 0.85, 0.48, 0.30, 35),
    "cam_sp055_km110b": ("SP055-KM110B", 0.15, 0.85, 0.58, 0.30, 35),
    "cam_sp055_km110a": ("SP055-KM110A", 0.05, 0.80, 0.52, 0.30, 35),
}

API_URL = "https://previsao-tau.vercel.app"
STREAM_BASE = "https://34.104.32.249.nip.io/{camera_id}/stream.m3u8"


@app.function(
    image=image,
    timeout=3600,
    cpu=2.0,
    memory=2048,
    retries=modal.Retries(max_retries=10, backoff_coefficient=2),
    secrets=[modal.Secret.from_name("winify-secrets")],
)
def run_worker(market_id: str, camera_id: str, roi_x_start: float, roi_x_end: float, line_y: float, confidence: float, tolerance: int):
    """Run YOLOv8 worker for a single camera."""
    stream_url = STREAM_BASE.format(camera_id=camera_id)

    cmd = [
        "python", "/root/counter.py",
        "--market-id", market_id,
        "--stream-url", stream_url,
        "--stream-type", "hls",
        "--api-url", API_URL,
        "--secret", os.environ["WORKER_SECRET"],
        "--supabase-url", os.environ["SUPABASE_URL"],
        "--supabase-key", os.environ["SUPABASE_KEY"],
        "--count-interval", "2",
        "--confidence", str(confidence),
        "--model", "yolov8n.pt",
        "--roi-x-start", str(roi_x_start),
        "--roi-x-end", str(roi_x_end),
        "--line-y", str(line_y),
        "--tolerance", str(tolerance),
    ]
    print(f"[Modal] {camera_id} ({market_id}) ROI=[{roi_x_start:.0%}-{roi_x_end:.0%}] line_y={line_y:.0%} conf={confidence} tol={tolerance}px")
    subprocess.run(cmd)


# Track which workers are alive (updated_at from DB tells us)
_last_counts: dict[str, tuple[int, int]] = {}  # market_id -> (count, stale_ticks)


@app.function(
    image=image,
    timeout=3600,
    cpu=0.25,
    memory=256,
    secrets=[modal.Secret.from_name("winify-secrets")],
    schedule=modal.Cron("* * * * *"),
)
def tick_rounds():
    """Call /api/camera/round for each camera every minute to advance phases.
    Also detects dead workers and respawns them automatically.
    """
    import requests as req
    secret = os.environ["WORKER_SECRET"]
    supa_url = os.environ["SUPABASE_URL"]
    supa_key = os.environ["SUPABASE_KEY"]

    # Fetch all camera states in one call
    try:
        r = req.get(
            f"{supa_url}/rest/v1/camera_markets?select=id,current_count,phase,updated_at&id=in.({','.join(CAMERAS.keys())})",
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}"},
            timeout=10,
        )
        camera_states = {c["id"]: c for c in r.json()} if r.ok else {}
    except Exception:
        camera_states = {}

    workers_to_spawn = []

    for market_id in CAMERAS:
        # 1. Advance round phases
        try:
            r = req.post(
                f"{API_URL}/api/camera/round",
                json={"market_id": market_id, "secret": secret},
                timeout=15,
            )
            print(f"[Tick] {market_id}: {r.status_code} {r.json()}")
        except Exception as e:
            print(f"[Tick] {market_id}: ERROR {e}")

        # 2. Detect dead workers: if camera is in active phase but count
        #    hasn't changed in 3+ ticks (3 minutes), worker is dead
        state = camera_states.get(market_id)
        if not state:
            continue

        phase = state.get("phase", "waiting")
        count = state.get("current_count", 0)

        if phase in ("betting", "observation"):
            prev_count, stale_ticks = _last_counts.get(market_id, (None, 0))
            if prev_count is not None and count == prev_count:
                stale_ticks += 1
            else:
                stale_ticks = 0
            _last_counts[market_id] = (count, stale_ticks)

            if stale_ticks >= 3:
                print(f"[Tick] {market_id}: Worker dead (count={count} unchanged for {stale_ticks} ticks). Respawning!")
                workers_to_spawn.append(market_id)
                _last_counts[market_id] = (count, 0)  # Reset so we don't spam
        else:
            _last_counts.pop(market_id, None)

    # 3. Respawn dead workers
    for market_id in workers_to_spawn:
        cfg = CAMERAS[market_id]
        try:
            run_worker.spawn(market_id, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5])
            print(f"[Tick] {market_id}: Worker respawned!")
        except Exception as e:
            print(f"[Tick] {market_id}: Failed to respawn: {e}")


@app.local_entrypoint()
def main(market_id: str = ""):
    """Launch worker(s).

    Usage:
      modal run modal_app.py                           # All cameras
      modal run modal_app.py --market-id cam_sp055_km073  # Single camera
    """
    if market_id and market_id in CAMERAS:
        # Single camera mode
        cfg = CAMERAS[market_id]
        print(f"[Modal] Starting single worker for {market_id}...")
        run_worker.remote(market_id, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5])
    elif market_id:
        print(f"[Modal] ERROR: Unknown market_id '{market_id}'. Available: {list(CAMERAS.keys())}")
    else:
        # All cameras (use with caution — costs more)
        print(f"[Modal] Starting {len(CAMERAS)} camera workers...")
        list(run_worker.starmap(
            [(mid, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5]) for mid, cfg in CAMERAS.items()]
        ))
