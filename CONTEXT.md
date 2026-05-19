# 🧠 Contexto do Projeto

> **Arquivo "memória" do projeto.** Use isso quando voltar depois de um tempo,
> compartilhar com outro dev/IA, ou só lembrar **por que** as coisas foram
> feitas desse jeito.

**Última atualização:** 2026-05-17 · `v1.3-stable`
**Mantenedor:** Rayan SL (rayansl.dev@gmail.com)
**Repo:** https://github.com/rayansl0302/grupo-wpp

---

## 📌 O que é o projeto

Bot SaaS de divulgação automática de produtos de afiliado do Mercado Livre em
grupos do WhatsApp. Inspirado nos bots de promoções comerciais (estilo "Pro
Afiliados"), mas open-source pessoal.

### Por que existe
- Mercado de afiliados ML é rentável (ticket BR e comissão 3-12%)
- Bots comerciais cobram R$ 500-2000/mês
- Stack que dominamos (Node/React) permite construir igual ou melhor

### Estado atual (v1.3)
- ✅ **100% funcional em produção**
- ✅ Rodando 24/7 no Railway
- ✅ Dashboard completo
- ✅ 8 campanhas por nicho ativas
- ✅ Link oficial `meli.la/XXX` gerado via painel autenticado
- ✅ Mensagens chegando no grupo "MELHORES PRECOS DA INTERNET#1"

---

## 🏗️ Arquitetura — decisões e por quê

### 1. Por que Railway + Vercel + Supabase (e não tudo numa VPS)?
- **Railway** ($5/mês) escala vertical sozinho, deploy é git push
- **Vercel** (grátis) tem CDN global, SSL automático
- **Supabase** (grátis) tem PostgreSQL + Auth + backup automático
- **VPS** teria que configurar Docker, nginx, certbot, pm2, backup, etc
- Trade-off: $5/mês a mais → economiza ~20h de DevOps

### 2. Por que Node.js + TypeScript (e não Python/Django)?
- **Baileys** (WhatsApp Web) só existe em JS
- **Playwright** funciona em ambos mas tem mais maturidade em JS
- Tooling de TS é excelente (autocomplete, refactor)
- Vercel/Railway têm suporte first-class pra Node

### 3. Por que Prisma + PostgreSQL (e não Mongoose/MongoDB)?
- Dados são relacionais (Campaign → Group → SentPost)
- Prisma tem migrations declarativas (vs schema-less do Mongo)
- Tipos TypeScript gerados automaticamente
- Supabase oferece Postgres gratuito

### 4. Por que Playwright + proxy residencial (e não API oficial do ML)?
**Resposta longa em [docs/03-FLOWS.md](docs/03-FLOWS.md):**

A API oficial `/sites/MLB/search` foi deprecada em 2025. Mesmo com OAuth
válido retorna 403. **Não tem volta** — o MCP server oficial do próprio ML
removeu essa ferramenta.

A solução é scraping (playwright) + proxy BR residencial. ML detecta IPs
de cloud e bloqueia. Com IP residencial, parece um usuário normal.

### 5. Por que `meli.la/XXX` em vez de `matt_word=` direto?
- `matt_word=sira7639838` **funciona** pra tracking
- Mas ML pode (em casos raros) não contabilizar comissão
- O link `meli.la/XXX` é gerado pelo painel oficial e tem hash criptografado
- Comissão **garantida** com o oficial

Solução: automação do painel logado via Playwright + cookies persistidos.

### 6. Por que cache de produtos (2h)?
- Banda do proxy IPRoyal custa dinheiro (~$5/GB)
- Várias campanhas podem buscar a mesma keyword no mesmo dia
- Cache de 2h reduz 70% do consumo
- ML não atualiza ofertas a cada minuto, 2h é margem segura

### 7. Por que rotação de IP por request?
- ML detecta padrão se mesmo IP fizer 10 requisições em sequência
- IPRoyal permite session_id rotativo no formato:
  `password_country-br_session-{random}_lifetime-10m`
- Cada call gera session_id novo → IP residencial diferente

### 8. Por que dailyLimit baixo (20-30 inicial)?
- WhatsApp pode banir números com volume alto
- Aquecimento gradual: 10/dia (semana 1) → 50/dia (mês 1+)
- Chip dedicado, não pessoal (se banir, prejuízo zero)

---

## 🎯 Decisões técnicas importantes

### Native setter do React (Andes UI)
**Problema:** Botão "Gerar" do painel de afiliados nunca habilitava após
`textarea.fill()` do Playwright.

**Causa:** Andes UI (design system do ML) usa React controlled inputs. O
`fill()` do Playwright dispara KeyboardEvent, mas o React precisa do native
value setter pra detectar mudança.

**Solução:** Em `ml.link-generator.ts`:
```js
const setter = Object.getOwnPropertyDescriptor(textareaPrototype, 'value').set;
setter.call(textarea, url);
textarea.dispatchEvent(new Event('input', { bubbles: true }));
```

### Timezone Brasília
**Problema:** Servidor Railway está em UTC. `new Date().getHours()` retornava
hora UTC, e a janela horária `07-23h` ficava desalinhada.

**Solução:** Em `anti-ban.ts`:
```js
const hourStr = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  timeZone: 'America/Sao_Paulo',
}).format(new Date());
```

### Browser novo por request (vs cached)
**Tentativa inicial:** Cachear browser do Playwright entre requests.

**Problema:** Após primeira chamada, segunda dava `ERR_PROXY_AUTH_UNSUPPORTED`
porque o IPRoyal rotaciona o IP mas a auth do proxy fica stale.

**Solução:** Criar browser novo a cada call. Custo de ~2s extra por request,
mas estabilidade total.

### Dedup canônico de MLB
**Problema:** Mesmo produto aparecia 3x no resultado do crawler (anúncio
normal + recomendado + outro vendedor).

**Solução:** Extrair MLB-id canônico via regex e dedupar:
```js
const idMatch = p.permalink.match(/MLB[A-Z]?-?(\d+)/i);
const canonicalId = idMatch[0].toUpperCase().replace('-', '');
```

Aceita: `MLB123`, `MLB-123`, `MLBU123`, `MLBA123`.

### Filtro de produtos internacionais
**Problema:** ML às vezes mistura produtos da China com "Envio do exterior".
Esses não pagam bem comissão e demoram pra entregar.

**Solução:** No crawler:
```js
const isInternational = el.textContent.toLowerCase().includes('internacional');
```

---

## 🚧 Coisas que NÃO funcionaram (e por quê)

### 1. ML API oficial com `client_credentials`
Pensamos: app autenticado via client_credentials grant deveria acessar
`/sites/MLB/search`.

**Resultado:** 403 mesmo com token válido. ML só permite o flow
`authorization_code` (usuário humano autoriza), e mesmo assim a search
endpoint retorna 403 atualmente.

### 2. Scraping direto sem proxy
**Resultado:** Cloudflare detecta IP de cloud (Railway, AWS) em 1 segundo
e retorna página de challenge (HTML de 7-30 KB com captcha).

### 3. AllOrigins proxy gratuito
Tentamos usar `api.allorigins.win` como fallback.

**Resultado:** Funcionou meia dúzia de vezes, depois começou a retornar 522
(timeout). Pra produção é instável.

### 4. ScraperAPI free trial
**Resultado:** Funciona mas é caro em créditos. 1 request com `render=true`
e `premium=true` consome 25 créditos. 1000 créditos do free trial duram
~40 buscas.

**Mantemos:** Como fallback emergencial se IPRoyal falhar.

### 5. `playwright-extra` + `puppeteer-extra-plugin-stealth`
Camada de compatibilidade pra ter stealth no Playwright.

**Resultado:** Conflitos de versão, instabilidade em produção. Voltamos pro
**Playwright puro** com stealth manual (sobrescrever `navigator.webdriver`,
`plugins`, `languages`).

### 6. Banca de busca via JSON-LD primeiro
Tentamos extrair produtos via JSON-LD estruturado da página.

**Resultado:** JSON-LD não inclui `original_price` nem `discount`. Sai sem
informação de oferta.

**Solução:** Parsing de cards HTML (`.poly-card`) primeiro. JSON-LD vira
fallback se cards não funcionarem.

---

## 🔐 Credenciais e segredos importantes

### Onde estão (NUNCA no Git)
- Variáveis de ambiente no **Railway** (backend) e **Vercel** (front)
- `apps/api/.env` local (no `.gitignore`)

### Lista de segredos críticos
1. `APP_SECRET` (JWT) — único do bot
2. `DATABASE_URL` + `DIRECT_URL` (Supabase) — banco
3. `ML_CLIENT_SECRET` (Mercado Livre app) — OAuth
4. `ML_STORAGE_STATE` (base64 cookies painel ML) — gera meli.la/XXX
5. `PROXY_PASSWORD` (IPRoyal) — proxy residencial
6. `ADMIN_PASSWORD` (dashboard) — login

### Rotação recomendada
- A cada 6 meses
- Imediatamente se houver vazamento

### Backup
- Credenciais devem ser anotadas em um gerenciador de senhas
- Sessão `ML_STORAGE_STATE` precisa renovar a cada ~30 dias

---

## 📊 Métricas atuais (snapshot v1.3)

### Volume
- **6 campanhas ativas** (Tech, Casa, Fitness, Beleza, Ferramentas, Moda)
- **1 grupo cadastrado** ("MELHORES PRECOS DA INTERNET#1")
- **~20 mensagens/dia** sendo enviadas
- **dailyLimit:** 20 (recomendado pra semana 1-2)

### Custos
- Railway: ~$5/mês
- IPRoyal: ~$2/mês (com cache ativo)
- Supabase: grátis
- Vercel: grátis
- **Total: ~$7/mês**

### Performance
- Tempo médio de execução de campanha: ~30-60s
- Tempo de geração de link oficial: ~5-30s
- Hit rate do cache: ~70%

---

## 🛠️ Próximos passos sugeridos (em ordem de prioridade)

### Curto prazo (próximas 2 semanas)
1. **Monitorar** estabilidade do link oficial — a sessão ML pode falhar
2. **Aumentar gradualmente** dailyLimit (20 → 30 → 40)
3. **Cadastrar mais grupos** pra escalar volume sem aumentar risco
4. **Verificar métricas no painel ML** — quantos cliques/vendas

### Médio prazo (próximo mês)
5. **Implementar dashboard de métricas** mais rico (vendas, ROI)
6. **Adicionar webhooks** ML pra atualizar status de vendas em real-time
7. **Múltiplos números WhatsApp** — distribui risco
8. **A/B testing de templates** automático

### Longo prazo (3-6 meses)
9. **Bot Telegram** além do WhatsApp
10. **Multi-marketplace** — Amazon, Shopee, Magalu
11. **Multi-tenant** — vender como SaaS
12. **IA pra escolha de produtos** — escolher os com maior chance de venda
13. **Mobile app** pra gerenciar de fora

---

## ⚠️ Pontos de atenção / riscos

### Técnicos
1. **Painel ML pode mudar** — quebra o LinkGenerator. Mitigação: logs +
   troubleshooting fácil
2. **WhatsApp pode banir** — chip dedicado, aquecimento, volume controlado
3. **IPRoyal pode marcar IPs** — rotação de session_id evita
4. **Supabase free tem 500 MB** — cleanup de logs (24h) já implementado

### Operacionais
5. **Sessão ML expira em ~30 dias** — lembrar de renovar
6. **Cron jobs do Railway** rodam em UTC — código já trata, mas confira
7. **Volume do Railway** persiste sessão Baileys — se deletar serviço,
   perde a sessão

### Comerciais
8. **ML pode mudar termos do programa de afiliados** — sempre revisar
9. **Comissão tem valor mínimo** (R$ 50) pra cair — primeiro mês pode ser
   só "warmup"
10. **WhatsApp tem ToS** que não permite uso comercial via Baileys — risco
    legal se virar negócio

---

## 🧪 Como testar mudanças sem quebrar produção

### Pra mudanças simples (texto, estilo)
1. Push direto pra `main`
2. Vercel/Railway redeployam
3. Se quebrar, `git revert` ou rollback de deploy

### Pra mudanças críticas (crawler, link-gen)
1. Cria branch: `git checkout -b fix/blah`
2. Testa local com `.\start.ps1`
3. Quando funcionar, push pra branch e merge via PR
4. Se quebrar, `git reset --hard v1.3-stable` e force push

### Pra mudanças muito invasivas
1. Backup do banco antes (Supabase → Database → Backups)
2. Testa local com banco de dev
3. Migra schema com `prisma migrate dev` (não `db push`)
4. Deploy em janela de baixo tráfego (madrugada)

---

## 🆘 Resgate de emergência

### Bot parado, dashboard quebrado, vida acabando

1. **Volta pra versão estável:**
   ```bash
   git reset --hard v1.3-stable
   git push --force origin main
   ```
2. **Restart serviços:**
   - Railway → Redeploy
   - Vercel redeploya sozinho ao detectar push

3. **Restaurar banco** (se for o caso):
   - Supabase → Database → Backups → Restore

4. **Se WhatsApp banir:**
   - Conseguir novo chip
   - Reconectar via dashboard
   - Volume baixíssimo (5-10/dia) por 2 semanas

5. **Se ML banir afiliado:**
   - Recurso pelo formulário do programa
   - Aguardar (pode demorar dias)
   - Backup: usar `matt_word` direto (sem painel) enquanto isso

---

## 📞 Contatos importantes

- **Suporte ML Afiliados:** afiliados@mercadolivre.com
- **Suporte IPRoyal:** https://iproyal.com/contact-us
- **Suporte Railway:** https://railway.app/help
- **Suporte Supabase:** https://supabase.com/support

---

## 📚 Onde aprender mais

### Tutoriais oficiais
- **Baileys docs:** https://baileys.wiki/
- **Playwright:** https://playwright.dev/
- **Prisma:** https://www.prisma.io/docs

### Comunidades
- **Discord do ML Developers:** (pesquisar)
- **Reddit r/Mercado_Libre:** discussões sobre afiliados
- **GitHub do Baileys:** issues mostram problemas comuns

---

## 🎓 O que aprendi nesse projeto

1. **Anti-bot é uma arms race** — soluções de hoje quebram em 3 meses
2. **Cache é dinheiro** — 70% economia de banda
3. **Logs persistentes** salvam vidas no debug em produção
4. **Browsers headless** consomem MUITO recurso (Chromium = 200MB RAM)
5. **WhatsApp Baileys é frágil** — sempre tenha plano B
6. **Documentação no código é tão importante quanto o código**
7. **Tags git** facilitam rollback (use sempre `v1.0-stable`, etc)
8. **Painel autenticado** > API oficial em alguns casos

---

## 🤖 Para a próxima IA / dev que pegar esse projeto

Olá! Se você é um desenvolvedor pegando esse projeto, leia:
1. Esse arquivo (CONTEXT.md) primeiro
2. Depois [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md)
3. Depois [docs/03-FLOWS.md](docs/03-FLOWS.md)

Coisas importantes:
- **Não tente** "consertar" a API oficial do ML — ela está deprecada
- **Não remova** o proxy residencial — ML banirá em < 1h
- **Não confie** apenas no `matt_word` — gera o oficial sempre que possível
- **Use as tags estáveis** pra rollback se algo quebrar

Se for uma IA (Claude/GPT/etc), tenta entender o **POR QUE** das decisões
antes de propor mudanças. Muita coisa que parece "estranha" foi resultado
de tentativa e erro.

Boa sorte! 🚀
