# ❓ Perguntas Frequentes

---

## Sobre o sistema

### Quanto custa por mês pra rodar?
- **Total: ~R$ 35-40/mês** (~$7-8 USD)
- Railway: $5
- IPRoyal: ~$2 (com cache)
- Resto (Supabase, Vercel, GitHub, ML, TinyURL): grátis

### Pode rodar de graça?
Não completamente. Railway pode ficar grátis nos primeiros $5 de crédito. IPRoyal precisa de saldo (mín ~$5).

### Funciona com Telegram em vez de WhatsApp?
Por enquanto só WhatsApp (Baileys). Telegram está no roadmap (v2.0).

### Posso conectar múltiplos números do WhatsApp?
Sim, o sistema já suporta múltiplas sessões. Crie várias na aba **Grupos**. Cada sessão tem seu próprio QR.

### O ML banir minha conta de afiliado?
Risco baixo se:
- Não comprar nos próprios links
- Não usar volume **muito** alto (>500 vendas/mês de afiliado iniciante pode chamar atenção)
- Não promover de forma abusiva

---

## Sobre WhatsApp

### Vai banir meu número?
Risco existe. Use chip **dedicado** (nunca pessoal). Recomendações:
- Semana 1: máximo 10-15 msgs/dia
- Semana 2-3: 20-30/dia
- Mês 1+: 40-60/dia (limite saudável)
- **Nunca** acima de 100/dia

### Posso usar com WhatsApp Business?
Sim, funciona. Mas **NÃO use o mesmo número** no Business no celular E no Baileys — vai dar conflito.

### Por que não usar a API oficial do WhatsApp Business?
- Custa US$ 0.005-0.10 por mensagem (vira US$ 100-200/mês fácil)
- Precisa aprovação de templates
- Mais burocracia
- Baileys é gratuito mas tem risco de ban

### Como aquecer um número novo?
1. Use ele normalmente por 7 dias (manda msg pra amigos, entra em grupos)
2. Configure no bot com `dailyLimit=10`
3. Aumenta gradualmente nas próximas semanas
4. **Não** dispare 100 msgs no primeiro dia

---

## Sobre o Mercado Livre

### Por que tem que usar proxy residencial?
ML bloqueia (403 Forbidden) IPs de cloud (Railway, AWS, Vercel, etc). Com proxy BR residencial, parece tráfego humano.

### A API oficial não funciona?
A `/sites/MLB/search` retorna 403 mesmo com OAuth válido desde 2025. Por isso usamos crawler.

### O link `matt_word=` paga comissão?
Sim, mas com ressalvas:
- O ML reconhece o tag de afiliado
- Mas **pode** não contabilizar em todos os casos
- Por isso usamos `meli.la/XXX` quando possível (gerado pelo painel autenticado)

### Comissão demora pra cair?
- Vendas aparecem em até 48h no painel
- Pagamento é mensal (até dia 15 do mês seguinte)
- Tem valor mínimo (R$ 50)

### Como ver quanto estou ganhando?
https://www.mercadolivre.com.br/afiliados/metricas

---

## Sobre custos do IPRoyal

### Por que escolher residencial e não datacenter?
- ML bloqueia IPs de datacenter facilmente
- Residencial parece um usuário comum brasileiro
- Custo só ~3x maior

### Como economizar banda?
Já fazemos:
- Cache de 2h por keyword (~70% economia)
- Bloqueio de imagens/CSS/fontes no Playwright
- IP rotativo evita IPs marcados pelo ML

### Quanto tempo dura 2 GB?
Com cache: **2-3 meses** de uso normal (8 campanhas/dia, ~50 MB diário)

### Posso usar outro provider?
Sim, qualquer proxy residencial brasileiro funciona. Recomendações:
- **IPRoyal:** ~$5/GB (usado atualmente)
- **Smartproxy:** $7-15/GB
- **Bright Data:** $15+/GB (caro mas premium)
- **PingProxies:** ~$4/GB

Pra trocar: muda `PROXY_HOSTNAME`, `PROXY_PORT`, `PROXY_USERNAME`, `PROXY_PASSWORD` no Railway.

---

## Sobre as campanhas

### Quantas campanhas devo ter?
**Recomendado:** 1 por nicho (Tech, Casa, Fitness, Beleza, Ferramentas, Moda, Games, Pets).

Por quê:
- Cada nicho tem público diferente
- Espalha pelo dia (anti-padrão)
- Variedade no grupo

### Qual o melhor horário?
Os 4 horários de pico do WhatsApp:
- **7-9h** (manhã, café)
- **12-13h** (almoço)
- **18-19h** (saída do trabalho)
- **20-22h** (noite)

Use os presets já configurados.

### Quantos produtos cada execução envia?
- Padrão: até 5 produtos por execução
- Em batches de 2 (com pausa entre)
- Limitado por `dailyLimit` do grupo

### Por que às vezes não envia nada?
Possíveis motivos:
1. Fora da janela 7-23h Brasília
2. `dailyLimit` atingido
3. Cache retornou vazio (filtros muito estritos)
4. Crawler falhou (proxy down)

Aba 📜 Logs mostra o motivo exato.

### Como escolher keywords?
Foque em:
- **Produtos populares:** "fone bluetooth", "air fryer", "robo aspirador"
- **Sazonais:** "ventilador" no verão, "aquecedor" no inverno
- **Categorias amplas:** "smart tv" em vez de "smart tv 55 polegadas samsung"
- Entre 15-25 keywords por campanha (variedade sem dispersão)

Use o **combo sugerido** na documentação como ponto de partida.

---

## Sobre templates de mensagem

### Posso customizar o texto?
Sim, edite `apps/api/src/shared/templates/message.template.ts`:
- 4 layouts (standard, hype, minimal, flash)
- 8 openers ("OFERTA IMPERDÍVEL", "BOMBA DE DESCONTO", etc)
- 6 CTAs ("GARANTA AGORA", "COMPRE JÁ", etc)
- 6 closers ("Promoção limitada!", "Estoque acabando!", etc)

Pode adicionar quantos quiser.

### Por que rotacionar templates?
WhatsApp detecta padrão de spam. Variação automática diminui risco de ban.

### Usar IA pra gerar texto vale a pena?
- Se ativar `useAI=true` na campanha + tem `OPENAI_API_KEY`: GPT gera texto único
- **Vantagem:** mais original
- **Custo:** ~$0.001 por mensagem
- **Recomendação:** começa sem IA, ativa depois pra ver diferença

---

## Sobre links de afiliado

### Por que tem 2 formatos de link?
1. **Oficial:** `https://meli.la/2TpvXYG` (gerado pelo painel)
2. **Manual:** `https://www.mercadolivre.com.br/produto?matt_word=sira7639838`

O oficial é gerado por automação do painel logado. Mais bonito e garantido. O manual é fallback.

### Por que o oficial às vezes falha?
O LinkGenerator usa Playwright pra abrir o painel autenticado. Pode falhar por:
- Sessão expirou (cookies do ML)
- ML mudou seletores (raro)
- Timeout (painel demora)

### `REQUIRE_OFFICIAL_LINK=true` é seguro?
Sim. Se ligado:
- Apenas links `meli.la/XXX` ou `/sec/XXX` são enviados
- Produtos com fallback `matt_word` são descartados
- Bot envia menos mensagens, mas todas garantem comissão

**Trade-off:** se o LinkGenerator está com problema, bot para de enviar.

---

## Sobre dados e privacidade

### Onde os dados ficam?
- Banco: Supabase (servidores EUA)
- Sessões WhatsApp: volume Railway (EUA)
- Logs: Supabase (apaga em 24h)

### Posso usar pra outros usuários (multi-tenant)?
Não atualmente. É single-tenant (1 usuário). Multi-tenant está no roadmap (v2.5).

### LGPD?
Como é uso pessoal e os dados são do próprio usuário/produtos públicos, não há tratamento de dados sensíveis de terceiros.

---

## Quero contribuir / hackear

### Posso fork o repo?
Sim, é privado mas você tem acesso. Recomendo:
1. Fork
2. Branch por feature
3. PR pra `main`

### Quero adicionar Telegram
- Cria módulo `apps/api/src/modules/telegram/`
- Adapta o `campaign.service.ts` pra usar Telegram em vez/além de WhatsApp
- Adiciona tabela `TelegramChannel` similar a `WhatsAppGroup`

### Quero adicionar outro marketplace (Amazon, Shopee)
Similar ao ML:
- Cria módulo `apps/api/src/modules/amazon/` (etc)
- Implementa crawler/scraper
- Sistema de link de afiliado
- Adapta o productService pra agregar de múltiplas fontes

---

## Sobre o futuro

### O bot funciona pra sempre?
Não. ML/WhatsApp podem mudar APIs/detecção a qualquer momento. Periodicamente precisa:
- Atualizar seletores do crawler
- Renovar sessão ML
- Adaptar a mudanças

### Vale a pena migrar pra outra solução?
Hoje, não. Os bots concorrentes vendem essa solução por R$ 500-2000. Você tem o código.

### Posso vender essa solução?
Sim, mas:
- Considerar suporte (vai ter muita dúvida)
- Riscos de ML / WhatsApp banir massivamente
- Multi-tenant precisa ser implementado primeiro
