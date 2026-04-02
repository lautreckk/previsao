# Fontes de Camera e Infraestrutura

## Fonte do Video: DER-SP (Departamento de Estradas de Rodagem de SP)

O video vem das cameras de monitoramento de rodovias do DER-SP, acessiveis via HLS.

### URL Base
```
https://34.104.32.249.nip.io/{CAMERA_ID}/stream.m3u8
```

### Camera Atual
- **ID:** SP008-KM095
- **Rodovia:** SP-008 (Rodovia Fernao Dias)
- **KM:** 095
- **Cidade:** Braganca Paulista, SP
- **URL HLS:** `https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8`
- **Resolucao:** 1280x1024
- **FPS:** ~30fps
- **Formato:** HLS (HTTP Live Streaming) com segmentos .ts

### Como descobrir mais cameras
- O IP `34.104.32.249` e o proxy para as cameras do DER-SP
- O dominio `.nip.io` e um servico que resolve IPs como subdominios
- O formato do ID da camera e: `{RODOVIA}-KM{QUILOMETRO}`
- Exemplos: SP055-KM073, SP065-KM044, SP070-KM060

### Formato HLS
- Protocolo: HTTP Live Streaming (RFC 8216)
- Manifest: arquivo .m3u8 com lista de segmentos .ts
- Cada segmento tem ~2-6 segundos de video
- Latencia inerente: 10-30 segundos (caracteristica do HLS)
- Codecs: H.264 video, AAC audio (geralmente sem audio)

---

## VPS GPU (Vast.ai) — Worker de Deteccao

### Instancia Atual
- **IP:** 1.208.108.242
- **SSH:** `ssh -p 53118 root@1.208.108.242`
- **Jupyter:** https://1.208.108.242:53189
- **GPU:** RTX 5070 Ti (16GB VRAM)
- **CPU:** Xeon E5-2620 v3, 12 cores
- **RAM:** 16GB
- **Disco:** 75GB SSD
- **Custo:** $0.115/hr (~$83/mes)
- **Regiao:** Coreia do Sul
- **Template:** PyTorch NGC (nvcr.io/nvidia/pytorch_26.01-py3)
- **Instance ID:** 34039055

### Performance do Worker
- **Modelo:** YOLOv8n (nano) — 6.2MB
- **Tracker:** ByteTrack (integrado no Ultralytics)
- **Resolucao:** 540x432 (downscale de 1280x1024)
- **FPS:** 60-73 FPS (12-16ms por frame)
- **Classes detectadas:** car (2), bus (5), truck (7)

### Arquivos no Servidor
```
/workspace/
├── counter_gpu.py      # Worker YOLO + ByteTrack
├── start_vastai.sh     # Script de start com env vars
├── yolov8n.pt          # Modelo (baixado automaticamente)
├── mediamtx.yml        # Config MediaMTX (nao usado atualmente)
└── worker.log          # Logs do worker
```

### Comandos
```bash
# Iniciar
bash /workspace/start_vastai.sh

# Background
PYTHONUNBUFFERED=1 nohup bash /workspace/start_vastai.sh > worker.log 2>&1 &

# Parar
pkill -9 python3

# Logs
tail -f /workspace/worker.log

# GPU status
nvidia-smi
```

---

## Fluxo de Dados

```
Camera DER-SP (HLS)
    |
    v
Worker GPU (Vast.ai)
    |-- Le frames via cv2.VideoCapture
    |-- YOLO nano detecta veiculos (60+ FPS)
    |-- ByteTrack rastreia IDs unicos
    |-- Conta veiculos cruzando a linha
    |
    +---> Supabase REST API
    |     |-- PATCH camera_markets.current_count
    |     |-- PATCH camera_markets.detection_boxes (jsonb)
    |     |-- Triggers postgres_changes
    |
    v
Frontend (Vercel/Next.js)
    |-- HLS.js exibe video fluido da camera
    |-- postgres_changes recebe count + boxes em tempo real
    |-- Canvas overlay desenha boxes + linha verde
    |-- Poll 3s como fallback
```

---

## Supabase

- **URL:** https://gqymalmbbtzdnpbneegg.supabase.co
- **Tabela principal:** `camera_markets`
  - `id` (text) — ex: cam_sp008_km095
  - `current_count` (int) — contagem atual de veiculos
  - `detection_boxes` (jsonb) — coordenadas dos boxes YOLO
  - `phase` (text) — waiting/betting/observation
  - `round_number` (int) — numero da rodada
  - `stream_url` (text) — URL HLS da camera
- **Realtime:** postgres_changes no canal `camera:{marketId}`
- **Broadcast:** canal `cars-stream-{marketId}`

---

## Notas Importantes

1. **O video HLS tem delay de 10-30s** — isso e inerente ao protocolo, nao da VPS
2. **Os boxes YOLO sao do frame "ao vivo"** — podem nao coincidir exatamente com o video HLS (que esta atrasado)
3. **A contagem e precisa** — cada veiculo recebe um ID unico via ByteTrack
4. **A VPS Vast.ai e temporaria** — se expirar, seguir VASTAI-SETUP.md pra recriar
5. **Cameras do DER-SP podem mudar de IP** — monitorar se o proxy continua funcionando
