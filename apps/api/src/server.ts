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
import { couponRouter } from './modules/coupons/coupon.routes';
import { cleanupOldLogs, log } from './modules/logs/app-logger';
import { schedulerService } from './modules/scheduler/scheduler.service';
import { whatsappService } from './modules/whatsapp/whatsapp.service';

async function bootstrap() {
  const app = express();

  // ─── Middlewares globais ─────────────────────────────────────────────────────
  // CORS: smart resolver
  // - default (sem env): aceita qualquer origem (modo permissivo)
  // - CORS_ORIGIN=*: idem
  // - CORS_ORIGIN=url1,url2: lista exata + *.vercel.app + localhost (sempre liberados)
  const corsEnv = (process.env.CORS_ORIGIN ?? '*').trim();
  const allowedExact = corsEnv === '*' ? null : corsEnv.split(',').map((s) => s.trim()).filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Requests sem origin (curl, server-to-server, mobile) -> permite
      if (!origin) return callback(null, true);

      // Modo permissivo (default): aceita tudo
      if (!allowedExact) return callback(null, true);

      // Match exato com lista do env
      if (allowedExact.includes(origin)) return callback(null, true);

      // Vercel previews/production - resolve renames e preview deploys automaticamente
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);

      // Localhost pra dev
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);

      // Rejeita + log pra debug
      console.warn(`[CORS] Origin rejeitada: ${origin}`);
      callback(new Error(`CORS: origin nao permitida (${origin})`));
    },
    // credentials false em modo permissivo (browser exige), true em modo restrito
    credentials: allowedExact !== null,
  }));

  app.use(express.json());
  // Rate limit ignora /health e /auth/login pra evitar bloquear painel quando ha muitos requests
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 100,
      message: { error: 'Rate limit excedido' },
      skip: (req) => req.path === '/health' || req.path === '/auth/login',
    }),
  );

  // ─── Rotas públicas ───────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

  // Diagnostico publico: testar Shopee API sem precisar de JWT (uso: dashboard, debug via navegador)
  app.get('/health/test-shopee', async (req, res) => {
    try {
      const { shopeeService } = await import('./modules/shopee/shopee.service');
      const { shopeeClient } = await import('./modules/shopee/shopee.client');
      const q = (req.query.q as string) || 'fone bluetooth';

      if (!shopeeClient.enabled) {
        return res.status(503).json({
          error: 'Shopee desativado',
          reason: 'Faltam SHOPEE_APP_ID e/ou SHOPEE_APP_SECRET no Railway',
          howToFix: 'Configure as duas env vars em Railway > Variables e faca redeploy',
        });
      }

      const products = await shopeeService.searchProducts(q, 5);
      res.json({
        query: q,
        count: products.length,
        products: products.map((p) => ({
          title: p.productName,
          // Shopee retorna como string as vezes - forcar Number
          priceMin: Number(p.priceMin),
          priceMax: Number(p.priceMax),
          discount: Number(p.priceDiscountRate),
          thumbnail: p.imageUrl,
          // Dois links: o publico (sem tracking) e o de afiliado (COM seu af_id)
          productLink: p.productLink, // sem tracking
          offerLink: p.offerLink,     // COM tracking - este vai pro WhatsApp
          shopName: p.shopName,
          sales: Number(p.sales),
        })),
        _note: 'O link enviado no WhatsApp e o "offerLink" (s.shopee.com.br/XXX) com seu af_id. Teste em aba anonima.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
        hint: err.message?.includes('signature') || err.message?.includes('auth')
          ? 'Provavelmente SHOPEE_APP_SECRET incorreto'
          : err.message?.includes('Cannot query')
          ? 'Schema GraphQL Shopee mudou - reportar bug'
          : undefined,
      });
    }
  });

  app.use('/auth', authRouter);
  app.use('/auth/ml', mlOAuthRouter); // OAuth do Mercado Livre (publica - precisa redirect funcionar)

  // ─── Rotas protegidas ─────────────────────────────────────────────────────────
  app.use('/whatsapp', requireAuth, whatsappRouter);
  app.use('/campaigns', requireAuth, campaignRouter);
  app.use('/dashboard', requireAuth, dashboardRouter);
  app.use('/services', requireAuth, servicesRouter);
  app.use('/logs', requireAuth, logsRouter);
  app.use('/coupons', requireAuth, couponRouter);

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
