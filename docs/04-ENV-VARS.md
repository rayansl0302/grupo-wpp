# 🔐 Variáveis de Ambiente

Todas as variáveis usadas pelo backend, organizadas por categoria.

---

## ⚙️ Sistema

| Variável | Obrigatória | Valor padrão | Descrição |
|---|---|---|---|
| `NODE_ENV` | ✅ | `development` | `production` em deploy, `development` localmente |
| `PORT` | ✅ | `3333` | Porta da API (Railway usa essa) |
| `APP_SECRET` | ✅ | — | String aleatória 32+ chars pra JWT |

### Como gerar APP_SECRET seguro

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 🗄️ Banco de dados

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | URL do pooler do Supabase (porta 6543, com `?pgbouncer=true`) |
| `DIRECT_URL` | ✅ | URL direta do Supabase (porta 5432) — usada pra migrations |
| `REDIS_URL` | ❌ | Opcional, default `redis://localhost:6379` (não usado atualmente) |

### Exemplo de DATABASE_URL

```
postgresql://postgres.<id>:<senha>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## 🛒 Mercado Livre

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ML_APP_ID` | ⚠️ | App ID do ML (do DevCenter) |
| `ML_CLIENT_SECRET` | ⚠️ | Client Secret do ML |
| `ML_AFFILIATE_ID` | ⚠️ | Seu tag de afiliado (ex: `sira7639838`) |
| `ML_AFFILIATE_SITE_ID` | ❌ | Default `MLB` (Brasil) |
| `ML_REDIRECT_URI` | ⚠️ | URL de callback OAuth — em prod: `https://grupo-wpp-production.up.railway.app/auth/ml/callback` |
| `ML_STORAGE_STATE` | ❌ | Base64 dos cookies do painel ML (pra gerar `meli.la/XXX`) |
| `REQUIRE_OFFICIAL_LINK` | ❌ | `true` pra descartar produtos sem link oficial |

### Como obter

- **App ID + Secret:** https://developers.mercadolibre.com.ar/devcenter
- **Affiliate ID:** https://www.mercadolivre.com.br/afiliados (painel mostra)
- **Storage State:** rodar `npx tsx scripts/capture-ml-session.ts` no PC, copiar `ml-session.base64.txt`

---

## 🌐 Proxy (IPRoyal)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PROXY_HOSTNAME` | ✅ | `geo.iproyal.com` |
| `PROXY_PORT` | ✅ | `12321` |
| `PROXY_USERNAME` | ✅ | Username do IPRoyal |
| `PROXY_PASSWORD` | ✅ | Senha BASE (sem `_country/_city` — código adiciona) |

### Importante

O código **gera session_id aleatório** a cada call, então a senha aqui deve ser **a senha base**, sem `_country-br` nem `_city-saopaulo`. O código já adiciona automaticamente:

```
Senha base no Railway:   cO4JxcI27UFhAKEg
Senha enviada ao proxy:  cO4JxcI27UFhAKEg_country-br_session-abc123_lifetime-10m
```

---

## 🔗 Encurtador

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `URL_SHORTENER` | ❌ | `tinyurl` | Opções: `tinyurl`, `bitly`, `none` |
| `BITLY_TOKEN` | ❌ | — | Apenas se `URL_SHORTENER=bitly` |

### Recomendação

- **Com link oficial funcionando:** `URL_SHORTENER=none` (não dupla-encurtar `meli.la`)
- **Sem link oficial:** `URL_SHORTENER=tinyurl` (encurta o `matt_word`)

---

## 🛡️ Anti-ban

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DELAY_MIN_MS` | ❌ | `8000` | Delay mínimo entre mensagens (ms) |
| `DELAY_MAX_MS` | ❌ | `25000` | Delay máximo entre mensagens (ms) |
| `DAILY_POST_LIMIT` | ❌ | `50` | Limite global de posts/dia |

> **Observação:** o `dailyLimit` POR GRUPO é configurado no dashboard (não em env var).

---

## 🤖 IA (opcional)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | ❌ | Pra gerar mensagens com GPT (campo `useAI` da campanha) |
| `OPENAI_MODEL` | ❌ | Default `gpt-4o-mini` |

Sem essa chave, o bot usa templates rotativos (que já variam bem).

---

## 🔐 Admin do dashboard

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ADMIN_EMAIL` | ❌ | Email do admin (usado pelo seed) |
| `ADMIN_PASSWORD` | ❌ | Senha do admin (usado pelo seed) |
| `JWT_EXPIRES_IN` | ❌ | Default `7d` (validade do token) |

---

## 🌐 CORS (frontend)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `CORS_ORIGIN` | ❌ | `*` | URL do Vercel ou `*` |

Em produção, recomendado restringir:
```
CORS_ORIGIN=https://grupo-wpp.vercel.app
```

---

## 🕷️ ScraperAPI (opcional)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SCRAPER_API_KEY` | ❌ | Key do ScraperAPI (fallback) |

Sem essa, o fallback final é dados mockados.

---

## 📋 Frontend (Vercel)

Apenas 1 variável no Vercel:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | ✅ | URL do Railway (ex: `https://grupo-wpp-production.up.railway.app`) |

---

## 📄 Template completo de .env (backend)

Copia esse modelo, preenche e cola no Railway via **Raw Editor**:

```env
NODE_ENV=production
PORT=3333
APP_SECRET=<gere com node crypto>

DATABASE_URL=postgresql://postgres.<id>:<pwd>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<id>:<pwd>@aws-1-us-west-2.pooler.supabase.com:5432/postgres

ML_APP_ID=<seu app id>
ML_CLIENT_SECRET=<seu secret>
ML_AFFILIATE_ID=sira7639838
ML_AFFILIATE_SITE_ID=MLB
ML_REDIRECT_URI=https://grupo-wpp-production.up.railway.app/auth/ml/callback
ML_STORAGE_STATE=<base64 da sessao, opcional mas recomendado>
REQUIRE_OFFICIAL_LINK=true

PROXY_HOSTNAME=geo.iproyal.com
PROXY_PORT=12321
PROXY_USERNAME=<seu user IPRoyal>
PROXY_PASSWORD=<senha base, sem _country>

URL_SHORTENER=none

DELAY_MIN_MS=8000
DELAY_MAX_MS=25000
DAILY_POST_LIMIT=50

ADMIN_EMAIL=admin@wppbot.com
ADMIN_PASSWORD=<senha forte>
JWT_EXPIRES_IN=7d

CORS_ORIGIN=https://grupo-wpp.vercel.app
```
