import { env } from '../../config/env';

/**
 * Retorna delay aleatório humanizado entre DELAY_MIN e DELAY_MAX.
 * Simula o tempo que um humano levaria para digitar/enviar uma mensagem.
 */
export function randomDelay(): Promise<void> {
  const ms =
    Math.floor(Math.random() * (env.DELAY_MAX_MS - env.DELAY_MIN_MS + 1)) + env.DELAY_MIN_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estrategia de envio por janelas horarias (timezone Brasilia).
 * Evita envios em horarios "fora do padrao" que disparam deteccao de bot.
 */
export function isWithinActiveHours(): boolean {
  // Pega hora em Sao Paulo independente do timezone do servidor (Railway = UTC)
  const hourStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const hour = parseInt(hourStr, 10);
  // Janelas permitidas: 07h-23h horario de Brasilia
  return hour >= 7 && hour <= 23;
}

/**
 * Jitter exponencial para retry em caso de falha.
 * Base 2s, máximo 60s, com ruído aleatório.
 */
export function backoffDelay(attempt: number): Promise<void> {
  const base = Math.min(2000 * Math.pow(2, attempt), 60000);
  const jitter = Math.floor(Math.random() * 1000);
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

/**
 * Agrupa envios em batches para não sobrecarregar a sessão do WhatsApp.
 * Recomenda-se no máximo 3-5 mensagens por batch com pausa entre batches.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
