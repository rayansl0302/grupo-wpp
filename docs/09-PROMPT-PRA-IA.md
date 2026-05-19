# 🤖 Prompt pronto pra colar em chat com IA

Quando precisar pedir ajuda em outra sessão de chat (Claude.ai, ChatGPT, Gemini, etc), copie e cole o texto abaixo no início da conversa. Vai dar contexto suficiente pra IA entender o projeto **sem retrabalho**.

---

## ✂️ COPIE A PARTIR DAQUI

```
Trabalho num projeto chamado "WPP Bot — Afiliados Mercado Livre" e preciso de ajuda.

## SOBRE O PROJETO

Bot SaaS que divulga produtos do Mercado Livre em grupos do WhatsApp, com
painel admin completo. Roda 24/7 na nuvem.

**Stack:**
- Backend: Node 20 + TypeScript + Express + Prisma
- Frontend: React 18 + Vite + Tailwind
- Banco: PostgreSQL (Supabase)
- WhatsApp: @whiskeysockets/baileys (sessão persistente)
- Crawler: Playwright + Chromium + proxy IPRoyal residencial BR
- Deploy: Railway (backend) + Vercel (frontend)
- Repo: https://github.com/rayansl0302/grupo-wpp

## DECISÕES TÉCNICAS IMPORTANTES (não questionar sem entender)

1. **API oficial ML está deprecada** (`/sites/MLB/search` retorna 403 desde 2025)
   → Usamos crawler com proxy residencial brasileiro
2. **Proxy IPRoyal com IP rotativo** (session_id aleatório a cada call)
3. **Link oficial `meli.la/XXX`** gerado via automação do painel autenticado
   (cookies em ML_STORAGE_STATE)
4. **Cache de produtos** por keyword (2h) pra economizar banda do proxy
5. **Anti-ban**: delays 8-25s, janela 7-23h Brasília, dailyLimit por grupo,
   batches, templates rotativos
6. **Browser novo por request** (resolve ERR_PROXY_AUTH_UNSUPPORTED)
7. **Native setter do React** no painel ML (Andes UI controlled inputs)

## ARQUITETURA

VERCEL (front) → RAILWAY (back) → SUPABASE (banco)
                      ↓
            IPRoyal Proxy + ML Painel + WhatsApp Baileys

## ESTADO ATUAL: v1.3-stable

- 6 campanhas ativas por nicho (Tech, Casa, Fitness, Beleza, Ferramentas, Moda)
- 1 grupo WhatsApp cadastrado
- ~20 mensagens/dia sendo enviadas
- Links `meli.la/XXX` funcionando

## ESTRUTURA DE PASTAS

```
apps/
├── api/                    # Backend
│   ├── src/modules/        # Domínios (auth, campaigns, whatsapp, ml, etc)
│   ├── prisma/schema.prisma
│   └── scripts/capture-ml-session.ts
└── dashboard/              # Frontend React
    └── src/
        ├── pages/          # Dashboard, Campaigns, Groups, History, Services, Logs
        ├── components/     # CronBuilder, Sidebar, etc
        └── services/api.ts
```

## VARIÁVEIS DE AMBIENTE CRÍTICAS

- DATABASE_URL / DIRECT_URL (Supabase)
- ML_APP_ID / ML_CLIENT_SECRET / ML_AFFILIATE_ID
- ML_STORAGE_STATE (base64 cookies do painel)
- REQUIRE_OFFICIAL_LINK=true
- PROXY_HOSTNAME / PROXY_USERNAME / PROXY_PASSWORD (IPRoyal)
- APP_SECRET (JWT)

## DOCUMENTAÇÃO COMPLETA NO REPO

- README.md, CONTEXT.md, CHANGELOG.md
- docs/01-ARCHITECTURE.md
- docs/02-SERVICES.md (11 serviços externos)
- docs/03-FLOWS.md
- docs/04-ENV-VARS.md
- docs/05-DEPLOY.md
- docs/06-MAINTENANCE.md
- docs/07-TROUBLESHOOTING.md
- docs/08-FAQ.md

## MINHA DÚVIDA / PROBLEMA AGORA

[ AQUI VOCÊ DESCREVE O QUE PRECISA RESOLVER ]
```

## ✂️ FIM DO PROMPT

---

## 💡 Como usar

### Cenário 1: Pedir ajuda numa dúvida pontual
1. Cola o prompt acima na nova conversa
2. Substitui `[AQUI VOCÊ DESCREVE...]` pela sua dúvida
3. A IA vai responder com contexto completo

### Cenário 2: Compartilhar com um novo dev
1. Cola o prompt num documento ou email
2. Adiciona link do GitHub
3. Dev tem entendimento básico em 5 min

### Cenário 3: Lembrar você mesmo daqui 6 meses
1. Lê o `CONTEXT.md` (mais detalhado)
2. Lê esse prompt (resumo)
3. Tudo volta à mente

---

## 📚 Para contexto MAIS DETALHADO

Se precisar passar **muito** contexto pra IA (ex: refatoração grande):

1. Cola esse prompt acima
2. Cola o `CONTEXT.md` inteiro (393 linhas)
3. Cola o arquivo específico que tá mexendo

Isso dá ~5.000 linhas de contexto — IA vai entender **tudo**.

---

## 🤖 Bonus: prompt curtinho

Se for uma pergunta super simples e não quer poluir o chat:

```
Trabalho num bot afiliados do Mercado Livre. Stack: Node 20 + TS + Prisma
+ Postgres (Supabase) + Baileys (WhatsApp) + Playwright (crawler) + React
no front. Deploy: Railway + Vercel. Usa proxy residencial IPRoyal pra
burlar 403 do ML, e gera link `meli.la/XXX` via automação do painel
autenticado (cookies salvos em env var ML_STORAGE_STATE).

Minha dúvida: [...]
```

Curto mas dá os pontos essenciais.
