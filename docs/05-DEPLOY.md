# 🚀 Deploy do Sistema

Passo a passo completo pra subir tudo do zero.

---

## Pré-requisitos

- Conta gratuita no **Supabase**
- Conta gratuita no **Railway** (com GitHub conectado)
- Conta gratuita no **Vercel** (com GitHub conectado)
- Conta no **Mercado Livre** com afiliado aprovado
- Conta no **IPRoyal** com pelo menos $5 de saldo
- 1 chip de WhatsApp dedicado (NÃO o pessoal)

---

## 1. Banco (Supabase) — 5 min

1. Vai em https://supabase.com → **New project**
2. Preenche:
   - Name: `wpp-bot`
   - DB Password: gera uma forte e **anota**
   - Region: **South America (São Paulo)**
3. Aguarda provisionar (~2 min)
4. **Settings → Database → Connection string**
5. Copia:
   - **Transaction pooler** (porta 6543) → `DATABASE_URL`
   - **Direct connection** (porta 5432) → `DIRECT_URL`

---

## 2. Proxy (IPRoyal) — 3 min

1. Vai em https://iproyal.com/residential-proxies
2. Compra **Residential proxy** (Pay-as-you-go, ~$12/2GB)
3. No dashboard, pega:
   - Host: `geo.iproyal.com`
   - Port: `12321`
   - Username: `<random>`
   - Password: define **sem** `_country-br` (o código adiciona depois)

---

## 3. Mercado Livre — 5 min

### App OAuth
1. Vai em https://developers.mercadolibre.com.ar/devcenter
2. **Create application**
3. Preenche:
   - Name: `wpp-bot`
   - Description: qualquer
   - **Redirect URI:** `https://grupo-wpp-production.up.railway.app/auth/ml/callback`
4. Anota:
   - **App ID** → `ML_APP_ID`
   - **Secret Key** → `ML_CLIENT_SECRET`

### Affiliate ID
1. Vai em https://www.mercadolivre.com.br/afiliados
2. **Perfil** → copia seu tag (ex: `sira7639838`)
3. Esse será `ML_AFFILIATE_ID`

---

## 4. Repositório GitHub — 2 min

```bash
git clone https://github.com/rayansl0302/grupo-wpp.git
cd grupo-wpp
```

Ou fork o repo e clone o seu próprio.

---

## 5. Backend (Railway) — 10 min

### Cria projeto
1. https://railway.app → **+ New Project**
2. **Deploy from GitHub repo** → seleciona `grupo-wpp`
3. Vai começar a buildar (vai falhar — falta config)

### Configura
1. **Settings → Source → Root Directory** = `apps/api`
2. **Settings → Networking → Generate Domain** → porta `3333`
   - Copia a URL gerada (ex: `grupo-wpp-production.up.railway.app`)

### Volume (CRÍTICO)
3. No canvas, **clica com botão direito no serviço → New Volume**
4. **Mount path:** `/app/sessions`
5. Size: 1 GB suficiente

### Variáveis
6. **Variables → Raw Editor** → cola (preenchendo com seus valores):

```env
NODE_ENV=production
APP_SECRET=<gere com node crypto>

DATABASE_URL=<copiado do Supabase, com ?pgbouncer=true>
DIRECT_URL=<copiado do Supabase, porta 5432>

ML_APP_ID=<seu>
ML_CLIENT_SECRET=<seu>
ML_AFFILIATE_ID=<seu tag>
ML_AFFILIATE_SITE_ID=MLB
ML_REDIRECT_URI=https://<URL DO RAILWAY>/auth/ml/callback
REQUIRE_OFFICIAL_LINK=true

PROXY_HOSTNAME=geo.iproyal.com
PROXY_PORT=12321
PROXY_USERNAME=<seu>
PROXY_PASSWORD=<senha base sem _country>

URL_SHORTENER=none

DELAY_MIN_MS=8000
DELAY_MAX_MS=25000
DAILY_POST_LIMIT=50

ADMIN_EMAIL=admin@wppbot.com
ADMIN_PASSWORD=<forte>
JWT_EXPIRES_IN=7d

CORS_ORIGIN=*
```

> `CORS_ORIGIN=*` por enquanto. Restringe depois pra URL do Vercel.

### Migration do banco
A primeira vez é manual:

```powershell
cd apps/api
cp .env.example .env
# preenche o .env LOCAL com DATABASE_URL do Supabase
npx prisma db push
npx tsx prisma/seed.ts
```

Isso cria as tabelas e o usuário admin.

### Confirma deploy
1. Aguarda o build no Railway (~5-8 min)
2. Status deve ficar **ACTIVE**
3. Testa: `https://<URL DO RAILWAY>/health`
4. Deve retornar: `{"status":"ok",...}`

---

## 6. Frontend (Vercel) — 3 min

1. https://vercel.com/new
2. **Import** o repo `grupo-wpp`
3. Configura:
   - **Framework Preset:** Vite
   - **Root Directory:** `apps/dashboard`
   - **Build Command:** `npm run build` (default)
4. **Environment Variables:**
   - Name: `VITE_API_URL`
   - Value: `https://<URL DO RAILWAY>` (sem barra final)
5. **Deploy**
6. Aguarda ~2 min → vai gerar `https://grupo-wpp.vercel.app`

### Atualiza CORS no Railway
Agora que tem a URL do Vercel:
- Railway → Variables → `CORS_ORIGIN` = `https://grupo-wpp.vercel.app`

---

## 7. Conecta WhatsApp — 2 min

1. Abre o dashboard: `https://grupo-wpp.vercel.app`
2. Login: `admin@wppbot.com` / senha do `ADMIN_PASSWORD`
3. **Grupos → Conectar**
4. Digita nome (ex: `principal`)
5. Aguarda QR Code aparecer
6. **No celular** com chip dedicado: WhatsApp → Aparelhos conectados → escanear
7. Status muda pra **🟢 Conectado**

---

## 8. Conecta OAuth Mercado Livre — 1 min

1. Dashboard → **Configurações**
2. Card **"Conexão com Mercado Livre"** → **Conectar**
3. Vai abrir aba do ML pra autorizar
4. Autoriza
5. Status no card vira ✅ conectado

---

## 9. Captura sessão do painel (link oficial) — 5 min

> Apenas se quiser links `meli.la/XXX` em vez de `matt_word=...`

No seu PC (LOCAL):
```powershell
cd apps/api
npx tsx scripts/capture-ml-session.ts
```

1. Chrome abre
2. Faz login no ML
3. Vai pra `mercadolivre.com.br/afiliados`
4. Volta no terminal → **Enter**
5. Abre `ml-session.base64.txt`
6. Copia tudo
7. **Railway → Variables** → adiciona:
   - Name: `ML_STORAGE_STATE`
   - Value: (cola base64)

---

## 10. Cadastra grupos no WhatsApp — 2 min

1. Cria grupos no WhatsApp do celular
2. Manda qualquer mensagem em cada um
3. Dashboard → **Grupos → Buscar grupos** (botão ao lado da sessão)
4. Modal abre com lista de TODOS seus grupos
5. **Adicionar** nos que quiser

---

## 11. Cria primeira campanha — 3 min

1. Dashboard → **Campanhas → + Nova campanha**
2. Preenche:
   - Nome: `📱 Tech & Eletrônicos`
   - Keywords: (cola lista de keywords)
   - Desconto mín: `0`
   - Cron: escolhe um preset (ex: Tech 9h e 19h)
   - Template: `hype`
   - Grupos: marca o que cadastrou
3. **Criar campanha**

---

## 12. Testa — 1 min

1. Na lista de campanhas, clica no **🧪** (botão amarelo de teste)
2. Aguarda ~30-60s
3. **WhatsApp do grupo** → mensagem deve chegar
4. **Clica no link** → deve abrir o produto correto

---

## ✅ Pronto!

A partir daí, o bot:
- Roda 24/7 no Railway
- Dispara automaticamente nos horários configurados
- Envia produtos com link de afiliado
- Você acompanha tudo pelo dashboard

## 🔄 Próximos passos

- Criar mais campanhas (1 por nicho)
- Cadastrar mais grupos
- Acompanhar métricas no painel ML
- Monitorar aba 🔌 Serviços e 📜 Logs

---

## 📦 Versionamento

Sempre que algo importante mudar, criamos uma tag:

```bash
git tag -a v1.X-stable -m "descricao"
git push origin v1.X-stable
```

Pra reverter pra uma versão anterior:
```bash
git reset --hard v1.0-stable
git push --force origin main
```
