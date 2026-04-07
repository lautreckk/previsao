# Roadmap: PALPITEX UI/UX Audit Fixes

**Milestone:** v1.1 — UI/UX Audit
**Created:** 2026-04-07
**Phases:** 4

---

## Phase 1: Data Consistency Fixes
**Goal:** Unificar cálculos financeiros e de performance entre Perfil e Saldos
**Requirements:** DATA-01, DATA-02, DATA-03
**Estimated scope:** Pequeno (queries + componentes de exibição)
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Fix camera predict API stats + backfill migration script
- [ ] 01-02-PLAN.md — Fix Profile page win rate formula + remove fallback stats

### Success Criteria
- Total Apostado mostra mesmo valor no Perfil e em Saldos
- Taxa de acerto é consistente entre abas do Perfil
- Contagem inclui prediction_bets + camera_predictions

---

## Phase 2: Ticker + Navigation Fixes
**Goal:** Corrigir dados zerados no ticker e links errados na homepage
**Requirements:** TICK-01, NAV-01
**Estimated scope:** Médio (API de câmbio + mapeamento de mercados)

### Success Criteria
- Ticker mostra valores reais para USD/BRL, EUR/BRL, EUR/USD
- Cards de mercado na homepage apontam para as câmeras corretas

---

## Phase 3: Legal Pages
**Goal:** Criar páginas de Termos de Serviço e Política de Privacidade
**Requirements:** NAV-02, NAV-03
**Estimated scope:** Pequeno (2 páginas estáticas)

### Success Criteria
- /termos acessível com conteúdo legal básico
- /privacidade acessível com política de privacidade
- Links do footer funcionam e levam às páginas corretas

---

## Phase 4: Text Accent Fixes
**Goal:** Corrigir acentuação em todos os textos hardcoded
**Requirements:** TEXT-01
**Estimated scope:** Grande (muitos arquivos, texto extenso)

### Success Criteria
- Todos os textos visíveis ao usuário têm acentuação correta
- Consistência entre páginas

---

**Total phases:** 4
**Critical path:** Phase 1 → Phase 2 (independentes de 3 e 4)
**Parallelizable:** Phase 3 e Phase 4 podem rodar em paralelo

---
*Created: 2026-04-07*
