# 🏗️ Arquitetura do Sistema

## Visão geral

O **WPP Bot** é um sistema distribuído em **3 ambientes na nuvem** + **1 sessão local opcional** para autenticação de painel:

```
┌────────────────────────────────────────────────────────────────────┐
│                        USUÁRIOS / CLIENTES                          │
│         (acessam o dashboard no navegador, recebem WhatsApp)        │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│                        VERCEL (frontend)                            │
│         React 18 + Vite + Tailwind + React Router                   │
│         https://grupo-wpp.vercel.app                                │
│         Hospedagem: GRÁTIS (Hobby plan)                             │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTPS · JWT
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│                    RAILWAY (backend 24/7)                           │
│         Node 20 + TypeScript + Express + Prisma                     │
│         https://grupo-wpp-production.up.railway.app                 │
│         Hospedagem: ~$5/mês (após créditos iniciais)                │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐    │
│  │  ML Crawler  │ │ Link-Gen ML  │ │   WhatsApp Web Session   │    │
│  │  Playwright  │ │  Playwright  │ │   Baileys + Volume       │    │
│  │  + Proxy BR  │ │  + Cookies   │ │   Persistente            │    │
│  └──────┬───────┘ └──────┬───────┘ └────────────┬─────────────┘    │
│         │                │                       │                  │
│  ┌──────┴────────────────┴───────────────────────┴─────────────┐   │
│  │   Scheduler (node-cron)   ·   Templates   ·   Anti-ban       │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────┬─────────────────┬─────────────────────┬─────────────────┘
          │                 │                     │
          ↓                 ↓                     ↓
   ┌──────────────┐  ┌─────────────────┐   ┌──────────────────┐
   │  IPROYAL     │  │  Mercado Livre  │   │   WhatsApp Web   │
   │  Residential │  │  Painel +       │   │   (sessão real,  │
   │  Proxy BR    │  │  API OAuth      │   │    chip dedicado)│
   │  ~$2/mês     │  │  Gratuito       │   │   Gratuito       │
   └──────────────┘  └─────────────────┘   └──────────────────┘
                              │
                              ↓
                  ┌──────────────────────┐
                  │       SUPABASE       │
                  │  PostgreSQL 15       │
                  │  500 MB grátis       │
                  │  + Backup auto       │
                  └──────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│              PC LOCAL (apenas pra captura inicial)                  │
│  - Script `capture-ml-session.ts` (1x por mês)                      │
│  - Não fica ligado 24/7                                             │
└────────────────────────────────────────────────────────────────────┘
```

---

## Componentes principais

### 1. Dashboard (Vercel)

**Responsabilidade:** Interface administrativa.

- React 18 com Vite
- TailwindCSS pra estilo
- React Router pra navegação
- 7 telas: Dashboard, Campanhas, Grupos, Histórico, Serviços, Logs, Configurações
- Auth via JWT (token salvo em localStorage)
- Sem estado em si — todos os dados vêm da API

### 2. API Backend (Railway)

**Responsabilidade:** Lógica de negócio, integração e WhatsApp.

#### Módulos:

| Módulo | Função |
|---|---|
| `auth` | Login JWT do dashboard |
| `whatsapp` | Sessões Baileys, conexão por QR, envio |
| `campaigns` | CRUD de campanhas + scheduler |
| `mercadolivre` | OAuth, crawler, link generator |
| `products` | Cache de produtos, fetch + persist |
| `dashboard` | Métricas, histórico, top products |
| `services` | Health check dos serviços externos |
| `logs` | Sistema de logs persistentes (24h) |
| `scheduler` | Cron jobs com node-cron |

#### Recursos críticos:

- **Volume persistente** em `/app/sessions/` — guarda credenciais do WhatsApp (Baileys)
- **PORT 3333** exposto pelo Railway
- **Auto-restart** em caso de crash
- **Healthcheck** em `/health` a cada deploy

### 3. Banco de dados (Supabase)

**Responsabilidade:** Persistência.

| Tabela | Função |
|---|---|
| `User` | Admin do dashboard (login) |
| `WhatsAppSession` | Sessões conectadas via QR |
| `WhatsAppGroup` | Grupos cadastrados pra receber mensagens |
| `Campaign` | Campanhas configuradas (keywords, cron, filtros) |
| `CampaignGroup` | Vínculos N:N entre Campaign ↔ WhatsAppGroup |
| `Product` | Cache de produtos do ML |
| `SentPost` | Histórico de envios (com mensagem + status) |
| `MLToken` | OAuth do Mercado Livre (access + refresh) |
| `AppLog` | Logs de eventos do sistema (24h auto-cleanup) |
| `Schedule` | Histórico de execuções do cron |

### 4. Proxy residencial (IPRoyal)

**Responsabilidade:** Burlar bloqueio do Mercado Livre.

- IPs residenciais brasileiros rotativos
- Cada request usa um `session_id` único → IP diferente
- Necessário porque o ML bloqueia IPs de cloud (Railway, AWS, etc)

---

## Fluxo de uma campanha agendada

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. Cron dispara (ex: 9h)                                            │
│    └─ Scheduler do node-cron chama campaignService.runCampaign()    │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 2. Verifica janela horária (7h-23h horário Brasília)                │
│    └─ Fora dessa janela: aborta silenciosamente                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 3. Pra cada grupo elegível:                                         │
│    └─ Verifica dailyLimit do grupo                                  │
│    └─ Pega 1 keyword aleatória da lista                             │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 4. Cache check (productService.fetchAndFilter)                      │
│    └─ Já tem produtos < 2h com essa keyword? → reusa                │
│    └─ Senão → chama crawler                                         │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 5. CRAWLER (mlService.searchProducts)                               │
│    └─ Playwright abre Chromium headless                             │
│    └─ Proxy BR com session rotativo                                 │
│    └─ Vai em lista.mercadolivre.com.br/{keyword}                    │
│    └─ Extrai produtos do HTML                                       │
│    └─ Filtra: dedup, internacional, URL inválida                    │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 6. Pra cada produto, gera link de afiliado                          │
│    ├─ Tenta link OFICIAL (meli.la/XXX) via painel autenticado       │
│    │   └─ Abre afiliados/linkbuilder em novo browser                │
│    │   └─ Cola URL, clica "Gerar", captura link                     │
│    │   └─ Se REQUIRE_OFFICIAL_LINK=true e falhar → descarta produto │
│    └─ Senão: fallback matt_word=sira7639838 + encurta TinyURL       │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 7. Persiste produto no banco (upsert por mlId)                      │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 8. Pra cada produto válido:                                         │
│    ├─ Monta mensagem com template rotativo (8 openers, 6 CTAs)      │
│    ├─ Aguarda delay aleatório 8-25s (anti-ban)                      │
│    ├─ Envia via Baileys (imagem + caption)                          │
│    └─ Registra em SentPost                                          │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────┐
│ 9. Pausa 5-15 min entre batches de 2 produtos                       │
└──────────────────────────┬─────────────────────────────────────────┘
                           ↓
                    [ FIM da execução ]
```

---

## Stack tecnológica

### Backend
- **Runtime:** Node.js 20
- **Linguagem:** TypeScript 5
- **Framework:** Express 4
- **ORM:** Prisma 5
- **WhatsApp:** @whiskeysockets/baileys 6.7+
- **Browser automation:** Playwright 1.40+
- **HTTP:** Axios
- **Logs:** Pino + sistema próprio
- **Validação:** Zod
- **Auth:** jsonwebtoken + bcryptjs
- **Scheduler:** node-cron

### Frontend
- **Framework:** React 18
- **Build:** Vite 5
- **Estilo:** TailwindCSS 3
- **Router:** React Router 6
- **HTTP:** Axios
- **Ícones:** Lucide React

### Banco
- **PostgreSQL 15** (Supabase)
- **Pooler:** PgBouncer (porta 6543) pra runtime
- **Direct:** porta 5432 pra migrations

### DevOps
- **Backend deploy:** Railway (Docker)
- **Frontend deploy:** Vercel
- **CI/CD:** GitHub Actions (auto-deploy ao push em main)
- **Banco:** Supabase managed
- **Logs:** Railway logs + tabela AppLog

### Externos
- **Proxy:** IPRoyal Residential (BR)
- **Marketplace:** Mercado Livre Afiliados
- **Encurtador:** TinyURL (fallback) + meli.la (oficial)
- **Scraping backup:** ScraperAPI
