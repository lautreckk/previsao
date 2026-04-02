#!/bin/bash
# One-shot setup for Vast.ai GPU instance
# Sets up the camera worker + supervisord for process management
set -e

echo "=== Vast.ai Full Setup ==="
echo "Started at $(date)"

# 1. System deps
echo "[1/6] System deps..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg curl supervisor tmux htop

# 2. GPU PyTorch
echo "[2/6] PyTorch GPU (CUDA 12.4)..."
pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 3. Python deps
echo "[3/6] Python deps..."
pip3 install --no-cache-dir \
    ultralytics>=8.0.0 \
    opencv-python-headless>=4.8.0 \
    deep_sort_realtime>=1.3 \
    requests>=2.28.0 \
    yt-dlp>=2024.1.0

# 4. MediaMTX
echo "[4/6] MediaMTX..."
if ! command -v mediamtx &>/dev/null; then
    curl -sL https://github.com/bluenviron/mediamtx/releases/download/v1.12.2/mediamtx_v1.12.2_linux_amd64.tar.gz | tar xz -C /usr/local/bin/
fi

# 5. Setup project dirs
echo "[5/6] Project structure..."
mkdir -p /app/camera-worker /var/log/supervisor

# Move files to camera-worker dir
for f in counter_gpu.py mediamtx.yml .env; do
    [ -f /app/$f ] && mv /app/$f /app/camera-worker/
done

# 6. Supervisord config
echo "[6/6] Supervisord config..."
cat > /etc/supervisor/conf.d/vastai.conf << 'SUPERVISOR'
[program:mediamtx]
command=mediamtx /app/camera-worker/mediamtx.yml
directory=/app/camera-worker
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/mediamtx.log
stderr_logfile=/var/log/supervisor/mediamtx_err.log
stdout_logfile_maxbytes=10MB
priority=10

[program:camera-worker]
command=python3 /app/camera-worker/counter_gpu.py
    --market-id cam_sp008_km095
    --stream-url "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8"
    --stream-type hls
    --api-url %(ENV_API_URL)s
    --secret %(ENV_WORKER_SECRET)s
    --supabase-url %(ENV_SUPABASE_URL)s
    --supabase-key %(ENV_SUPABASE_KEY)s
    --mediamtx-url rtsp://localhost:8554
    --roi-x-start 0.08 --roi-x-end 0.85 --line-y 0.48
    --confidence 0.30 --tolerance 35
    --model yolov8s.pt
    --target-fps 30
    --resolution 720
directory=/app/camera-worker
autostart=true
autorestart=true
startsecs=5
startretries=999
stdout_logfile=/var/log/supervisor/camera-worker.log
stderr_logfile=/var/log/supervisor/camera-worker_err.log
stdout_logfile_maxbytes=50MB
environment=PYTHONUNBUFFERED="1"
priority=20
SUPERVISOR

# Load env vars for supervisord
if [ -f /app/camera-worker/.env ]; then
    echo "" >> /etc/supervisor/conf.d/vastai.conf
    echo "[supervisord]" >> /etc/supervisor/conf.d/vastai.conf
    # Export env vars so supervisor %(ENV_X)s works
    set -a
    source /app/camera-worker/.env
    set +a
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "GPU:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""
python3 -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
python3 -c "from ultralytics import YOLO; print('YOLO OK')"
echo ""
echo "Commands:"
echo "  supervisord -c /etc/supervisor/supervisord.conf   # Start all"
echo "  supervisorctl status                               # Check status"
echo "  supervisorctl tail -f camera-worker                # Live logs"
echo "  supervisorctl restart camera-worker                # Restart"
echo "  tail -f /var/log/supervisor/camera-worker.log      # Raw logs"
