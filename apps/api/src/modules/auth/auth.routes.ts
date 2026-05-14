import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import type { Request, Response, NextFunction } from 'express';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.password))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, env.APP_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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
