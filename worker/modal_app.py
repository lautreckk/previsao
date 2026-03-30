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

# ─── Per-camera ROI configuration ───
# Each camera was visually inspected to determine where the main road is.
# Format: (camera_id, roi_x_start, roi_x_end, line_y, confidence, tolerance)
#   roi_x_start/end: horizontal bounds of counting zone (0.0=left, 1.0=right)
#   line_y: vertical position of counting line (0.0=top, 1.0=bottom)
#   confidence: YOLO detection confidence (lower = more sensitive)
#   tolerance: pixel distance from line to count a vehicle (higher = catches smaller cars)
CAMERAS = {
    # KM110B — highway from above, road goes upper-center to lower-left, wide view
    "cam_sp055_km110b": ("SP055-KM110B", 0.15, 0.85, 0.58, 0.30, 35),

    # KM110A — Atatuba, road goes diagonal, multiple lanes center
    "cam_sp055_km110a": ("SP055-KM110A", 0.05, 0.80, 0.52, 0.30, 35),

    # KM073 — road is on RIGHT side (30-95%), left side is vegetation!
    "cam_sp055_km073":  ("SP055-KM073",  0.25, 0.95, 0.55, 0.30, 35),

    # KM055 — CAMERA INOPERANTE (problemas tecnicos) — keep but wider tolerance
    "cam_sp055_km055":  ("SP055-KM055",  0.30, 0.95, 0.80, 0.30, 40),

    # KM083 — road diagonal upper-right to lower-left, good coverage
    "cam_sp055_km083":  ("SP055-KM083",  0.08, 0.85, 0.55, 0.30, 35),

    # KM092 — Atatuba, main road on LEFT (5-65%), secondary road on right EXCLUDED
    "cam_sp055_km092":  ("SP055-KM092",  0.05, 0.65, 0.52, 0.30, 35),

    # KM136 — Bastiao, road curves, main road 5-75%
    "cam_sp055_km136":  ("SP055-KM136",  0.05, 0.75, 0.50, 0.30, 35),

    # KM168 — Bastiao, intersection area, focus on main straight road left side
    "cam_sp055_km168":  ("SP055-KM168",  0.05, 0.55, 0.58, 0.30, 35),

    # KM193 — Guaruja, road ONLY on left side (0-45%), right side is grass/sidewalk
    "cam_sp055_km193":  ("SP055-KM193",  0.0,  0.45, 0.55, 0.30, 35),

    # KM211A — Bertioga, road is on UPPER portion, line was on GRASS! Move line UP
    "cam_sp055_km211a": ("SP055-KM211A", 0.0,  0.50, 0.32, 0.25, 40),

    # KM211B — Bertioga, similar but wider, road on upper-left, grass center
    "cam_sp055_km211b": ("SP055-KM211B", 0.0,  0.55, 0.35, 0.25, 40),

    # KM095 — Braganca Paulista, highway from above, two directions with divider
    "cam_sp008_km095":  ("SP008-KM095",  0.08, 0.85, 0.48, 0.30, 35),

    # KM167 — Sto do Pinhal, curved highway, focus on straighter section
    "cam_sp046_km167":  ("SP046-KM167",  0.10, 0.75, 0.55, 0.30, 35),
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
        [(mid, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5]) for mid, cfg in CAMERAS.items()]
    ))
