# CLAUDE.md — Instruções para Claude Code

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Mantém o contexto do projeto entre conversas.

---

## ⚡ Leitura obrigatória

**ANTES de qualquer mudança**, leia nessa ordem:

1. **[CONTEXT.md](CONTEXT.md)** — Memória do projeto, decisões e por quês
2. **[docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md)** — Arquitetura
3. **[docs/03-FLOWS.md](docs/03-FLOWS.md)** — Fluxos críticos
4. **[docs/07-TROUBLESHOOTING.md](docs/07-TROUBLESHOOTING.md)** — Bugs conhecidos

---

## 🧠 Sobre o projeto

**WPP Bot Afiliados ML** — Bot de divulgação automática de produtos do Mercado
Livre em grupos do WhatsApp, com painel admin e link de afiliado oficial.

- **Stack:** Node 20 + TS + Express + Prisma + Baileys + Playwright + React
- **Deploy:** Railway (back) + Vercel (front) + Supabase (banco)
- **Status:** Produção · `v1.3-stable`
- **Custo:** ~R$ 35/mês

---

## 🚨 Coisas que NÃO mudar sem entender

### 1. API oficial do ML está deprecada
- `/sites/MLB/search` retorna **403** mesmo com OAuth válido
- **NÃO tente** "consertar" isso
- Use o **crawler com proxy BR** (já implementado)

### 2. Proxy residencial é obrigatório
- ML detecta IPs de cloud em segundos
- Sem proxy = HTML de 7 KB (challenge page)
- **NÃO remova** `IPRoyal` da pipeline

### 3. `meli.la/XXX` precisa de cookies do painel
- Link oficial **só** é gerado via painel autenticado
- `ML_STORAGE_STATE` (base64 dos cookies) deve estar no Railway
- Usuário renova mensalmente via `scripts/capture-ml-session.ts`

### 4. WhatsApp Baileys é frágil
- **Sessões** ficam no volume `/app/sessions/` (Railway)
- Se deletar, perde tudo
- Volume **NÃO** pode ser deletado por engano

### 5. Anti-ban: 8 camadas
Não remover sem motivo forte:
- Delay 8-25s aleatório
- Janela 7h-23h Brasília
- `dailyLimit` por grupo
- Batches de 2 com pausa
- Backoff exponencial
- Templates rotativos
- Distribuição temporal
- IP residencial rotativo

---

## 🛠️ Convenções de código

### Estrutura de pastas (monorepo)
```
apps/
├── api/          # Backend (Node + Express + Prisma)
│   ├── src/
│   │   ├── modules/      # Domínios (auth, campaigns, whatsapp, etc)
│   │   ├── config/       # env, logger, database
│   │   ├── shared/       # templates, utils
│   │   └── server.ts     # Bootstrap
│   ├── prisma/
│   │   └── schema.prisma
│   └── scripts/          # CLI helpers (capture-ml-session)
└── dashboard/    # Frontend (React + Vite)
    ├── src/
    │   ├── pages/        # Dashboard, Campaigns, Groups, etc
    │   ├── components/   # Reusáveis (CronBuilder, etc)
    │   └── services/     # api.ts (axios)
    └── vercel.json       # rewrites SPA
```

### Padrão de logs
- **console.log** pra debug em deploy (Railway logs)
- **`log.info/warn/error`** do `app-logger.ts` pra logs persistidos (24h)
- Sempre logar **source** (campaign, crawler, linkgen, etc)

### Padrão de commits
```
tipo(escopo): descrição

feat(crawler): adiciona filtro X
fix(linkgen): resolve timeout no botão Gerar
docs: atualiza README
perf: otimiza cache de produtos
```

### Padrão de tags (versionamento)
```
v1.0-stable  → primeiro deploy funcional
v1.2-stable  → cron por nicho + link oficial
v1.3-stable  → services tab + logs tab
```

Sempre criar tag quando algo grande funcionar:
```bash
git tag -a v1.X-stable -m "descrição"
git push origin v1.X-stable
```

---

## 🎯 Como me pedir mudanças

### Para features pequenas
"Adiciona X no Y" → eu implemento direto

### Para features grandes
1. Discutimos primeiro a abordagem
2. Eu mostro plano
3. Você aprova
4. Eu implemento + testo

### Para bugs
1. Você manda os logs (preferível) ou descrição
2. Eu identifico causa
3. Eu corrijo + explico

---

## ⚠️ Coisas que sempre verificar antes de pushar

1. **TypeScript compilando** sem erros
2. **Variáveis novas** documentadas em `docs/04-ENV-VARS.md`
3. **Schema do Prisma** sincronizado se mudou
4. **Templates de mensagem** não quebraram

---

## 🔄 Próximos passos pendentes (v1.4)

- [ ] Métricas reais (cliques, vendas via painel ML)
- [ ] Botão "Limpar cache" no dashboard
- [ ] Múltiplos números WhatsApp (anti-ban escalável)
- [ ] Backup automático do banco

---

## 📞 Mantenedor

Rayan SL · rayansl.dev@gmail.com
