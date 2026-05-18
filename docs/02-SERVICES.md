# 🔌 Serviços externos

Todos os serviços que o sistema depende, com seus papéis, custos, planos, validades e como verificar/renovar.

---

## 📊 Resumo dos custos

| Serviço | Plano | Custo mensal |
|---|---|---|
| **Supabase** | Free | R$ 0 |
| **Railway** | Hobby | ~$5 (após créditos) |
| **Vercel** | Hobby | R$ 0 |
| **IPRoyal** | Pay-as-you-go | ~$2 (com cache) |
| **ScraperAPI** | Free trial | R$ 0 |
| **GitHub** | Free | R$ 0 |
| **Mercado Livre** | Afiliado | R$ 0 (você ganha comissão) |
| **WhatsApp** | Pessoal | R$ 0 (chip + dados) |
| **TOTAL** | | **~$7-8 (R$ 35-40)** |

---

## 🏠 INFRAESTRUTURA

### 1. Supabase — Banco PostgreSQL

- **Função:** Persistir todos os dados (usuários, campanhas, produtos, envios, etc)
- **Plano:** Free (500 MB de banco)
- **Onde:** https://supabase.com/dashboard
- **Como verificar:** aba 🔌 Serviços do dashboard
- **Manutenção:**
  - Backup automático diário
  - Quando passar de 70% de uso, considera upgrade ($25/mês = 8GB)
- **Credenciais no Railway:**
  - `DATABASE_URL` (pooler, porta 6543)
  - `DIRECT_URL` (direta, porta 5432, pra migrations)

### 2. Railway — Backend hosting

- **Função:** Roda a API Node.js + WhatsApp + Crawler 24/7
- **Plano:** Hobby ($5/mês após $5 de crédito inicial)
- **Onde:** https://railway.app
- **Recursos críticos:**
  - **Volume** em `/app/sessions/` (5 GB, persiste sessão Baileys)
  - **PORT 3333** com healthcheck em `/health`
  - **Auto-deploy** a cada push em `main`
- **Como verificar:**
  - Dashboard mostra "Active" + uso de CPU/RAM
  - Aba Deployments mostra logs do build e runtime

### 3. Vercel — Frontend hosting

- **Função:** Serve o dashboard React (estático após build)
- **Plano:** Hobby (gratuito, com limites generosos)
- **Onde:** https://vercel.com/dashboard
- **Recursos:**
  - Auto-deploy via GitHub
  - SSL automático
  - CDN global
- **Limitações Hobby:**
  - 100 GB de bandwidth/mês
  - Para esse projeto: usa ~1 GB

### 4. GitHub — Versionamento do código

- **Função:** Repositório git + CI/CD via webhooks
- **Plano:** Free
- **Repo:** https://github.com/rayansl0302/grupo-wpp
- **Branches:**
  - `main` — produção (auto-deploy)
- **Tags estáveis:**
  - `v1.0-stable` — versão inicial
  - `v1.2-stable` — após cron por nicho + link oficial
  - (vai criando à medida que evolui)

---

## 🔌 INTEGRAÇÕES

### 5. WhatsApp via Baileys

- **Função:** Enviar mensagens nos grupos
- **Plano:** Gratuito (uso pessoal)
- **Biblioteca:** `@whiskeysockets/baileys`
- **Como conecta:** QR Code escaneado pelo celular (WhatsApp Web)
- **Sessão persistente:** Volume do Railway em `/app/sessions/`
- **Riscos:**
  - WhatsApp **NÃO permite** uso comercial via Baileys
  - Risco de **banimento do número** se exagerar volume
  - Recomendação: chip dedicado (não pessoal)
- **Manutenção:**
  - Se número for banido: criar nova sessão com outro chip
  - Sessão expira raramente (apenas se desinstalar do celular)

### 6. Mercado Livre — Programa de Afiliados

- **Função:** Marketplace fonte + sistema de comissão
- **Plano:** Gratuito (você ganha % das vendas)
- **Painel:** https://www.mercadolivre.com.br/afiliados
- **Seu ID:** `sira7639838` (configurado em `ML_AFFILIATE_ID`)
- **Como funciona:**
  - Compra feita via seu link → você ganha 1-12% (varia por categoria)
  - Cookie de afiliado dura 60 dias
- **Limites:**
  - Não pode comprar nos próprios links
  - Métricas atualizam até 48h após a venda
- **Métricas:** https://www.mercadolivre.com.br/afiliados/metricas

### 7. IPRoyal — Proxy residencial brasileiro

- **Função:** Burlar bloqueio do ML em IPs de cloud
- **Plano:** Pay-as-you-go (Residential)
- **Onde:** https://dashboard.iproyal.com
- **Custo:** ~$5/GB (2 GB inicial = ~$12.50)
- **Consumo médio:** com cache ativo, ~50 MB/dia = **~1.5 GB/mês**
- **Configuração no Railway:**
  ```
  PROXY_HOSTNAME=geo.iproyal.com
  PROXY_PORT=12321
  PROXY_USERNAME=<seu user>
  PROXY_PASSWORD=<base, sem _country/_city>
  ```
- **Rotação automática:** o código gera `session_id` aleatório a cada call → IP diferente cada vez
- **Como verificar saldo:**
  - Dashboard mostra "Bandwidth Used / Remaining"
  - Aba 🔌 Serviços do bot avisa quando configurado
- **Quando recarregar:** quando passar de 80% do consumo

### 8. TinyURL — Encurtador (fallback)

- **Função:** Encurta links manuais com `matt_word` quando o link oficial falha
- **Plano:** Gratuito (sem auth)
- **API:** `https://tinyurl.com/api-create.php?url=...`
- **Limites:** sem limite documentado, mas pode rate limit
- **Config:** `URL_SHORTENER=tinyurl` no Railway
- **Quando desligar:** quando `REQUIRE_OFFICIAL_LINK=true` → muda pra `URL_SHORTENER=none`

### 9. ScraperAPI — Scraping de backup

- **Função:** Fallback se o IPRoyal falhar
- **Plano:** Free trial (1000 requisições/mês)
- **Onde:** https://dashboard.scraperapi.com
- **Quando é usado:**
  1. IPRoyal falha
  2. Acesso direto retorna < 50 KB (bot detection)
  3. Aí tenta ScraperAPI
- **Config:** `SCRAPER_API_KEY=<sua key>` no Railway
- **Pode desativar:** Sim, é opcional. Sem ele, fallback final é dados mockados.

---

## 🛡️ AUTENTICAÇÃO

### 10. Mercado Livre OAuth (API)

- **Função:** Token oficial pra futuras integrações com API ML
- **Plano:** Gratuito
- **Fluxo:** Authorization Code (você autoriza uma vez, refresh automático)
- **Validade:**
  - `access_token`: 6 horas
  - `refresh_token`: 6 meses (renova auto a cada refresh)
- **Como conectar:**
  1. Configurações no dashboard → "Conectar Mercado Livre"
  2. Faz login no ML, autoriza app
  3. Token salvo na tabela `MLToken`
- **Como verificar:** aba 🔌 Serviços
- **Renovação:** automática via refresh_token
- **Observação:** atualmente usado pouco — a API `/sites/MLB/search` retorna 403 mesmo com token. Mantemos pra suporte futuro.

### 11. Mercado Livre Painel (link oficial meli.la)

- **Função:** Gerar links `https://meli.la/XXX` via automação do painel autenticado
- **Plano:** Gratuito (apenas usa sua conta ML logada)
- **Como funciona:**
  1. Você executa o script `capture-ml-session.ts` no seu PC
  2. Faz login no ML pelo Chrome aberto
  3. Script salva os cookies
  4. Você cola o base64 em `ML_STORAGE_STATE` no Railway
- **Validade:** ~30 dias (cookies do ML)
- **Renovação manual:** rodar script novamente quando expirar
- **Como verificar:**
  - Aba 🔌 Serviços diz "Sessão ativa" se a variável existe
  - Aba 📜 Logs com filtro `linkgen` mostra se está gerando ou falhando
- **Critério de saúde:**
  - 🟢 Verde: gera `meli.la/XXX` em 5-30s
  - 🟡 Amarelo: às vezes falha (timeout, painel mudou)
  - 🔴 Vermelho: nunca consegue → sessão expirou, renovar
