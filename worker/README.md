# Worker de Contagem de Veiculos

YOLOv8 + DeepSORT para detectar e contar veiculos em cameras de transito ao vivo.

## Deploy com Docker (Recomendado — VPS)

### 1. Criar o `.env`

```bash
cp .env.example .env
# Editar com seus valores reais
```

### 2. Subir todos os workers

```bash
docker compose up -d --build
```

### 3. Verificar logs

```bash
# Todos os workers
docker compose logs -f

# Uma camera especifica
docker compose logs -f cam-sp008-km095

# Status
docker compose ps
```

### 4. Parar / Reiniciar

```bash
docker compose down          # Parar tudo
docker compose restart       # Reiniciar tudo
docker compose up -d cam-sp055-km073  # Subir uma camera especifica
```

Os containers reiniciam automaticamente em caso de crash (`restart: always`).

## VPS Recomendada

- **Hetzner CCX43**: 16 vCPU dedicados, 64 GB RAM — ~EUR 70/mes
- Roda todas as 13 cameras com folga

## Uso manual (sem Docker)

```bash
pip install -r requirements.txt

python counter.py \
  --market-id "cam_sp008_km095" \
  --stream-url "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8" \
  --stream-type hls \
  --api-url "https://previsao-tau.vercel.app" \
  --secret "$WORKER_SECRET" \
  --supabase-url "$SUPABASE_URL" \
  --supabase-key "$SUPABASE_KEY" \
  --roi-x-start 0.08 --roi-x-end 0.85 --line-y 0.48
```

## Como funciona

1. Conecta no stream HLS da camera
2. Detecta veiculos usando YOLOv8 nano (carros, onibus, caminhoes)
3. Rastreia cada veiculo com DeepSORT (IDs unicos)
4. Conta quando o veiculo cruza a linha de contagem
5. Atualiza `camera_markets.current_count` no Supabase em tempo real
6. Faz upload do frame anotado (com bounding boxes) a cada 2s
