import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import type { Request, Response, NextFunction } from 'express';

export const authRouter = Router();

// Helper pra cortar promises lentas (pool prisma exausto, etc) - evita hang infinito
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout em "${label}" apos ${ms}ms`)), ms),
    ),
  ]);
}

authRouter.post('/login', async (req, res) => {
  const t0 = Date.now();
  const step = (msg: string) => console.log(`[LOGIN] ${msg} (+${Date.now() - t0}ms)`);

  try {
    step('start');
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    step(`body parsed (email=${body.email.slice(0, 30)})`);

    // Timeout de 5s na query pra evitar hang infinito (pool prisma exausto)
    const user = await withTimeout(
      prisma.user.findUnique({ where: { email: body.email } }),
      5000,
      'prisma.user.findUnique',
    );
    step(`user fetched (found=${!!user})`);

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // bcrypt e CPU-pesado e sincrono - se travar aqui, evento e o problema
    const passOk = await bcrypt.compare(body.password, user.password);
    step(`bcrypt compare done (ok=${passOk})`);

    if (!passOk) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, env.APP_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
    step('token signed');

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    step('response sent');
  } catch (err: any) {
    console.error(`[LOGIN] ERRO (+${Date.now() - t0}ms):`, err?.message || err);
    // Se for erro de validacao Zod, 400. Caso contrario 500.
    const status = err?.name === 'ZodError' ? 400 : 500;
    res.status(status).json({ error: err?.message || 'Erro ao processar login' });
  }
});

// ─── Middleware de autenticação ───────────────────────────────────────────────

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const payload = jwt.verify(header.slice(7), env.APP_SECRET) as { sub: string; role: string };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
