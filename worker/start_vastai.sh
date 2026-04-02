#!/bin/bash
cd /workspace
export API_URL=https://previsao-tau.vercel.app
export WORKER_SECRET=wk_a7f3b2e1d9c4f8a6b5e0d3c2f1a8b7e6
export SUPABASE_URL=https://gqymalmbbtzdnpbneegg.supabase.co
export SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyNTM0NiwiZXhwIjoyMDkwMjAxMzQ2fQ.2UHEZos5ZcuJk1WOsWKoY301syoTu8NsZR0hu7S19OE
export STREAM=https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8
exec python3 counter_gpu.py --market-id cam_sp008_km095 --stream-url "$STREAM" --stream-type hls --api-url "$API_URL" --secret "$WORKER_SECRET" --supabase-url "$SUPABASE_URL" --supabase-key "$SUPABASE_KEY" --confidence 0.30 --model yolov8n.pt --roi-x-start 0.08 --roi-x-end 0.85 --line-y 0.48 --resolution 540
