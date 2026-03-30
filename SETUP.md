# Setup: Sistema de Mercados com IA

## Passo 1: Criar tabelas no Supabase

Abra o SQL Editor do Supabase e execute o conteudo de `supabase/markets_table.sql`.

Link direto: https://supabase.com/dashboard/project/gqymalmbbtzdnpbneegg/sql/new

## Passo 2: Configurar env vars na Vercel

Adicione no Vercel Dashboard (Settings > Environment Variables):

```
FAL_KEY=91a4776a-5c61-4820-ab85-ac76b2205524:fe24526774319bd7178b6cd5f94bcd27
ADMIN_SECRET=admin_winify_2026
CRON_SECRET=cron_winify_secret_2026
AI_GATEWAY_API_KEY=  (deixe vazio se usar OIDC)
```

## Passo 3: Testar geracao de mercados

Depois de criar as tabelas, rode localmente:

```bash
curl -X POST http://localhost:3000/api/markets/generate \
  -H "Content-Type: application/json" \
  -d '{"secret":"admin_winify_2026","count":3}'
```

Ou em producao:

```bash
curl -X POST https://previsao-tau.vercel.app/api/markets/generate \
  -H "Content-Type: application/json" \
  -d '{"secret":"admin_winify_2026","count":3}'
```

## Passo 4: Deploy

```bash
cd winify-previsao
git add -A && git commit -m "feat: AI market generator + Supabase migration"
git push
```

O cron job (`vercel.json`) vai gerar mercados automaticamente a cada hora apos o deploy.

## Arquivos criados/modificados

| Arquivo | O que faz |
|---------|-----------|
| `supabase/markets_table.sql` | Schema das tabelas prediction_markets e prediction_bets |
| `src/app/api/markets/route.ts` | CRUD de mercados (GET/POST/PATCH/DELETE) com refund automatico |
| `src/app/api/markets/generate/route.ts` | Gerador IA (Claude + fal.ai para imagens) |
| `src/app/api/cron/generate-markets/route.ts` | Cron job horario com mix inteligente |
| `src/app/api/setup-markets/route.ts` | Helper para criar tabelas via pg |
| `vercel.json` | Config do cron (a cada hora) |
| `src/app/page.tsx` | Homepage le do Supabase + fallback localStorage |
| `src/components/MarketCard.tsx` | Card de camera vai para /camera (lobby) |
| `src/components/CameraMarketView.tsx` | Componente extraido da camera page |
| `src/app/camera/page.tsx` | Lobby unico (sem redirect) |
| `src/app/camera/[id]/page.tsx` | Simplificado, usa CameraMarketView |
| `.env.local` | FAL_KEY, ADMIN_SECRET, CRON_SECRET adicionados |

## Como funciona o gerador IA

1. Cron roda a cada hora (ou admin chama manualmente)
2. Seleciona templates por categoria com peso (entertainment/sports > weather/politics)
3. Envia prompt para Claude via AI Gateway
4. Claude gera mercados em JSON (titulo, outcomes, odds, horario)
5. Para cada mercado, gera imagem de banner via fal.ai (nano-banana-2)
6. Salva no Supabase com status "open"
7. Homepage exibe automaticamente

## Cancel + Refund

Admin cancela mercado via PATCH `/api/markets`:
```bash
curl -X PATCH http://localhost:3000/api/markets \
  -H "Content-Type: application/json" \
  -d '{"id":"mkt_xxx","updates":{"status":"cancelled"},"secret":"admin_winify_2026"}'
```
Todas as apostas pendentes sao automaticamente reembolsadas ao saldo do usuario.
