# 🩺 Troubleshooting

Problemas comuns e como resolver.

---

## 🔥 Crítico — Bot completamente parado

### Sintoma: nenhuma mensagem nas últimas horas

1. **🔌 Serviços** — algum em vermelho?
2. **Railway → Deployments** — último deploy está ACTIVE?
3. **📜 Logs** — algum erro recorrente?

#### Causas comuns:
- WhatsApp desconectado → Grupos → Conectar
- Banco Supabase pausado → painel Supabase → Resume
- Limite diário atingido em todos grupos → aguarda meia-noite OU aumenta dailyLimit
- Fora da janela 7h-23h Brasília → aguarda

---

## 📱 Problemas WhatsApp

### "Conta desconectada"

```
Sintoma: status 🔴 Desconectado no dashboard
```

**Causa:** Pode ser:
- Você desinstalou WhatsApp do celular
- Celular sem internet por muito tempo
- Conta foi banida pelo WhatsApp

**Solução:**
1. Grupos → Conectar (gera novo QR)
2. Se conseguir escanear: tudo OK
3. Se WhatsApp dizer "número banido": precisa novo chip

### "Limite diário atingido"

```
Sintoma: Log "Limite diário atingido para o grupo"
```

**Causa:** Grupo já enviou X mensagens hoje (X = `dailyLimit`)

**Solução:**
- Aguarda meia-noite (reset automático)
- OU aumenta limite no dashboard (Grupos → ✏️)

### Conta banida

```
Sintoma: ao escanear QR, WhatsApp diz "número não permitido"
```

**Solução:**
1. **NÃO** tentar com o mesmo chip — pode banir definitivo
2. Conseguir novo chip dedicado
3. Aguardar 24-48h
4. **Reduzir volume drasticamente** (`dailyLimit` = 5-10 nas primeiras 2 semanas)
5. **Mais delays** (`DELAY_MIN_MS=15000`, `DELAY_MAX_MS=45000`)

---

## 🛒 Problemas Mercado Livre

### Link manda pra raiz do ML (mercadolivre.com.br sem produto)

**Causa:** Crawler pegou URL inválida (link de tracking, anúncio)

**Solução:** Já tem filtro automático em `ml.crawler.ts`. Se acontecer:
1. Confere o produto no Histórico (modal de detalhes)
2. Se for `click1.mercadolivre.com.br` no permalink → bug do filtro
3. Reporta pra investigarmos

### Mensagens com `matt_word=` (link manual longo)

**Causa:** `LinkGenerator` falhou — sessão do painel expirou ou ML mudou seletores

**Solução:**
1. Aba 📜 Logs → filtra `linkgen`
2. Olha mensagem de erro:
   - "Sessao ML expirou" → renovar (rodar `capture-ml-session.ts`)
   - "Botao Gerar nunca habilitou" → painel pode ter mudado, abre issue
3. **Workaround:** ativa `REQUIRE_OFFICIAL_LINK=true` no Railway pra parar de enviar links manuais

### Produto chinês chegando

**Causa:** Filtro de internacional não detectou

**Solução:** Já tem filtro em `ml.crawler.ts`. Se acontecer:
- Reporta o produto pra adicionar palavra-chave do filtro
- Workaround temporário: descarta esse produto manualmente

### "Limite diário atingido para o grupo" mas nem mandou

**Causa:** Contador errado, talvez registros antigos

**Solução SQL:**
```sql
-- Vê contagem por grupo nas últimas 24h
SELECT g.name, COUNT(sp.id) as enviados_hoje
FROM "SentPost" sp
JOIN "WhatsAppGroup" g ON g.id = sp."groupId"
WHERE sp."sentAt" >= NOW() - INTERVAL '24 hours'
GROUP BY g.name;
```

---

## 🌐 Problemas de proxy/scraping

### "ERR_PROXY_AUTH_UNSUPPORTED"

**Causa:** IPRoyal teve problema momentâneo OU IP foi banido pelo ML

**Solução:** Já tem retry automático. Se persistir:
1. Verifica banda no IPRoyal
2. Recarrega saldo se necessário
3. Aguarda 10-30 min

### Crawler retorna HTML pequeno (< 50 KB)

**Causa:** ML detectou bot e retornou página de challenge

**Solução:**
1. Verifica se está rotacionando IP (logs `[CRAWLER]`)
2. Aguarda 30-60 min (rate limit temporário)
3. Se persistir, considera ativar ScraperAPI como fallback adicional

### "Sem produtos novos pra enviar"

**Causa:** Filtros muito estritos (minDiscount alto, maxPrice baixo)

**Solução:**
- Edita campanha (✏️)
- Diminui `minDiscount` (0 = sem filtro)
- Aumenta ou remove `maxPrice`
- Desmarca `freeShipping` se estava marcado

---

## 💾 Problemas de banco

### "Cannot find user" no login

**Causa:** Seed não rodou ou usuário foi deletado

**Solução:**
```powershell
cd apps/api
npx tsx prisma/reset-admin.ts
```

### Banco lento

**Causa:** Muitos registros antigos em `AppLog` ou `Product`

**Solução SQL:**
```sql
-- Limpa logs > 7 dias (sistema já faz 24h, mas pode reforçar)
DELETE FROM "AppLog" WHERE "createdAt" < NOW() - INTERVAL '7 days';

-- Limpa produtos não-enviados > 30 dias
DELETE FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "SentPost" WHERE "productId" = p.id)
AND "fetchedAt" < NOW() - INTERVAL '30 days';
```

### Migration falhou

**Causa:** Schema fora de sync

**Solução:**
```powershell
cd apps/api
npx prisma db push  # força sync
```

⚠️ Se for ambiente de produção, sempre fazer backup antes.

---

## 🚀 Problemas de deploy

### Railway: build failed

**Causa típica:** TypeScript erro ou dependência faltando

**Solução:**
1. Railway → Deployments → último → **View logs**
2. Procura linha `error TS` ou `Cannot find module`
3. Conserta no código, push de novo

### Railway: healthcheck failed

**Causa:** App não responde em `/health` no tempo

**Solução:**
1. Verifica se `process.env.PORT=3333` está setado
2. Confere logs do deploy
3. Se for primeira vez, aumenta `healthcheckTimeout` no `railway.json`

### Vercel: 404 ao recarregar página

**Causa:** SPA sem rewrite

**Solução:** Já tem `vercel.json` na pasta `apps/dashboard/`. Se ainda assim:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Vercel: build failed

**Causa típica:** Variável `VITE_API_URL` não setada

**Solução:**
1. Vercel → Settings → Environment Variables
2. Adiciona `VITE_API_URL` com URL do Railway
3. Redeploy

---

## 🔐 Problemas de autenticação

### "Credenciais inválidas" no login

**Causa:** Senha errada ou hash desatualizado

**Solução:**
```powershell
cd apps/api
npx tsx prisma/reset-admin.ts
```
Reseta o admin com senha `admin123` (configurável via env).

### "Token expirado" no dashboard

**Causa:** JWT venceu (7 dias)

**Solução:** Logout → login novamente.

### "CORS error" no console do navegador

**Causa:** `CORS_ORIGIN` no Railway não bate com URL do Vercel

**Solução:**
- Railway → Variables → `CORS_ORIGIN` = URL completa do Vercel (sem barra final)
- OU `CORS_ORIGIN=*` (menos seguro mas funciona)

---

## 🐛 Debug avançado

### Ver logs em tempo real

**Railway:**
- Dashboard Railway → grupo-wpp → Deploy Logs
- Mostra `console.log` em tempo real

**Dashboard interno:**
- Aba 📜 Logs
- Filtra por source/level
- Auto-refresh a cada 10s

### Testar endpoint manualmente

```bash
# Status do servidor
curl https://grupo-wpp-production.up.railway.app/health

# Login (pega token)
curl -X POST https://grupo-wpp-production.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wppbot.com","password":"admin123"}'

# Lista campanhas (com token)
curl https://grupo-wpp-production.up.railway.app/campaigns \
  -H "Authorization: Bearer <token>"
```

### Forçar redeploy manual no Railway

1. Deployments → último deploy
2. **⋯** → **Redeploy**
3. Espera ~5 min

### Reverter pra versão estável

```bash
git reset --hard v1.2-stable
git push --force origin main
```

Railway detecta o push e faz redeploy.

---

## 📞 Quando pedir ajuda

Inclua sempre nas perguntas:
1. **Sintoma exato** (print preferível)
2. **Logs relevantes** (aba 📜 Logs ou Railway Deploy Logs)
3. **O que tentou** já fazer
4. **Última mudança** no sistema (campanha nova, deploy, etc)
