import './config/env'; // valida .env primeiro
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { authRouter, requireAuth } from './modules/auth/auth.routes';
import { mlOAuthRouter } from './modules/mercadolivre/ml-oauth.routes';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes';
import { campaignRouter } from './modules/campaigns/campaign.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { servicesRouter } from './modules/services/services.routes';
import { logsRouter } from './modules/logs/logs.routes';
import { cleanupOldLogs, log } from './modules/logs/app-logger';
import { schedulerService } from './modules/scheduler/scheduler.service';
import { whatsappService } from './modules/whatsapp/whatsapp.service';

async function bootstrap() {
  const app = express();

  // ─── Middlewares globais ─────────────────────────────────────────────────────
  // CORS: aceita qualquer origem por padrao (dev ou prod com "*"); pode restringir via CORS_ORIGIN
  const corsEnv = (process.env.CORS_ORIGIN ?? '*').trim();
  const corsConfig = corsEnv === '*'
    ? { origin: true, credentials: false } // aceita qualquer origem (sem credentials, browser exige isso)
    : { origin: corsEnv.split(',').map((s) => s.trim()), credentials: true };
  app.use(cors(corsConfig));
  app.use(express.json());
  app.use(
    rateLimit({ windowMs: 60_000, max: 100, message: { error: 'Rate limit excedido' } }),
  );

  // ─── Rotas públicas ───────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
  app.use('/auth', authRouter);
  app.use('/auth/ml', mlOAuthRouter); // OAuth do Mercado Livre (publica - precisa redirect funcionar)

  // ─── Rotas protegidas ─────────────────────────────────────────────────────────
  app.use('/whatsapp', requireAuth, whatsappRouter);
  app.use('/campaigns', requireAuth, campaignRouter);
  app.use('/dashboard', requireAuth, dashboardRouter);
  app.use('/services', requireAuth, servicesRouter);
  app.use('/logs', requireAuth, logsRouter);

  // ─── SSE: QR Code em tempo real ──────────────────────────────────────────────
  app.get('/whatsapp/qr-stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const onQr = ({ sessionName, qr }: { sessionName: string; qr: string }) => {
      res.write(`data: ${JSON.stringify({ sessionName, qr })}\n\n`);
    };

    whatsappService.on('qr', onQr);
    req.on('close', () => whatsappService.off('qr', onQr));
  });

  // ─── 404 ──────────────────────────────────────────────────────────────────────
  app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

  // ─── Error handler ────────────────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Erro não tratado');
    res.status(500).json({ error: err.message ?? 'Erro interno' });
  });

  // ─── Startup ──────────────────────────────────────────────────────────────────
  await prisma.$connect();
  logger.info('Banco de dados conectado');

  // Reconecta sessões ativas do WhatsApp
  const sessions = await prisma.whatsAppSession.findMany({
    where: { status: { not: 'disconnected' } },
  });
  for (const s of sessions) {
    logger.info({ session: s.name }, 'Reconectando sessão WhatsApp...');
    whatsappService.initSession(s.name).catch((err) =>
      logger.error({ err, session: s.name }, 'Falha ao reconectar sessão'),
    );
  }

  // Carrega agendamentos das campanhas ativas
  await schedulerService.loadActiveCampaigns();

  // 0.0.0.0 e necessario pro Railway/Docker (nao usar localhost)
  // Cron: limpa logs antigos (>24h) a cada hora
  setInterval(async () => {
    try {
      const count = await cleanupOldLogs();
      if (count > 0) console.log(`[LOG-CLEANUP] Apagou ${count} logs antigos`);
    } catch (err: any) {
      console.error('[LOG-CLEANUP] Erro:', err.message);
    }
  }, 60 * 60 * 1000);

  log.info('system', 'API iniciada', { port: env.PORT, version: 'v1.3' });

  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API rodando na porta ${env.PORT}`);
  });
}

// Evita que erros nao tratados crashem a API (especialmente do Baileys)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

bootstrap().catch((err) => {
  logger.error({ err }, 'Falha fatal ao iniciar servidor');
  process.exit(1);
});
