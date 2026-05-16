import { Router } from 'express';
import { prisma } from '../../config/database';

export const servicesRouter = Router();

type ServiceStatus = 'ok' | 'warning' | 'error' | 'unknown';

interface ServiceCheck {
  id: string;
  name: string;
  category: 'infra' | 'integration' | 'auth';
  status: ServiceStatus;
  message: string;
  panelUrl: string;
  docsUrl?: string;
  expiresAt?: string;
  daysUntilExpire?: number;
  meta?: Record<string, any>;
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * GET /services/status - retorna o estado de todos os servicos externos
 */
servicesRouter.get('/status', async (_req, res) => {
  const checks: ServiceCheck[] = [];

  // ─── 1. Supabase (Postgres) ──────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      id: 'supabase',
      name: 'Supabase (PostgreSQL)',
      category: 'infra',
      status: 'ok',
      message: 'Banco respondendo normalmente',
      panelUrl: 'https://supabase.com/dashboard',
      docsUrl: 'https://supabase.com/docs',
      meta: { plan: 'Free (500MB)' },
    });
  } catch (err: any) {
    checks.push({
      id: 'supabase',
      name: 'Supabase (PostgreSQL)',
      category: 'infra',
      status: 'error',
      message: `Erro de conexao: ${err?.message?.slice(0, 100)}`,
      panelUrl: 'https://supabase.com/dashboard',
    });
  }

  // ─── 2. Railway (backend hosting) ────────────────────────────────────
  checks.push({
    id: 'railway',
    name: 'Railway (Backend)',
    category: 'infra',
    status: 'ok',
    message: 'Voce esta vendo essa pagina, entao a API esta no ar',
    panelUrl: 'https://railway.app',
    docsUrl: 'https://docs.railway.com',
    meta: {
      plan: 'Hobby ($5/mes apos creditos)',
      uptime: process.uptime() > 0 ? `${Math.floor(process.uptime() / 60)}min` : 'recem-iniciado',
    },
  });

  // ─── 3. Vercel (frontend) ────────────────────────────────────────────
  checks.push({
    id: 'vercel',
    name: 'Vercel (Dashboard)',
    category: 'infra',
    status: 'ok',
    message: 'Voce abriu o dashboard, entao esta no ar',
    panelUrl: 'https://vercel.com/dashboard',
    meta: { plan: 'Hobby (gratuito)' },
  });

  // ─── 4. WhatsApp (Baileys) ───────────────────────────────────────────
  const sessions = await prisma.whatsAppSession.findMany({
    select: { name: true, status: true, phoneNumber: true },
  });
  const connectedSessions = sessions.filter((s) => s.status === 'connected');
  checks.push({
    id: 'whatsapp',
    name: 'WhatsApp (Baileys)',
    category: 'integration',
    status: connectedSessions.length > 0 ? 'ok' : 'warning',
    message: connectedSessions.length > 0
      ? `${connectedSessions.length} sessao(oes) conectada(s)`
      : 'Nenhuma sessao conectada - va em Grupos e clique Conectar',
    panelUrl: '/grupos',
    docsUrl: 'https://github.com/WhiskeySockets/Baileys',
    meta: {
      total: sessions.length,
      connected: connectedSessions.length,
      numbers: connectedSessions.map((s) => s.phoneNumber).filter(Boolean),
    },
  });

  // ─── 5. Mercado Livre OAuth (token de usuario) ───────────────────────
  const mlToken = await prisma.mLToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (mlToken) {
    const daysLeft = daysUntil(mlToken.expiresAt);
    const isExpired = mlToken.expiresAt < new Date();
    checks.push({
      id: 'ml-oauth',
      name: 'Mercado Livre OAuth (API)',
      category: 'auth',
      status: isExpired ? 'warning' : 'ok',
      message: isExpired
        ? 'Token expirado - vai renovar automaticamente via refresh_token'
        : `Token valido. Renovacao automatica (refresh_token).`,
      panelUrl: 'https://developers.mercadolibre.com.ar/devcenter',
      docsUrl: 'https://developers.mercadolibre.com.ar/pt_br/autenticacao-e-autorizacao',
      expiresAt: mlToken.expiresAt.toISOString(),
      meta: {
        nickname: mlToken.nickname,
        mlUserId: mlToken.mlUserId,
      },
    });
  } else {
    checks.push({
      id: 'ml-oauth',
      name: 'Mercado Livre OAuth (API)',
      category: 'auth',
      status: 'warning',
      message: 'Nao conectado - va em Configuracoes e clique "Conectar Mercado Livre"',
      panelUrl: '/configuracoes',
      docsUrl: 'https://developers.mercadolibre.com.ar/pt_br/autenticacao-e-autorizacao',
    });
  }

  // ─── 6. Mercado Livre Storage State (sessao do painel afiliado) ──────
  const hasStorageState = !!(process.env.ML_STORAGE_STATE && process.env.ML_STORAGE_STATE.length > 100);
  checks.push({
    id: 'ml-storage',
    name: 'Mercado Livre Painel (link bonito)',
    category: 'auth',
    status: hasStorageState ? 'ok' : 'warning',
    message: hasStorageState
      ? 'Sessao do painel ativa - gera links meli.la/XXX'
      : 'Sem sessao - bot usa link manual com matt_word (funciona, mas feio)',
    panelUrl: 'https://www.mercadolivre.com.br/afiliados',
    docsUrl: 'https://github.com/rayansl0302/grupo-wpp/blob/main/README.md#5-mercado-livre--sessão-autenticada-link-bonito',
    meta: {
      configured: hasStorageState,
      tip: 'Rodar `npx tsx scripts/capture-ml-session.ts` no PC quando expirar (~30 dias)',
    },
  });

  // ─── 7. Mercado Livre Programa de Afiliados ──────────────────────────
  checks.push({
    id: 'ml-affiliate',
    name: 'Mercado Livre Afiliados',
    category: 'integration',
    status: process.env.ML_AFFILIATE_ID ? 'ok' : 'warning',
    message: process.env.ML_AFFILIATE_ID
      ? `Afiliado configurado: ${process.env.ML_AFFILIATE_ID}`
      : 'ML_AFFILIATE_ID nao configurado - comissao nao sera rastreada',
    panelUrl: 'https://www.mercadolivre.com.br/afiliados',
    docsUrl: 'https://www.mercadolivre.com.br/afiliados/regras',
    meta: { affiliateId: process.env.ML_AFFILIATE_ID || '(nao configurado)' },
  });

  // ─── 8. IPRoyal (Proxy residencial BR) ───────────────────────────────
  const hasProxy = !!(process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD);
  checks.push({
    id: 'iproyal',
    name: 'IPRoyal (Proxy BR)',
    category: 'integration',
    status: hasProxy ? 'ok' : 'error',
    message: hasProxy
      ? 'Proxy configurado - bot consegue burlar 403 do ML'
      : 'Sem proxy - bot vai cair em 403 do Cloudflare',
    panelUrl: 'https://dashboard.iproyal.com',
    docsUrl: 'https://iproyal.com/help-center',
    meta: {
      hostname: process.env.PROXY_HOSTNAME,
      tip: 'Confere banda restante no dashboard. 2GB dura ~2-3 meses com cache ativo.',
    },
  });

  // ─── 9. TinyURL (encurtador fallback) ────────────────────────────────
  checks.push({
    id: 'tinyurl',
    name: 'TinyURL (encurtador)',
    category: 'integration',
    status: process.env.URL_SHORTENER === 'tinyurl' ? 'ok' : 'unknown',
    message: process.env.URL_SHORTENER === 'tinyurl'
      ? 'Encurtando links de afiliado quando nao tem painel ML'
      : `URL_SHORTENER=${process.env.URL_SHORTENER || 'tinyurl'}`,
    panelUrl: 'https://tinyurl.com',
    meta: { type: process.env.URL_SHORTENER || 'tinyurl' },
  });

  // ─── 10. ScraperAPI (fallback se proxy falhar) ───────────────────────
  if (process.env.SCRAPER_API_KEY) {
    checks.push({
      id: 'scraperapi',
      name: 'ScraperAPI (fallback)',
      category: 'integration',
      status: 'ok',
      message: 'Configurado como fallback se IPRoyal falhar',
      panelUrl: 'https://dashboard.scraperapi.com',
      docsUrl: 'https://docs.scraperapi.com',
      meta: { plan: 'Free trial (1000 req/mes)' },
    });
  }

  // ─── 11. GitHub (codigo) ─────────────────────────────────────────────
  checks.push({
    id: 'github',
    name: 'GitHub (repo)',
    category: 'infra',
    status: 'ok',
    message: 'Codigo versionado e deployado',
    panelUrl: 'https://github.com/rayansl0302/grupo-wpp',
    meta: { branch: 'main', tags: ['v1.0-stable', 'v1.2-stable'] },
  });

  const summary = {
    total: checks.length,
    ok: checks.filter((c) => c.status === 'ok').length,
    warning: checks.filter((c) => c.status === 'warning').length,
    error: checks.filter((c) => c.status === 'error').length,
  };

  res.json({ summary, services: checks });
});
