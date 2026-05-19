# Changelog

Todas as mudanças notáveis neste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)

---

## [v1.4-stable] — 2026-05-17

### ✨ Adicionado
- **Sistema de cupons completo** (Coupon + SentCoupon no schema)
- **Crawler de cupons** (`mercadolivre.com.br/cupons`) com cache de 6h
- **Template de mensagem de cupom** (com código, loja, desconto)
- **Template de perfil social** do afiliado (link `/social/{username}` com produtos destaque)
- **Campo `contentType`** na Campaign: `product` | `coupon` | `mixed` | `social-profile`
- **Aba 🎟️ Cupons** no dashboard com listagem em grid
- **Histórico unificado** (produtos + cupons na mesma timeline)
- **Filtro por tipo** no histórico (Todos / Produtos / Cupons)
- **Modal de detalhes** suporta cupom também
- **Variável `ML_AFFILIATE_USERNAME`** pra perfil social customizado
- **CLAUDE.md** na raiz pra contexto automático em sessões Claude Code

### ⚙️ Mudado
- `/dashboard/history` agora retorna feed unificado (produtos + cupons)
- `/dashboard/history/:id` detecta tipo automaticamente

---

## [v1.3-stable] — 2026-05-17

### ✨ Adicionado
- **Aba "Serviços"** com health check em tempo real dos 11 serviços externos
- **Aba "Logs"** com auto-cleanup de 24h e filtros por level/source
- **Modal de detalhes** no histórico (preço, links, mensagem, metadata)
- **Edição inline de grupos** via modal (nome + dailyLimit)
- **CronBuilder visual** com 5 modos (preset, minuto-X, cada-X-min, horários, custom)
- **2 novos nichos:** 🎮 Games e 🐶 Pets
- **REQUIRE_OFFICIAL_LINK** env var pra descartar produtos sem link oficial
- **Logs persistentes do LinkGenerator** pra diagnosticar falhas
- **Documentação completa** em `docs/` (8 arquivos)
- **Endpoint /dashboard/history/:id** retorna todos os campos do produto

### 🐛 Corrigido
- `.gitignore` ignorava pasta `apps/api/src/modules/logs/` por padrão `logs/`
- Cache do banco enviando produtos com URL `click1.mercadolivre.com.br`
- Vercel 404 ao recarregar rota SPA (vercel.json com rewrite)
- JSON-LD fallback do crawler também filtra `click1`

### ⚙️ Mudado
- Cron presets agora têm 3 categorias (Nichos / Frequentes / Pacotes)
- Crons frequentes adicionados: 10, 15, 20, 30 min + 3h, 4h, 6h
- Templates de mensagem podem ser editados por campanha

---

## [v1.2-stable] — 2026-05-15

### ✨ Adicionado
- **Cron presets por nicho** no form de campanha (📱 Tech, 🏠 Casa, 💪 Fitness, 💄 Beleza, 🔧 Ferramentas, 👟 Moda)
- **Botão de teste rápido** (🧪) que envia 1 produto aleatório, ignorando dailyLimit e horário ativo
- **Edição inline** de campanhas existentes (botão ✏️ no front + endpoint PATCH no back)
- **Edição inline de grupos** (nome + dailyLimit) via modal
- **Cache de produtos** por keyword (2h) — reusa do banco antes de chamar crawler
- **Rotação de IP** no proxy IPRoyal a cada request (session_id aleatório)
- **Filtro de produtos internacionais** (descarta China, "envio do exterior")
- **Link de afiliado oficial** `meli.la/XXX` via automação do painel autenticado
- **Script local** `scripts/capture-ml-session.ts` pra capturar cookies do painel ML
- **Documentação completa** (README.md, CHANGELOG.md)
- **Vercel SPA rewrite** (vercel.json) — corrige 404 ao recarregar rotas

### 🐛 Corrigido
- Parsing de preço pegando o riscado em vez do atual (mistura De/Por)
- `ERR_PROXY_AUTH_UNSUPPORTED` em chamadas subsequentes (retry automático)
- Dedup de produtos (mesmo produto enviado 2-3 vezes)
- URLs sem MLB-id sendo enviadas (regex `/MLB[A-Z]?-?\d{5,}/i`)
- URLs de tracking `click1.mercadolivre.com.br` enviadas como produto
- Bot detection do ML retornando HTML de 7-34KB (resolvido com IP rotativo)

### ⚙️ Mudado
- Bloqueio agressivo de recursos no Playwright (CSS, fontes, trackers) — economiza 70% banda
- Native setter do React no input do painel (`Object.getOwnPropertyDescriptor`)
- Detecção tripla de disabled (`disabled`, `data-andes-state`, classe CSS)
- Browser novo por request (antes era cacheado e falhava)

---

## [v1.1-pre] — 2026-05-15

### ✨ Adicionado
- OAuth Authorization Code do Mercado Livre
- Endpoint `/auth/ml/start`, `/auth/ml/callback`, `/auth/ml/status`, `/auth/ml/disconnect`
- UI de conexão ML em Configurações
- Tabela `MLToken` no Supabase
- Refresh token automático

### 🐛 Corrigido
- Timezone do servidor (UTC → America/Sao_Paulo via `Intl.DateTimeFormat`)
- ML_REDIRECT_URI usando default localhost em produção (variável não estava sendo lida)
- CORS bloqueando wildcard `*` com credentials: true

---

## [v1.0-stable] — 2026-05-15

### ✨ Adicionado
- Backend Node.js + TypeScript + Express + Prisma
- Banco PostgreSQL via Supabase
- WhatsApp Web via Baileys com sessão persistente em volume
- Dashboard React + Vite + Tailwind
- Deploy Railway (backend) + Vercel (front)
- Sistema de campanhas com cron (node-cron)
- Sistema de grupos com dailyLimit
- Crawler Playwright com proxy residencial brasileiro (IPRoyal)
- Templates rotativos (8 openers, 6 CTAs, 6 closers, 4 layouts)
- Anti-ban: delays aleatórios 8-25s, batches de 2, backoff exponencial
- Histórico de envios
- Métricas básicas no dashboard
- Login JWT
- Hot reload Vite + tsx watch

---

## Versionamento

Este projeto usa [Semantic Versioning](https://semver.org/lang/pt-BR/):

- **MAJOR** (1.x.x → 2.0.0): mudanças incompatíveis
- **MINOR** (1.0.x → 1.1.0): features novas compatíveis
- **PATCH** (1.0.0 → 1.0.1): correções compatíveis

Sufixos:
- `-stable`: pronto pra produção (testado e funcionando)
- `-pre`: em desenvolvimento
- `-rc`: release candidate
