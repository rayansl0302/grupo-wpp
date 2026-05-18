# 📚 Documentação Completa — WPP Bot Afiliados ML

Bem-vindo à documentação técnica do sistema. Aqui está tudo que você precisa pra entender, deployar e manter o bot.

---

## 📖 Índice

### Para começar
- **[../README.md](../README.md)** — Visão geral rápida (start aqui)
- **[01-ARCHITECTURE.md](01-ARCHITECTURE.md)** — Como o sistema é organizado

### Operação
- **[02-SERVICES.md](02-SERVICES.md)** — Serviços externos (Supabase, Railway, IPRoyal, etc)
- **[03-FLOWS.md](03-FLOWS.md)** — Fluxos detalhados (crawler, link gen, anti-ban)
- **[04-ENV-VARS.md](04-ENV-VARS.md)** — Todas as variáveis de ambiente

### Setup e operação
- **[05-DEPLOY.md](05-DEPLOY.md)** — Deploy completo do zero
- **[06-MAINTENANCE.md](06-MAINTENANCE.md)** — Manutenção diária/semanal/mensal
- **[07-TROUBLESHOOTING.md](07-TROUBLESHOOTING.md)** — Problemas comuns

### Histórico
- **[../CHANGELOG.md](../CHANGELOG.md)** — Histórico de versões

---

## 🚀 Fluxos rápidos por tarefa

### "Quero deployar do zero"
1. Lê [05-DEPLOY.md](05-DEPLOY.md)
2. Configura todos os serviços externos
3. Cola variáveis no Railway
4. Conecta WhatsApp
5. Cria primeira campanha

### "Quero entender como funciona"
1. Lê [01-ARCHITECTURE.md](01-ARCHITECTURE.md) (visão geral)
2. Lê [03-FLOWS.md](03-FLOWS.md) (detalhes)

### "Bot parou de funcionar"
1. Lê [07-TROUBLESHOOTING.md](07-TROUBLESHOOTING.md)
2. Verifica aba 🔌 Serviços do dashboard
3. Olha aba 📜 Logs

### "Quero adicionar nova feature"
1. Lê [01-ARCHITECTURE.md](01-ARCHITECTURE.md) pra entender estrutura
2. Cria branch em git
3. Implementa
4. Testa local
5. PR pra main

### "Sessão do ML expirou"
1. Lê [06-MAINTENANCE.md](06-MAINTENANCE.md) → "Renovar sessão do painel ML"
2. Roda `capture-ml-session.ts` no PC
3. Atualiza `ML_STORAGE_STATE` no Railway

### "Quero adicionar serviço novo"
1. Adiciona variável em [04-ENV-VARS.md](04-ENV-VARS.md)
2. Configura no Railway
3. Adiciona ao health check em `services.routes.ts`
4. Atualiza [02-SERVICES.md](02-SERVICES.md)

---

## 🎯 Convenções

### Versionamento

- **MAJOR.MINOR-stable** — versões testadas em produção
  - Ex: `v1.0-stable`, `v1.2-stable`
- **MAJOR.MINOR-pre** — em desenvolvimento

### Commits

Formato: `tipo(escopo): descrição`

Tipos:
- `feat` — feature nova
- `fix` — bug fix
- `refactor` — refatoração sem mudança de comportamento
- `docs` — apenas documentação
- `perf` — melhoria de performance
- `chore` — manutenção (deps, build, etc)

Exemplos:
```
feat(crawler): adiciona filtro de produtos internacionais
fix(linkgen): native setter do React resolve botão disabled
docs: README completo + CHANGELOG
```

### Branches

- `main` — produção (auto-deploy)
- `develop` — staging (futuro)
- `feature/nome` — features
- `fix/nome` — correções

---

## 💬 Suporte

- **Issues:** https://github.com/rayansl0302/grupo-wpp/issues
- **Mantenedor:** Rayan SL — rayansl.dev@gmail.com

---

## 📜 Licença

Privado · Todos os direitos reservados.
