# 🤖 WPP Bot — Afiliados Mercado Livre

Bot SaaS completo de divulgação automática de produtos do Mercado Livre em grupos do WhatsApp.

**Status:** ✅ Produção · `v1.2-stable`

---

## ⚡ TL;DR

- 🤖 Bot envia produtos do ML em grupos de WhatsApp 24/7
- 💰 Link de afiliado oficial (`meli.la/XXX`) com comissão garantida
- 📊 Dashboard completo (campanhas, grupos, métricas, logs)
- 🛡️ Anti-ban: delays, rotação de IP, templates rotativos
- 🌐 100% na nuvem (Railway + Vercel + Supabase)
- 💵 Custo total: **~R$ 35/mês**

---

## 📚 Documentação Completa

Toda a documentação técnica está na pasta **[docs/](docs/)**:

| Documento | Sobre |
|---|---|
| **[docs/README.md](docs/README.md)** | Índice da documentação |
| **[docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md)** | Arquitetura do sistema |
| **[docs/02-SERVICES.md](docs/02-SERVICES.md)** | Serviços externos detalhados |
| **[docs/03-FLOWS.md](docs/03-FLOWS.md)** | Fluxos do bot (crawler, link-gen, etc) |
| **[docs/04-ENV-VARS.md](docs/04-ENV-VARS.md)** | Todas as variáveis de ambiente |
| **[docs/05-DEPLOY.md](docs/05-DEPLOY.md)** | Deploy completo do zero |
| **[docs/06-MAINTENANCE.md](docs/06-MAINTENANCE.md)** | Manutenção periódica |
| **[docs/07-TROUBLESHOOTING.md](docs/07-TROUBLESHOOTING.md)** | Problemas comuns |
| **[docs/08-FAQ.md](docs/08-FAQ.md)** | Perguntas frequentes |
| **[CHANGELOG.md](CHANGELOG.md)** | Histórico de versões |

---

## 🚀 Quick Start

### 1. Setup local pra desenvolvimento

```bash
git clone https://github.com/rayansl0302/grupo-wpp.git
cd grupo-wpp
.\setup.ps1
.\start.ps1
```

Abre http://localhost:5173 — login `admin@wppbot.com` / `admin123`.

### 2. Deploy em produção

Leia **[docs/05-DEPLOY.md](docs/05-DEPLOY.md)** — guia passo a passo (~30 min).

---

## 🏗️ Arquitetura simplificada

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   VERCEL    │ → │   RAILWAY   │ → │  SUPABASE   │
│  Dashboard  │   │  API + Bot  │   │   Banco     │
└─────────────┘   └──────┬──────┘   └─────────────┘
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
        ┌────────┐ ┌──────────┐ ┌──────────┐
        │ IPRoyal│ │ ML Painel│ │ WhatsApp │
        │ Proxy  │ │  + API   │ │  Baileys │
        └────────┘ └──────────┘ └──────────┘
```

Detalhes em **[docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md)**.

---

## 🛠️ Stack

- **Backend:** Node.js 20 · TypeScript · Express · Prisma · Baileys · Playwright
- **Frontend:** React 18 · Vite · Tailwind · React Router
- **Banco:** PostgreSQL 15 (Supabase)
- **Deploy:** Railway (backend) · Vercel (front)
- **Proxy:** IPRoyal Residential (BR)

---

## 📊 Funcionalidades

### Dashboard
- ✅ Painel com métricas (envios, falhas, top produtos)
- ✅ CRUD de campanhas com cron builder visual
- ✅ Gerenciamento de grupos WhatsApp
- ✅ Histórico paginado com modal de detalhes
- ✅ Aba de Serviços (health check de tudo)
- ✅ Aba de Logs (24h, auto-cleanup)
- ✅ Configurações + OAuth ML

### Bot
- ✅ 6 campanhas por nicho pré-configuradas
- ✅ Crawler com proxy residencial BR
- ✅ Geração de link oficial (`meli.la/XXX`)
- ✅ Cache de produtos (2h)
- ✅ 4 templates de mensagem rotativos
- ✅ Anti-ban: 8 camadas de proteção
- ✅ Multi-grupos por campanha

---

## 📜 Licença

Privado · Todos os direitos reservados a Rayan SL.

---

## 🙏 Mantenedor

**Rayan SL** — rayansl.dev@gmail.com
