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

# Camera configs with ROI (Region of Interest) to focus on main road
# roi_x_start/roi_x_end: horizontal boundaries (0.0=left, 1.0=right)
# line_y: counting line vertical position (0.0=top, 1.0=bottom)
CAMERAS = {
    # market_id: (camera_id, roi_x_start, roi_x_end, line_y)
    "cam_sp055_km110b": ("SP055-KM110B", 0.05, 0.75, 0.55),
    "cam_sp055_km110a": ("SP055-KM110A", 0.05, 0.75, 0.55),
    "cam_sp055_km073":  ("SP055-KM073",  0.10, 0.70, 0.55),
    "cam_sp055_km055":  ("SP055-KM055",  0.05, 0.80, 0.55),
    "cam_sp055_km083":  ("SP055-KM083",  0.10, 0.75, 0.55),
    "cam_sp055_km092":  ("SP055-KM092",  0.05, 0.80, 0.55),
    "cam_sp055_km136":  ("SP055-KM136",  0.05, 0.75, 0.55),
    "cam_sp055_km168":  ("SP055-KM168",  0.10, 0.75, 0.55),
    "cam_sp055_km193":  ("SP055-KM193",  0.05, 0.80, 0.55),
    "cam_sp055_km211a": ("SP055-KM211A", 0.05, 0.75, 0.55),
    "cam_sp055_km211b": ("SP055-KM211B", 0.05, 0.75, 0.55),
    "cam_sp008_km095":  ("SP008-KM095",  0.10, 0.80, 0.55),
    "cam_sp046_km167":  ("SP046-KM167",  0.10, 0.75, 0.55),
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
def run_worker(market_id: str, camera_id: str, roi_x_start: float, roi_x_end: float, line_y: float):
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
        "--roi-x-start", str(roi_x_start),
        "--roi-x-end", str(roi_x_end),
        "--line-y", str(line_y),
    ]
    print(f"[Modal] Starting worker for {camera_id} ({market_id}) ROI=[{roi_x_start:.0%}-{roi_x_end:.0%}] line_y={line_y:.0%}")
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
        [(mid, cfg[0], cfg[1], cfg[2], cfg[3]) for mid, cfg in CAMERAS.items()]
    ))
