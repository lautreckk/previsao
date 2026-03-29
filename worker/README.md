# Worker de Contagem de Veículos

Script Python que roda **fora do Vercel** (em um servidor/VPS com GPU ou CPU decente).

Usa YOLOv8 + DeepSORT para detectar e contar veículos em câmeras de trânsito ao vivo.

## Requisitos

- Python 3.9+
- GPU recomendado (funciona em CPU, mas mais lento)

## Instalação

```bash
cd worker
pip install -r requirements.txt
```

## Uso

```bash
python counter.py \
  --market-id "cam_xxx" \
  --stream-url "https://youtube.com/live/xxx" \
  --stream-type youtube \
  --api-url "https://previsao-tau.vercel.app" \
  --secret "seu_WORKER_SECRET"
```

### Parâmetros

| Param | Descrição | Default |
|-------|-----------|---------|
| `--market-id` | ID do mercado de câmera | (obrigatório) |
| `--stream-url` | URL do stream (YouTube/HLS/RTSP) | (obrigatório) |
| `--stream-type` | Tipo: `youtube`, `hls`, `rtsp` | `youtube` |
| `--api-url` | URL base da API | (obrigatório) |
| `--secret` | WORKER_SECRET (mesmo do .env.local) | (obrigatório) |
| `--confidence` | Threshold de confiança YOLO | `0.35` |
| `--send-interval` | Segundos entre updates na API | `5` |
| `--model` | Arquivo do modelo YOLO | `yolov8n.pt` |

## Como funciona

1. Conecta no stream de vídeo (YouTube Live, HLS, ou RTSP)
2. Detecta veículos usando YOLOv8 (carros, motos, ônibus, caminhões)
3. Rastreia cada veículo com DeepSORT (IDs únicos)
4. Conta quando um veículo cruza a linha central do frame
5. Envia a contagem para a API a cada 5 segundos

## Câmeras sugeridas (YouTube Live)

- Campos do Jordão SP-123: procurar "camera ao vivo campos do jordao"
- Rodovia dos Imigrantes: procurar "camera rodovia imigrantes ao vivo"
- Via Dutra: procurar "camera via dutra ao vivo"
- Rio de Janeiro trânsito: procurar "camera transito rio ao vivo"
