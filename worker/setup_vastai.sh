#!/bin/bash
# Setup script for Vast.ai Ubuntu VM with RTX 5070 Ti
# Run as root inside the Vast.ai instance
set -e

echo "=== Vast.ai GPU Worker Setup ==="

# 1. System deps
echo "[1/6] Installing system dependencies..."
apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    libgl1 libglib2.0-0 ffmpeg curl git

# 2. Check GPU
echo "[2/6] Checking GPU..."
nvidia-smi || { echo "ERROR: nvidia-smi not found! GPU not available."; exit 1; }

# 3. Setup working directory
echo "[3/6] Setting up workspace..."
mkdir -p /app && cd /app

# 4. Python venv + GPU PyTorch
echo "[4/6] Installing Python packages (GPU)..."
python3 -m venv /app/venv
source /app/venv/bin/activate

pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install --no-cache-dir \
    ultralytics>=8.0.0 \
    opencv-python-headless>=4.8.0 \
    deep_sort_realtime>=1.3 \
    requests>=2.28.0 \
    yt-dlp>=2024.1.0

# 5. Install MediaMTX
echo "[5/6] Installing MediaMTX..."
curl -sL https://github.com/bluenviron/mediamtx/releases/download/v1.12.2/mediamtx_v1.12.2_linux_amd64.tar.gz | tar xz -C /usr/local/bin/

# 6. Verify
echo "[6/6] Verifying setup..."
python3 -c "import torch; print(f'PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"none\"}')"
python3 -c "from ultralytics import YOLO; print('YOLO: OK')"
ffmpeg -encoders 2>/dev/null | grep nvenc | head -3 || echo "NVENC: not in ffmpeg (will use libx264)"
mediamtx --help >/dev/null 2>&1 && echo "MediaMTX: OK"

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "  1. Copy worker files to /app/"
echo "  2. Create /app/.env with credentials"
echo "  3. Run: cd /app && ./run_worker.sh"
