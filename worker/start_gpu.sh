#!/bin/bash
# Start MediaMTX in background, then run the GPU worker
echo "[start] Starting MediaMTX..."
mediamtx /app/mediamtx.yml &
sleep 2

echo "[start] GPU info:"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>/dev/null || echo "nvidia-smi not available"

echo "[start] Starting GPU worker (v2 — annotated stream)..."
exec python counter_v2.py "$@"
