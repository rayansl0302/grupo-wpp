import './config/env'; // valida .env primeiro
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { authRouter, requireAuth } from './modules/auth/auth.routes';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes';
import { campaignRouter } from './modules/campaigns/campaign.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { schedulerService } from './modules/scheduler/scheduler.service';
import { whatsappService } from './modules/whatsapp/whatsapp.service';

async function bootstrap() {
  const app = express();

  // ─── Middlewares globais ─────────────────────────────────────────────────────
  // CORS: aceita qualquer origem em dev; em prod usa CORS_ORIGIN do .env (separar por virgula)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : '*';
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(
    rateLimit({ windowMs: 60_000, max: 100, message: { error: 'Rate limit excedido' } }),
  );

  // ─── Rotas públicas ───────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
  app.use('/auth', authRouter);

  // ─── Rotas protegidas ─────────────────────────────────────────────────────────
  app.use('/whatsapp', requireAuth, whatsappRouter);
  app.use('/campaigns', requireAuth, campaignRouter);
  app.use('/dashboard', requireAuth, dashboardRouter);

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

  app.listen(env.PORT, () => {
    logger.info(`🚀 API rodando em http://localhost:${env.PORT}`);
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
