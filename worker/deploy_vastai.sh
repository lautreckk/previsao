#!/bin/bash
# Full deploy script — runs entirely on the Vast.ai instance
# Installs deps, sets up MediaMTX, and starts the worker
set -e
exec > /app/deploy.log 2>&1

echo "=== Deploy started at $(date) ==="

cd /app

# 1. System deps
echo "[1/5] System deps..."
apt-get update -qq && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg curl 2>/dev/null
echo "FFmpeg: $(ffmpeg -version 2>/dev/null | head -1)"

# 2. GPU PyTorch
echo "[2/5] Installing GPU PyTorch..."
pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu124 2>&1 | tail -3

# 3. Python deps
echo "[3/5] Installing Python deps..."
pip3 install --no-cache-dir \
    ultralytics>=8.0.0 \
    opencv-python-headless>=4.8.0 \
    deep_sort_realtime>=1.3 \
    requests>=2.28.0 \
    yt-dlp>=2024.1.0 2>&1 | tail -3

# 4. MediaMTX
echo "[4/5] Installing MediaMTX..."
if ! command -v mediamtx &>/dev/null; then
    curl -sL https://github.com/bluenviron/mediamtx/releases/download/v1.12.2/mediamtx_v1.12.2_linux_amd64.tar.gz | tar xz -C /usr/local/bin/
fi
echo "MediaMTX: $(mediamtx --help 2>&1 | head -1 || echo 'installed')"

# 5. Verify
echo "[5/5] Verifying..."
python3 -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
python3 -c "from ultralytics import YOLO; print('YOLO: OK')"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader

echo "=== Deploy complete at $(date) ==="
echo "Run: nohup bash /app/run_worker.sh > /app/worker.log 2>&1 &"
