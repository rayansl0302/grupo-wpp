import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

export const mlOAuthRouter = Router();

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

/**
 * Inicia o fluxo OAuth - redireciona pro ML pra autorizacao.
 * GET /auth/ml/start
 */
mlOAuthRouter.get('/start', (_req, res) => {
  if (!env.ML_APP_ID) {
    return res.status(500).json({ error: 'ML_APP_ID nao configurado' });
  }

  console.log(`[ML-OAUTH] env.ML_REDIRECT_URI = "${env.ML_REDIRECT_URI}"`);
  console.log(`[ML-OAUTH] process.env.ML_REDIRECT_URI = "${process.env.ML_REDIRECT_URI}"`);

  const url = new URL(ML_AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.ML_APP_ID);
  url.searchParams.set('redirect_uri', env.ML_REDIRECT_URI);

  console.log(`[ML-OAUTH] Redirecionando para: ${url.toString()}`);
  res.redirect(url.toString());
});

/**
 * Debug: mostra as variaveis ML do ambiente
 * GET /auth/ml/debug
 */
mlOAuthRouter.get('/debug', (_req, res) => {
  res.json({
    env_ML_REDIRECT_URI: env.ML_REDIRECT_URI,
    process_env_ML_REDIRECT_URI: process.env.ML_REDIRECT_URI,
    env_ML_APP_ID: env.ML_APP_ID,
    env_ML_AFFILIATE_ID: env.ML_AFFILIATE_ID,
    has_client_secret: !!env.ML_CLIENT_SECRET,
    node_env: process.env.NODE_ENV,
    deploy_timestamp: new Date().toISOString(),
  });
});

/**
 * Callback - ML manda o code aqui apos autorizacao.
 * GET /auth/ml/callback?code=XXX
 */
mlOAuthRouter.get('/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    console.error('[ML-OAUTH] Usuario negou autorizacao:', error);
    return res.send(renderHtml(`
      <h1>Autorizacao negada</h1>
      <p>Erro: ${error}</p>
      <a href="/">Voltar</a>
    `));
  }

  if (!code) {
    return res.status(400).send(renderHtml('<h1>Codigo nao recebido</h1>'));
  }

  try {
    console.log('[ML-OAUTH] Trocando code por tokens...');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.ML_APP_ID!,
      client_secret: env.ML_CLIENT_SECRET!,
      code,
      redirect_uri: env.ML_REDIRECT_URI,
    });

    const tokenRes = await axios.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: number;
      scope: string;
    }>(ML_TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    const { access_token, refresh_token, expires_in, user_id, scope } = tokenRes.data;

    // Busca info do usuario
    let nickname: string | null = null;
    try {
      const userRes = await axios.get<{ nickname: string }>(
        `https://api.mercadolibre.com/users/${user_id}`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      nickname = userRes.data.nickname;
    } catch {
      // ignora
    }

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await prisma.mLToken.upsert({
      where: { mlUserId: String(user_id) },
      update: { accessToken: access_token, refreshToken: refresh_token, expiresAt, scope, nickname },
      create: {
        mlUserId: String(user_id),
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope,
        nickname,
      },
    });

    console.log(`[ML-OAUTH] Token salvo. User: ${nickname || user_id}, expira em ${expires_in}s`);

    res.send(renderHtml(`
      <h1 style="color:#16a34a">Mercado Livre conectado!</h1>
      <p>Usuario: <strong>${nickname || user_id}</strong></p>
      <p>Token valido por ${Math.round(expires_in / 3600)}h (renova automaticamente)</p>
      <p>Voce ja pode fechar essa janela e voltar ao dashboard.</p>
      <script>setTimeout(() => window.close(), 3000)</script>
    `));
  } catch (err: any) {
    console.error('[ML-OAUTH] Falha ao trocar code:', err?.response?.data || err?.message);
    res.status(500).send(renderHtml(`
      <h1 style="color:#dc2626">Erro ao conectar</h1>
      <pre>${JSON.stringify(err?.response?.data || err?.message, null, 2)}</pre>
    `));
  }
});

/**
 * Status da conexao com ML.
 * GET /auth/ml/status
 */
mlOAuthRouter.get('/status', async (_req, res) => {
  const token = await prisma.mLToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!token) {
    return res.json({ connected: false });
  }
  res.json({
    connected: true,
    mlUserId: token.mlUserId,
    nickname: token.nickname,
    expiresAt: token.expiresAt,
    expired: token.expiresAt < new Date(),
  });
});

/**
 * Desconecta (deleta o token).
 * POST /auth/ml/disconnect
 */
mlOAuthRouter.post('/disconnect', async (_req, res) => {
  await prisma.mLToken.deleteMany();
  res.json({ ok: true });
});

function renderHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>WPP Bot - ML OAuth</title>
<style>
  body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #f0f0f0; }
  h1 { font-size: 1.5rem; }
  pre { background: #1f1f1f; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  a { color: #22c55e; }
</style>
</head>
<body>${body}</body>
</html>`;
}
