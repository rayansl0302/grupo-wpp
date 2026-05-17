import { Router } from 'express';
import { prisma } from '../../config/database';
import { cleanupOldLogs } from './app-logger';

export const logsRouter = Router();

/**
 * GET /logs?level=&source=&limit=100&since=ISO
 */
logsRouter.get('/', async (req, res) => {
  const { level, source, since } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const where: any = {};
  if (level && typeof level === 'string') where.level = level;
  if (source && typeof source === 'string') where.source = source;
  if (since && typeof since === 'string') {
    where.createdAt = { gte: new Date(since) };
  }

  const [logs, total] = await Promise.all([
    prisma.appLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.appLog.count({ where }),
  ]);

  res.json({
    total,
    showing: logs.length,
    logs: logs.map((l) => ({
      ...l,
      meta: l.meta ? safeParse(l.meta) : null,
    })),
  });
});

/**
 * GET /logs/summary - estatisticas por level e source nas ultimas 24h
 */
logsRouter.get('/summary', async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const all = await prisma.appLog.findMany({
    where: { createdAt: { gte: since } },
    select: { level: true, source: true },
  });

  const byLevel: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const l of all) {
    byLevel[l.level] = (byLevel[l.level] || 0) + 1;
    bySource[l.source] = (bySource[l.source] || 0) + 1;
  }

  res.json({ total: all.length, byLevel, bySource });
});

/**
 * DELETE /logs - limpa logs antigos manualmente
 */
logsRouter.delete('/', async (_req, res) => {
  const count = await cleanupOldLogs();
  res.json({ deleted: count });
});

function safeParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
