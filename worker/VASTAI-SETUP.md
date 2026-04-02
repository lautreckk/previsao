# Vast.ai GPU Worker — Setup Guide

## Instância Atual

- **IP:** 1.208.108.242
- **SSH:** porta 53118
- **GPU:** RTX 5070 Ti (16GB VRAM)
- **Template:** PyTorch NGC
- **Custo:** ~$0.115/hr (~$83/mês)
- **Instance ID:** 34039055

## Como Conectar

### Via SSH (Terminal do Mac)
```bash
ssh -p 53118 root@1.208.108.242
```

### Via Jupyter (Browser)
Abre: `https://1.208.108.242:53189`

### Se SSH não funcionar
1. Vai em https://cloud.vast.ai/instances
2. Clica no ícone de chave/cadeado da instância
3. Adiciona a chave SSH: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJYFCGSk+gIpBulKxNa9/fd0cwy8sZK/6CS4DzrVDefi olautreck@gmail.com`
4. Espera 10 segundos e tenta novamente

## Arquivos no Servidor

```
/workspace/
├── counter_gpu.py      # Worker principal (YOLO + ByteTrack + Supabase)
├── start_vastai.sh     # Script de inicialização (com envs)
├── yolov8n.pt          # Modelo YOLO nano (baixado automaticamente)
└── worker.log          # Log do worker
```

## Comandos Úteis

### Iniciar o worker
```bash
cd /workspace && PYTHONUNBUFFERED=1 bash start_vastai.sh
```

### Iniciar em background
```bash
cd /workspace && nohup bash start_vastai.sh > worker.log 2>&1 &
```

### Ver logs
```bash
tail -f /workspace/worker.log
```

### Parar o worker
```bash
pkill -9 python3
```

### Reiniciar
```bash
pkill -9 python3 && sleep 2 && cd /workspace && nohup bash start_vastai.sh > worker.log 2>&1 &
```

### Verificar se está rodando
```bash
ps aux | grep counter_gpu
```

### Ver uso da GPU
```bash
nvidia-smi
```

## Como Atualizar o Worker

1. Edita `worker/counter_gpu.py` no projeto local
2. Copia pro servidor:
```bash
scp -P 53118 worker/counter_gpu.py root@1.208.108.242:/workspace/
```
3. Reinicia:
```bash
ssh -p 53118 root@1.208.108.242 "pkill -9 python3; sleep 2; cd /workspace && nohup bash start_vastai.sh > worker.log 2>&1 &"
```

## Se a Instância Morrer/Expirar

1. Vai em https://cloud.vast.ai/instances
2. Cria nova instância com template **"PyTorch NGC"**
3. Escolhe GPU com reliability > 99%, fora da China
4. Adiciona SSH key pelo painel
5. Conecta via SSH e roda:
```bash
apt-get update -qq && apt-get install -y libgl1 libglib2.0-0 ffmpeg curl
pip3 install ultralytics opencv-python-headless deep_sort_realtime requests yt-dlp
```
6. Copia os arquivos:
```bash
scp -P <PORTA_SSH> worker/counter_gpu.py worker/start_vastai.sh root@<IP>:/workspace/
```
7. Atualiza o IP/porta no `start_vastai.sh` se necessário
8. Roda: `bash /workspace/start_vastai.sh`

## Arquitetura

```
HLS Stream (DER-SP) ──→ Worker (Vast.ai GPU)
                          ├─ YOLO nano + ByteTrack (detecção)
                          ├─ Supabase PATCH (current_count)
                          └─ Supabase Broadcast (count.sync)
                                    ↓
                          Frontend (Vercel)
                          ├─ postgres_changes (~200ms)
                          ├─ broadcast listener (~50ms)
                          └─ poll fallback (3s)
```

## Credenciais (no start_vastai.sh)

- API_URL: https://previsao-tau.vercel.app
- SUPABASE_URL: https://gqymalmbbtzdnpbneegg.supabase.co
- WORKER_SECRET e SUPABASE_KEY estão no script
