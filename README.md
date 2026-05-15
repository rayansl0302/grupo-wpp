# 🤖 WPP Bot — Afiliados Mercado Livre

Bot completo de afiliados do Mercado Livre que divulga produtos automaticamente em grupos do WhatsApp, com painel administrativo, link de afiliado oficial e anti-ban.

**Status:** ✅ Produção · `v1.2-stable`

---

## 📋 Sumário

- [O que faz](#-o-que-faz)
- [Arquitetura](#-arquitetura)
- [Stack](#-stack)
- [Setup local](#%EF%B8%8F-setup-local)
- [Deploy em produção](#-deploy-em-produção)
- [Como funciona](#-como-funciona-detalhes-tecnicos)
- [Manutenção](#-manutenção)
- [Troubleshooting](#-troubleshooting)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Roadmap](#-roadmap)

---

## ✨ O que faz

- 🔎 **Busca produtos** do Mercado Livre via crawler com proxy residencial brasileiro (Playwright + IPRoyal)
- 🔗 **Gera link de afiliado OFICIAL** (`meli.la/XXX`) via automação do painel de afiliados autenticado
- 💬 **Envia automaticamente no WhatsApp** com templates rotativos (anti-padrão)
- 📅 **Múltiplas campanhas** com horários distintos por nicho (anti-ban)
- 🛡️ **Anti-ban completo:** delays aleatórios, rotação de IP, dedup, filtro internacional
- 🎨 **Dashboard web** completo: campanhas, grupos, histórico, métricas
- 💾 **Cache de produtos** por keyword (2h) — economiza banda do proxy
- 🚀 **24/7 na nuvem** sem precisar do PC ligado

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                       VERCEL (Dashboard)                        │
│  React + Vite + Tailwind                                        │
│  https://grupo-wpp.vercel.app                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS (API calls)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY (Backend 24/7)                       │
│  Node.js + TypeScript + Express                                 │
│  https://grupo-wpp-production.up.railway.app                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Crawler ML  │  │ Link-Gen ML  │  │   WhatsApp Web       │  │
│  │  Playwright  │→ │  Playwright  │  │   Baileys + volume   │  │
│  │  + Proxy BR  │  │  + ML Auth   │  │   persistente        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ↓                 ↓                     ↓
   ┌─────────────┐   ┌─────────────┐      ┌──────────────────┐
   │  IPROYAL    │   │ Mercado     │      │  WhatsApp Web    │
   │  Residential│   │ Livre       │      │  (sessao real)   │
   │  Proxy BR   │   │  Painel     │      │                  │
   └─────────────┘   │  Afiliados  │      └──────────────────┘
                     └─────────────┘
                         │
                         ↓
                ┌──────────────────┐
                │    SUPABASE      │
                │  PostgreSQL      │
                │  (Prisma ORM)    │
                └──────────────────┘
```

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| **Backend** | Node.js 20 · TypeScript · Express · Prisma |
| **Banco** | PostgreSQL (Supabase) |
| **WhatsApp** | @whiskeysockets/baileys (sessão persistente em volume) |
| **Crawler** | Playwright + Chromium headless |
| **Proxy** | IPRoyal Residential (IP brasileiro rotativo) |
| **Frontend** | React 18 · Vite · TailwindCSS · React Router |
| **Auth** | JWT (bot) · OAuth Authorization Code (Mercado Livre) |
| **Deploy** | Railway (backend) · Vercel (front) |
| **Encurtador** | TinyURL (fallback) · Mercado Livre `meli.la` (oficial) |

---

## 🏠 Setup local

### Pré-requisitos
- Node.js 20+
- Conta gratuita Supabase
- Conta Mercado Livre afiliado aprovado
- Conta IPRoyal (Residential Proxy)

### Passos

```powershell
# 1. Clone
git clone https://github.com/rayansl0302/grupo-wpp.git
cd grupo-wpp

# 2. Setup automatico
.\setup.ps1

# 3. Configura variaveis em apps/api/.env
# (copia .env.example e preenche)

# 4. Roda
.\start.ps1
```

Acessa http://localhost:5173 e loga com `admin@wppbot.com / admin123`.

---

## ☁️ Deploy em produção

### 1. Banco — Supabase
1. Cria projeto em https://supabase.com
2. Pega a `DATABASE_URL` (Connection Pooler, porta 6543) e `DIRECT_URL` (porta 5432)

### 2. Backend — Railway
1. Conecta repo `rayansl0302/grupo-wpp` em https://railway.app
2. **Root Directory:** `apps/api`
3. **Volume:** `/app/sessions` (CRÍTICO — persiste sessão WhatsApp)
4. Cola todas as variáveis (ver seção abaixo)
5. **Generate Domain** → porta `3333`

### 3. Frontend — Vercel
1. Importa o mesmo repo em https://vercel.com
2. **Root Directory:** `apps/dashboard`
3. Variável: `VITE_API_URL` = URL do Railway
4. Deploy

### 4. WhatsApp
- No dashboard, vai em **Grupos** → **Conectar** → escaneia QR

### 5. Mercado Livre — Sessão autenticada (link bonito)

Script local que captura cookies pra gerar `meli.la/XXX`:

```powershell
cd apps/api
npx tsx scripts/capture-ml-session.ts
```

Loga no ML, aperta ENTER, copia o `ml-session.base64.txt` e cola no Railway como `ML_STORAGE_STATE`.

> Sessão dura ~30 dias. Quando expirar, basta rodar o script de novo.

---

## 🔬 Como funciona (detalhes técnicos)

### Fluxo de uma execução de campanha

```
1. Scheduler (cron) dispara campanha
   ↓
2. Pega 1 keyword aleatória da lista
   ↓
3. Cache check: já temos produtos dessa keyword < 2h? → reusa
   ↓ (se cache miss)
4. Crawler abre Chromium com proxy BR rotativo
   ↓
5. Acessa lista.mercadolivre.com.br/{keyword}
   ↓
6. Extrai 50-200 produtos do HTML
   - Estrategia 1: parsing de cards (.poly-card)
   - Estrategia 2 (fallback): JSON-LD
   ↓
7. Filtra: dedup, internacional, URL invalida, preço/desconto
   ↓
8. Pra cada produto:
   a. Tenta gerar link oficial via painel autenticado → `meli.la/XXX`
   b. Fallback: monta manual com `matt_word=sira7639838`
   c. Encurta com TinyURL se nao for oficial
   ↓
9. Persiste no Supabase (Product upsert)
   ↓
10. Pra cada grupo elegível:
    - Verifica dailyLimit
    - Verifica horário ativo (timezone Brasília)
    - Monta mensagem com template rotativo (8 openers, 6 CTAs, 6 closers)
    - Aguarda delay aleatório (8-25s)
    - Envia via Baileys
    - Registra em SentPost (dedup futuro)
```

### Templates de mensagem

4 variações rotativas:
- **standard**: layout balanceado, completo
- **hype**: cabeçalho enfático, "economiza R$ X"
- **minimal**: 1-line price com strike
- **flash**: oferta relâmpago

Cada execução escolhe aleatoriamente openers, CTAs e closers. Garante variação visual no grupo.

### Estratégias anti-ban

1. **Delay aleatório 8-25s** entre cada mensagem (`anti-ban.ts`)
2. **Janela horária:** só envia 7h-23h horário de Brasília (`isWithinActiveHours`)
3. **DailyLimit por grupo** (default 10-20 mensagens/dia)
4. **Lotes de 2 produtos** com pausa de 5-15 min entre batches
5. **Backoff exponencial** em caso de erro de envio
6. **Templates rotativos** anti-padrão
7. **Browser separado por request** anti-fingerprinting
8. **IP rotativo** no proxy IPRoyal (session_id aleatório a cada call)
9. **Múltiplas campanhas** com horários distintos (não tudo às 9h)

### Mercado Livre — por que tanta complexidade?

A API oficial `/sites/MLB/search` foi **deprecada em 2025**. Mesmo com OAuth user-token retorna 403.

Estratégia adotada:
- **Busca:** scraping HTML público via proxy BR + Playwright stealth
- **Link de afiliado:** automação do painel logado via cookies persistidos

Ver discussão técnica completa em `docs/architecture-decisions.md` (futuro).

---

## 🔧 Manutenção

### Atualizar sessão ML (~30 dias)

Quando aparecer nos logs `[LINK-GEN] Pagina nao tem textarea ou caiu no login`:

```powershell
cd apps/api
npx tsx scripts/capture-ml-session.ts
```

Loga, aperta ENTER, copia `ml-session.base64.txt`, atualiza `ML_STORAGE_STATE` no Railway.

### Renovar password do proxy IPRoyal

Periodicamente troca no painel IPRoyal e atualiza `PROXY_PASSWORD` no Railway.

### Backup do banco

Supabase faz backup automático grátis. Pra backup manual:
```bash
pg_dump -h $DIRECT_URL > backup.sql
```

### Versões / tags estáveis

```bash
git tag                           # lista versões estáveis
git checkout v1.2-stable          # checkout de versão específica
git reset --hard v1.2-stable      # reverte tudo pra essa versão
```

---

## 🩺 Troubleshooting

### Bot enviou mas link vai pra raiz do ML
- **Causa:** URL do produto sem MLB-id
- **Fix:** já implementado filtro em `ml.crawler.ts` (regex `/MLB[A-Z]?-?\d{5,}/i`)

### Link sai como `tinyurl.com/...` em vez de `meli.la/...`
- **Causa:** sessão ML expirou ou seletores do painel mudaram
- **Fix:** rodar `capture-ml-session.ts` novamente

### "Limite diário atingido para o grupo"
- **Causa:** já mandou `dailyLimit` mensagens hoje
- **Fix:** edita o grupo no dashboard (botão ✏️) e aumenta o limite

### `ERR_PROXY_AUTH_UNSUPPORTED`
- **Causa:** IPRoyal teve soluço momentâneo OU IP foi banido
- **Fix:** já tem retry automático no crawler

### HTML retorna 7-34KB (deveria ser 500KB+)
- **Causa:** ML detectou bot e retornou página de challenge
- **Fix:** já tem rotação de IP por request (session_id aleatório)
- **Se persistir:** aguarda 10-30 min OU recarrega créditos no IPRoyal

### Produtos chineses chegando
- **Causa:** filtro não detectou
- **Fix:** já tem filtro em `ml.crawler.ts` (texto + alt de bandeira)

### Preço errado (mistura De/Por)
- **Causa:** seletor pegando `andes-money-amount__fraction` do riscado
- **Fix:** já implementado em `ml.crawler.ts` (busca container específico)

### "404 NOT_FOUND" ao recarregar página
- **Causa:** SPA sem rewrite
- **Fix:** já tem `vercel.json` com rewrite pra `/index.html`

---

## 🔐 Variáveis de ambiente

### Backend (Railway / `apps/api/.env`)

```env
NODE_ENV=production
PORT=3333
APP_SECRET=<string aleatoria de 32+ chars>

# Banco
DATABASE_URL=<postgresql pooler do Supabase, porta 6543>
DIRECT_URL=<postgresql direta do Supabase, porta 5432>

# Mercado Livre
ML_APP_ID=<seu Client ID>
ML_CLIENT_SECRET=<seu Client Secret>
ML_AFFILIATE_ID=<seu affiliate tag, ex: sira7639838>
ML_AFFILIATE_SITE_ID=MLB
ML_REDIRECT_URI=https://grupo-wpp-production.up.railway.app/auth/ml/callback
ML_STORAGE_STATE=<base64 da sessao do painel ML afiliado>

# Proxy residencial brasileiro
PROXY_HOSTNAME=geo.iproyal.com
PROXY_PORT=12321
PROXY_USERNAME=<usuario IPRoyal>
PROXY_PASSWORD=<senha base, sem _country/_city>

# Anti-ban
DELAY_MIN_MS=8000
DELAY_MAX_MS=25000
DAILY_POST_LIMIT=50

# Auth dashboard
ADMIN_EMAIL=admin@wppbot.com
ADMIN_PASSWORD=<senha forte em producao>
JWT_EXPIRES_IN=7d

# Encurtador (fallback quando link oficial nao gerar)
URL_SHORTENER=tinyurl

# CORS
CORS_ORIGIN=https://grupo-wpp.vercel.app
```

### Frontend (Vercel / `apps/dashboard/.env`)

```env
VITE_API_URL=https://grupo-wpp-production.up.railway.app
```

---

## 🗺️ Roadmap

### v1.2 (atual) ✅
- 6 campanhas por nicho com cron separado
- Botão de teste rápido (1 produto)
- Edição inline de campanhas e grupos
- Cache de produtos por keyword (2h)
- Rotação de IP por request
- Filtro de produtos internacionais
- Link oficial `meli.la` via painel autenticado
- Parsing correto de De/Por/% OFF

### v1.3 — Próximas
- [ ] Métricas reais (cliques, conversões via painel ML)
- [ ] Botão "Limpar cache" no dashboard
- [ ] Múltiplos grupos por campanha (já suporta, falta UI)
- [ ] Backup automático do banco

### v2.0 — Médio prazo
- [ ] Múltiplas contas WhatsApp (anti-ban escalável)
- [ ] Bot Telegram além do WhatsApp
- [ ] Integração com outras affiliate networks (Amazon, Shopee, Magalu)
- [ ] IA pra escolher melhor produto da lista (não aleatório)
- [ ] A/B testing automático de templates

### v2.5 — Longo prazo
- [ ] SaaS multi-tenant (vender pra outros afiliados)
- [ ] App mobile pra gestão
- [ ] Webhooks pra eventos
- [ ] Marketplace de templates

---

## ⚠️ Disclaimer

Esta ferramenta foi desenvolvida para **uso pessoal**. O uso comercial ou em massa pode:
- Violar os termos do Mercado Livre / Programa de Afiliados
- Violar os termos do WhatsApp (uso de Web API não-oficial via Baileys)
- Resultar em banimento do número WhatsApp
- Resultar em suspensão da conta de afiliado

**Use por sua conta e risco.** Recomendado:
- Usar chip dedicado (não pessoal) pra WhatsApp
- Limitar volume diário (10-30 mensagens iniciais)
- Não vender o serviço a terceiros sem revisão jurídica

---

## 📜 Licença

Privado · Todos os direitos reservados a Rayan SL.

---

## 🙏 Agradecimentos

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- [Playwright](https://playwright.dev/) — Browser automation
- [IPRoyal](https://iproyal.com) — Proxies residenciais BR
- [Supabase](https://supabase.com) — Postgres + auth
- [Railway](https://railway.app) + [Vercel](https://vercel.com) — Hosting

---

**Versão:** 1.2-stable
**Última atualização:** 2026-05-15
**Mantido por:** Rayan SL (rayansl.dev@gmail.com)
