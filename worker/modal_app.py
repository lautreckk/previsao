"""
Modal deployment for camera workers.

Deploy: modal run modal_app.py
Deploy persistent: modal deploy modal_app.py
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

# Camera configs
CAMERAS = {
    "cam_sp055_km110b": "SP055-KM110B",
    "cam_sp055_km110a": "SP055-KM110A",
    "cam_sp055_km073": "SP055-KM073",
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
def run_worker(market_id: str, camera_id: str):
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
        "--confidence", "0.35",
        "--model", "yolov8n.pt",
    ]
    print(f"[Modal] Starting worker for {camera_id} ({market_id})")
    subprocess.run(cmd)


@app.function(
    image=image,
    timeout=3600,
    cpu=0.25,
    memory=256,
    secrets=[modal.Secret.from_name("winify-secrets")],
    schedule=modal.Cron("* * * * *"),  # every minute
)
def tick_rounds():
    """Call /api/camera/round for each active camera every minute."""
    import requests as req
    secret = os.environ["WORKER_SECRET"]
    for market_id in CAMERAS:
        try:
            r = req.post(
                f"{API_URL}/api/camera/round",
                json={"market_id": market_id, "secret": secret},
                timeout=15,
            )
            print(f"[Tick] {market_id}: {r.status_code} {r.json()}")
        except Exception as e:
            print(f"[Tick] {market_id}: ERROR {e}")


@app.local_entrypoint()
def main():
    """Launch workers for all cameras in parallel."""
    print(f"[Modal] Starting {len(CAMERAS)} camera workers...")
    list(run_worker.starmap(
        [(mid, cid) for mid, cid in CAMERAS.items()]
    ))
