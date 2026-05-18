# 🔄 Fluxos do Sistema

Detalhamento técnico de cada fluxo importante do bot.

---

## 1. Conexão do WhatsApp (Baileys)

### Quando acontece
- Primeira vez que o usuário cria uma sessão
- Sempre que o número é desconectado (raro)
- Após renovação manual via "Reconectar" no dashboard

### Passo a passo

```
1. Usuário clica "Conectar" no dashboard
2. Frontend chama POST /whatsapp/sessions { name: "principal" }
3. Backend cria registro em WhatsAppSession
4. WhatsAppService.initSession() é chamado
5. Baileys inicia conexão com servidor do WhatsApp
6. Recebe evento 'qr' → salva qrCode no banco
7. Frontend faz polling em GET /whatsapp/sessions/:id/qr
8. Usuário escaneia o QR pelo celular
9. Baileys recebe evento 'open' → salva status=connected
10. Frontend detecta status mudou → fecha modal
11. Sessão fica viva no /app/sessions/{name}/ (volume persistente)
```

### Recuperação após restart

Quando o Railway reinicia (deploy, crash, etc):
1. `server.ts` busca todas sessões com status != 'disconnected'
2. Pra cada uma, chama `whatsappService.initSession(sessionName)`
3. Baileys lê credenciais do volume `/app/sessions/{name}/creds.json`
4. Conecta automaticamente sem QR (porque já estava autenticado)

---

## 2. Crawler de produtos

### Componentes

- **`ml.crawler.ts`** — usa Playwright + proxy BR
- **`ml.service.ts`** — orquestra crawler + API + fallbacks
- **`product.service.ts`** — cache de 2h + persistência

### Cadeia de tentativas

```
fetchAndFilter()
  ├─ 1. Cache check (banco, 2h)
  │   └─ Hit? Retorna do banco (zero banda)
  ├─ 2. Crawler com Playwright + proxy BR
  │   └─ Sucesso? Continua processamento
  ├─ 3. (deprecated) API oficial /sites/MLB/search
  │   └─ Sempre 403 em 2026
  └─ 4. Scrapers públicos (raramente funcionam)
```

### Detalhes do crawler

1. **Proxy rotativo:** cada call gera `session_id` aleatório → IP novo
2. **Browser por request:** novo Chromium a cada chamada (evita `ERR_PROXY_AUTH_UNSUPPORTED`)
3. **Stealth manual:** sobrescreve `navigator.webdriver`, `plugins`, etc
4. **Bloqueia recursos pesados:** imagens, CSS, fontes, trackers → economiza 70% banda
5. **Extração:**
   - Estratégia 1: parsing de `.poly-card` (com preço/desconto/frete)
   - Estratégia 2: JSON-LD fallback (só título/preço/link)
6. **Filtros:**
   - Dedup por MLB-id canônico
   - Descarta `click1.mercadolivre.com.br` (links de ads)
   - Descarta produtos internacionais (China, etc)

---

## 3. Geração de link de afiliado

### Por que é complicado

A API oficial do ML retorna 403 mesmo com OAuth válido. A única forma de gerar `meli.la/XXX` (com hash criptografado que paga comissão garantida) é automatizar o **painel de afiliados**.

### Fluxo do LinkGenerator

```
1. productService chama generateAffiliateLink(productUrl)
2. Lê ML_STORAGE_STATE (base64 dos cookies do painel)
3. Abre Playwright com:
   - Proxy BR (mesmo do crawler)
   - storageState = cookies da sessão ML
4. Navega pra https://www.mercadolivre.com.br/afiliados/linkbuilder
5. Aguarda página final (segue redirects)
6. Encontra a textarea → digita URL do produto
   - Usa "native setter do React" pra disparar eventos (Andes UI)
7. Aguarda botão "Gerar" ficar enabled (até 30s)
8. Clica em Gerar
9. Aguarda link aparecer (5s)
10. Captura via 3 estratégias:
    - input/textarea com valor contendo meli.la ou /sec/
    - <a href> com meli.la ou /sec/
    - regex no texto da página
11. Retorna o link OU null se falhou
```

### Quando cai no fallback (matt_word)

Se `generateAffiliateLink()` retorna null, o productService usa o método manual:
```
https://www.mercadolivre.com.br/{produto}/p/MLB123?matt_tool=affiliate&matt_word=sira7639838&matt_source=wpp_bot
```

Esse link **funciona** pra tracking, mas:
- Mais feio (URL longa)
- ML pode não contabilizar comissão em alguns casos
- Por isso a flag `REQUIRE_OFFICIAL_LINK=true` força só usar links bonitos

---

## 4. Sistema anti-ban

Várias camadas de proteção pra não ser banido pelo WhatsApp.

### Camada 1: Delays aleatórios
- Entre mensagens: 8-25 segundos (`DELAY_MIN_MS` e `DELAY_MAX_MS`)
- Cada execução pega valor random nesse intervalo

### Camada 2: Janela horária
- Só envia entre 7h-23h (horário Brasília)
- Servidor está em UTC mas usa `Intl.DateTimeFormat` pra converter

### Camada 3: Limite diário por grupo
- Cada grupo tem `dailyLimit` (default 20)
- Antes de enviar, conta envios das últimas 24h
- Se passou do limite, pula

### Camada 4: Batches com pausa
- Envia em lotes de 2 produtos
- Pausa 5-15 min entre batches
- Simula comportamento humano

### Camada 5: Backoff exponencial
- Em caso de erro, espera mais antes de tentar
- 1ª falha: 2s · 2ª falha: 4s · 3ª: 8s ... até 60s

### Camada 6: Templates rotativos
- 4 layouts de mensagem (standard, hype, minimal, flash)
- 8 openers diferentes ("OFERTA IMPERDÍVEL", "BOMBA DE DESCONTO", etc)
- 6 CTAs
- 6 closers
- Random a cada envio → mensagens nunca idênticas

### Camada 7: Distribuição temporal
- Múltiplas campanhas com horários diferentes
- Não envia tudo às 9h em ponto
- Espalha pelo dia (07h, 08h, 09h, 10h, 11h, 12h, 13h, 14h, 15h, 16h, 17h, 18h, 19h, 20h, 21h, 22h)

### Camada 8: IP residencial brasileiro
- Crawler usa proxy IPRoyal (BR)
- IP rotativo a cada call
- ML não consegue bloquear o crawler

---

## 5. Cache de produtos

### Por que existe
- Reduz consumo do proxy IPRoyal
- Reduz tempo de resposta
- Evita rate limit do ML

### Como funciona

```
Quando: ANTES do crawler ser chamado

Condições pra cache HIT:
  - params.query existe (tem keyword)
  - Existem >= 5 produtos no banco com:
    - title CONTAINS keyword (case insensitive)
    - fetchedAt >= now - 2h
    - permalink NOT contains 'click1.mercadolivre'
    - permalink contains 'MLB'

Se cache HIT:
  - Filtra produtos já enviados pro grupo
  - Retorna os primeiros N (limit do params)
  - ZERO calls ao proxy

Se cache MISS:
  - Chama crawler normalmente
  - Persiste todos novos produtos no banco
  - Próximas execuções nas próximas 2h reusam
```

### Resultado prático
- Antes: 100% das execuções usavam proxy (~2 MB cada)
- Depois: ~30% das execuções usam proxy
- **Economia:** ~70% de banda

---

## 6. Scheduler (cron)

### Como o node-cron funciona aqui

1. No startup do servidor (`bootstrap()`):
   ```ts
   await schedulerService.loadActiveCampaigns()
   ```
2. Esse método:
   - Busca todas campanhas com `active=true`
   - Pra cada uma, chama `cron.schedule(cronExpr, callback)`
   - O callback executa `campaignService.runCampaign(campaignId)`

3. Quando uma campanha é criada/editada/excluída:
   - `schedulerService.registerCampaign(id, cronExpr)` ou
   - `schedulerService.removeCampaign(id)`

### Lifecycle

```
Boot → carrega campanhas ativas no node-cron
  ↓
Cron dispara no horário configurado
  ↓
runCampaign() → sendToGroup() → envio Baileys
  ↓
Loop até parar manualmente OU campanha desativada
```

---

## 7. Sistema de logs (24h cleanup)

### Estrutura

- **Tabela:** `AppLog`
- **Campos:** id, level, source, message, meta (JSON), createdAt
- **Índices:** createdAt, level, source

### Sources rastreados

| Source | Quando loga |
|---|---|
| `system` | Boot, restart, cleanup |
| `crawler` | Cada extração de produtos |
| `campaign` | Cada envio (sucesso/falha) |
| `linkgen` | Cada geração de link oficial |
| `whatsapp` | Conexões, envios |
| `scheduler` | Execuções automáticas |
| `auth` | Login, OAuth |

### Cleanup automático

```
A cada 1 hora:
  DELETE FROM AppLog WHERE createdAt < now() - 24h
```

Mantém o banco enxuto, evita explosão de dados.

### Como filtrar

Na aba **📜 Logs**:
- Clica em qualquer **chip de level** (info/warn/error/debug)
- Clica em **chip de source** (campaign/linkgen/etc)
- Auto-refresh a cada 10s
