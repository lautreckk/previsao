#!/bin/bash
# Start MediaMTX in background, then run the worker
mediamtx /app/mediamtx.yml &
sleep 2
exec python counter_v2.py "$@"
