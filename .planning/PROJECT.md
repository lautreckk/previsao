# Winify Previsao — Car Counting Evolution

## What This Is

Plataforma de mercado de previsao baseada em contagem de veiculos em rodovias ao vivo. Usuarios apostam se a contagem de carros ultrapassara um threshold (over/under) em janelas de 2:30min. O sistema usa YOLOv8 + Deep SORT para detectar veiculos cruzando uma linha em streams de cameras de rodovias, com resultados em tempo real via WebSocket.

## Core Value

A contagem de veiculos deve ser **precisa e em tempo real** — uma contagem errada ou atrasada invalida as apostas e destrói a confianca do usuario.

## Requirements

### Validated

- ✓ Deteccao de veiculos com YOLOv8 nano — existing
- ✓ Tracking com Deep SORT — existing
- ✓ Sistema de rounds com fases (waiting/betting/observation/resolved) — existing
- ✓ Apostas over/under com pool e odds dinamicas — existing
- ✓ Interface de camera com contagem ao vivo — existing
- ✓ Upload de frames anotados para Supabase Storage — existing
- ✓ 13 cameras configuradas (SP055, SP008, SP046) — existing
- ✓ Worker orchestration via Modal.io com respawn automatico — existing

### Active

- [ ] Contagem precisa com verificacao de direcao e anti-duplicacao
- [ ] Delivery broadcast-first (Supabase Broadcast como canal primario)
- [ ] IDs unicos por deteccao com reconciliacao no reconect
- [ ] Streaming WebRTC via MediaMTX (substituir HLS)
- [ ] Migracao de workers para VPS com Docker
- [ ] Threshold inteligente baseado em historico expandido

### Out of Scope

- Procesamento client-side (TensorFlow.js/ONNX) — complexidade desnecessaria, server-side funciona
- Pusher/Soketi proprio — Supabase Broadcast ja atende, menos infra
- App mobile nativo — web-first
- Multiplos modelos de ML em ensemble — YOLOv8 nano e suficiente

## Context

**Analise do concorrente Palpitano (referencia):**
- Usa Pusher WebSocket para delivery instantaneo (~100ms)
- WebRTC via MediaMTX para video com ~1s latencia
- IDs unicos por deteccao (`initialCarsCountUniqueIds`) para reconciliacao
- Overlays renderizados server-side nos frames
- Backend Laravel/PHP com Oracore, Pusher auto-hospedado

**Stack atual do Winify:**
- Frontend: Next.js (App Router) + Supabase Realtime
- Worker: Python (YOLOv8 + Deep SORT) no Modal.io
- DB: Supabase (PostgreSQL) com postgres_changes
- Video: HLS via MediaMTX (6-30s latencia)
- Infra: Modal.io (serverless) com cron de health check

**Problemas identificados no counter.py:**
1. Sem verificacao de direcao — conta veiculos em ambas direcoes
2. Frame skipping (2/3 frames) pode perder veiculos rapidos
3. Deep SORT reatribui IDs apos oclusao = contagem duplicada
4. Tolerancia fixa em pixels nao se adapta a resolucao/velocidade
5. Broadcast fire-and-forget (`except: pass`)
6. Reset do tracker na transicao de round perde veiculos no limite

## Constraints

- **Cameras**: Comecar com 1-3 cameras, escalar depois para 13+
- **Infra**: Migrar de Modal.io para VPS com Docker (custo previsivel, mais estavel 24/7)
- **Realtime**: Supabase Broadcast como canal primario (ja temos Supabase)
- **Video**: WebRTC via MediaMTX (ja usado no HLS, so trocar protocolo)
- **ML**: Manter YOLOv8 nano (leve, suficiente para contagem)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Broadcast-first ao inves de postgres_changes | Latencia ~100ms vs 100-300ms, nao sobrecarrega DB | — Pending |
| WebRTC (WHEP) ao inves de HLS | Latencia ~1s vs 6-30s, MediaMTX ja suporta | — Pending |
| VPS + Docker ao inves de Modal.io | 24/7 dedicado, custo previsivel, mais controle | — Pending |
| Manter Supabase Broadcast (nao Pusher) | Ja temos Supabase, menos infra para gerenciar | — Pending |
| Prioridade: contagem precisa primeiro | Contagem errada invalida apostas — core do produto | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after initialization*
