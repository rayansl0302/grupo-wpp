# 🔧 Manutenção

Tarefas periódicas pra manter o bot saudável.

---

## 📅 Calendário de manutenção

| Periodicidade | Tarefa | Tempo |
|---|---|---|
| **Diário** | Verificar aba 🔌 Serviços | 30s |
| **Semanal** | Olhar 📜 Logs por erros recorrentes | 5min |
| **Quinzenal** | Acompanhar métricas no painel ML | 5min |
| **Mensal** | Renovar sessão ML painel | 5min |
| **Mensal** | Recarregar saldo IPRoyal se necessário | 2min |
| **Mensal** | Verificar saldo Railway | 1min |
| **Trimestral** | Atualizar dependências (npm audit) | 30min |

---

## 🟢 Tarefas diárias

### Verificar saúde dos serviços

1. Abre dashboard
2. Aba **🔌 Serviços**
3. Olha o resumo no topo:
   - **Total / OK / Atenção / Erros**
4. Qualquer card 🔴 (vermelho): clica no painel pra investigar

### Sinais de problema

- WhatsApp **desconectado** → reconectar via QR
- ML OAuth **expirado** → renova automaticamente (refresh_token)
- IPRoyal **sem banda** → recarrega saldo
- Sessão painel **falhando** → renova com `capture-ml-session.ts`

---

## 📊 Tarefas semanais

### Análise de logs

1. Aba **📜 Logs**
2. Filtra por **level: error**
3. Verifica padrões:
   - Muitos `linkgen` errors? Sessão expirou
   - Muitos `crawler` errors? Proxy com problema
   - Muitos `campaign` errors? Filtros muito estritos

### Análise de envios

1. Aba **Histórico**
2. Olha últimos 7 dias:
   - Quantos enviados vs falhas?
   - Quais campanhas performam melhor?
   - Quais grupos estão recebendo mais?

### Ajustes recomendados

Baseado no que viu:
- Aumenta keywords em campanhas com poucos produtos
- Ajusta cron em campanhas com falhas (talvez horário errado)
- Aumenta `dailyLimit` se grupo está saudável
- Reduz se número está com warnings do WhatsApp

---

## 🔄 Renovar sessão do painel ML (mensal)

A sessão dura ~30 dias. Quando expirar:

### Sinais
- Aba 📜 Logs com `linkgen` warnings/errors recorrentes
- Mensagens saindo só com `matt_word` (não `meli.la`)

### Procedimento

```powershell
cd D:\Projetos\grupo_wpp\apps\api
npx tsx scripts/capture-ml-session.ts
```

1. Chrome abre
2. Faz login no ML
3. Vai pra `mercadolivre.com.br/afiliados`
4. Confirma que está logado
5. Volta no terminal → **Enter**
6. Abre `ml-session.base64.txt`
7. Copia tudo (Ctrl+A → Ctrl+C)
8. **Railway → Variables**
9. Edita `ML_STORAGE_STATE` colando novo valor
10. Salva → Railway redeploya automaticamente
11. **Apaga o arquivo local:**
    ```powershell
    del ml-session.json
    del ml-session.base64.txt
    ```

### Validação
- Aguarda redeploy (~5 min)
- Aba 🧪 → executa teste de qualquer campanha
- Aba 📜 Logs → filtra `linkgen`
- Deve aparecer: `Link oficial gerado em Xms`
- Mensagem no WhatsApp com `https://meli.la/XXX`

---

## 💰 Recarregar IPRoyal

### Quando recarregar

- Dashboard mostra < 200 MB restante (20% de 1 GB)
- Ou erros `ERR_PROXY_AUTH_UNSUPPORTED` frequentes

### Como

1. https://dashboard.iproyal.com
2. **Add Funds**
3. Compra mais $5-10 (paga só pelo que usar)
4. Sem mudança de config — usa as mesmas credenciais

---

## 🚨 Procedimentos de emergência

### Bot parou de enviar tudo

1. Verifica **🔌 Serviços** — algum 🔴?
2. Se WhatsApp **🔴 disconectado**:
   - Vai em Grupos
   - Clica **Conectar** na sessão
   - Escaneia QR de novo
3. Se Supabase **🔴**:
   - Vai no painel Supabase
   - Verifica se o projeto está pausado (free tier pausa após 7 dias inativo)
   - Despausa
4. Se Railway **fora**:
   - Vai no painel Railway
   - Confere deploy logs
   - Restart manual se necessário

### Conta WhatsApp banida

1. **NÃO usar mesmo chip de novo** — pode banir definitivo
2. Conseguir novo chip dedicado
3. Aguardar 24-48h
4. Reconectar via dashboard
5. **Reduzir volume** (`dailyLimit` baixo, espalhar mais campanhas)

### ML detectou e bloqueou crawler

Sinais:
- HTML retorna 7-34 KB (página de challenge)
- `ERR_HTTP_RESPONSE_CODE_FAILURE`

Soluções:
1. Verifica se IPRoyal está rotacionando (logs)
2. Aguarda 30-60 min (rate limit temporário)
3. Se persistir, recarrega IPRoyal pra ter IPs novos

### Banco lotou (Free 500 MB)

1. Limpar `AppLog` antigo:
   ```sql
   DELETE FROM "AppLog" WHERE "createdAt" < NOW() - INTERVAL '7 days';
   ```
2. Limpar `Product` muito antigo (não enviados):
   ```sql
   DELETE FROM "Product" WHERE id NOT IN (SELECT "productId" FROM "SentPost") AND "fetchedAt" < NOW() - INTERVAL '30 days';
   ```
3. Considera upgrade do Supabase ($25/mês = 8 GB)

---

## 🛠️ Atualização de dependências

### Quando

A cada 3 meses ou quando há vuln crítica reportada.

### Como

```powershell
cd apps/api
npm outdated
npm audit
npm update  # atualizações compatíveis
```

⚠️ **Não** atualizar major versions sem testar (especialmente Baileys, Prisma).

Pra major:
```powershell
npm install @prisma/client@latest prisma@latest
```

Sempre testar local antes de pushar.

---

## 📦 Backups

### Banco (Supabase)
- Free tier: backup automático diário
- Pra restaurar: painel Supabase → Database → Backups

### Volume Railway (sessões WhatsApp)
- Volume persiste entre deploys
- Mas se deletar o serviço, perde
- **Recomendação:** manter sessão simples, reconectar é rápido

### Código
- Tudo no GitHub
- Tags estáveis (`v1.0`, `v1.2`) marcam pontos seguros pra reverter

---

## 🔐 Rotação de credenciais

### Recomendado a cada 6 meses

1. **APP_SECRET** — gera novo, atualiza no Railway (todos logout)
2. **Database password** — Supabase → Settings → Database → Reset password → atualiza `DATABASE_URL` e `DIRECT_URL`
3. **ML Client Secret** — DevCenter → Regenerate → atualiza `ML_CLIENT_SECRET`
4. **IPRoyal password** — Dashboard IPRoyal → atualiza `PROXY_PASSWORD`
5. **Admin password** — manualmente no banco ou re-rodando seed
