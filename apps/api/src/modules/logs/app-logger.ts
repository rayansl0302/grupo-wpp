import { prisma } from '../../config/database';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogSource = 'crawler' | 'campaign' | 'whatsapp' | 'linkgen' | 'system' | 'scheduler' | 'auth';

const MAX_RECENT_IN_MEMORY = 200;
const recentLogs: Array<{
  id: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  meta?: any;
  createdAt: Date;
}> = [];

/**
 * Loga um evento no banco + memoria.
 * Fire-and-forget (nao espera o write pra continuar).
 */
export function logEvent(level: LogLevel, source: LogSource, message: string, meta?: any): void {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    level,
    source,
    message: message.slice(0, 1000),
    meta,
    createdAt: new Date(),
  };

  // Memoria (rapido para query recente)
  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_RECENT_IN_MEMORY) recentLogs.pop();

  // Banco (assincrono, fire-and-forget)
  prisma.appLog
    .create({
      data: {
        level,
        source,
        message: entry.message,
        meta: meta ? JSON.stringify(meta).slice(0, 5000) : null,
      },
    })
    .catch((err) => console.error('[LOGGER] Falha ao persistir log:', err.message));
}

// Helpers
export const log = {
  info: (source: LogSource, msg: string, meta?: any) => logEvent('info', source, msg, meta),
  warn: (source: LogSource, msg: string, meta?: any) => logEvent('warn', source, msg, meta),
  error: (source: LogSource, msg: string, meta?: any) => logEvent('error', source, msg, meta),
  debug: (source: LogSource, msg: string, meta?: any) => logEvent('debug', source, msg, meta),
};

/**
 * Limpa logs antigos (>24h) - chamado por cron a cada hora.
 */
export async function cleanupOldLogs(): Promise<number> {
  const TWENTY_FOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.appLog.deleteMany({
    where: { createdAt: { lt: TWENTY_FOUR_HOURS_AGO } },
  });
  return result.count;
}

export function getRecentInMemory() {
  return recentLogs;
}
