#!/bin/bash
# Run the GPU worker directly on Vast.ai (no Docker needed)
set -e
cd /app
source /app/venv/bin/activate

# Load env vars
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "ERROR: /app/.env not found!"
    exit 1
fi

# Start MediaMTX in background
echo "[run] Starting MediaMTX..."
mediamtx /app/mediamtx.yml &
MEDIAMTX_PID=$!
sleep 2

# Trap to clean up on exit
trap "kill $MEDIAMTX_PID 2>/dev/null; exit" SIGINT SIGTERM EXIT

echo "[run] GPU info:"
nvidia-smi --query-gpu=name,memory.total,memory.free,temperature.gpu --format=csv,noheader

echo "[run] Starting GPU worker (v2 — annotated stream)..."
python3 counter_v2.py \
    --market-id cam_sp008_km095 \
    --stream-url "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8" \
    --stream-type hls \
    --api-url "${API_URL}" \
    --secret "${WORKER_SECRET}" \
    --supabase-url "${SUPABASE_URL}" \
    --supabase-key "${SUPABASE_KEY}" \
    --mediamtx-url rtsp://localhost:8554 \
    --roi-x-start 0.08 --roi-x-end 0.85 --line-y 0.48 \
    --confidence 0.30 --tolerance 35 \
    --model yolov8s.pt
