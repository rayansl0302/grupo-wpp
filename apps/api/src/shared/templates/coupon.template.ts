import type { Coupon } from '@prisma/client';

const OPENERS = [
  '🎟️ CUPOM DE DESCONTO 🎟️',
  '💸 CUPOM EXCLUSIVO 💸',
  '🏷️ CUPOM IMPERDÍVEL 🏷️',
  '🎁 CUPOM DE ECONOMIA 🎁',
  '💰 CUPOM ESPECIAL 💰',
  '🔥 CUPOM RELÂMPAGO 🔥',
];

const CTAS = [
  '👉 RESGATAR CUPOM',
  '👉 PEGAR AGORA',
  '👉 USAR O DESCONTO',
  '👉 APROVEITAR',
  '👉 CLIQUE E ECONOMIZE',
];

const CLOSERS = [
  '⏰ Aproveite enquanto está ativo!',
  '🔔 Cupom por tempo limitado!',
  '⚠️ Limite de uso por pessoa!',
  '💨 Cupons acabam rápido!',
  '🕐 Não perca!',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildCouponMessage(coupon: Coupon, affiliateUrl: string): string {
  const lines: string[] = [
    pick(OPENERS),
    '',
    `🛒 *${coupon.title}*`,
  ];

  if (coupon.description && coupon.description !== coupon.title) {
    lines.push(coupon.description);
  }

  if (coupon.discount) {
    lines.push(`✅ Desconto: *${coupon.discount}*`);
  }

  if (coupon.code) {
    lines.push(`🎟️ Código: *${coupon.code}*`);
  }

  if (coupon.store) {
    lines.push(`🏪 Loja: ${coupon.store}`);
  }

  if (coupon.validUntil) {
    const date = coupon.validUntil.toLocaleDateString('pt-BR');
    lines.push(`📅 Válido até: ${date}`);
  }

  lines.push('');
  lines.push(`${pick(CTAS)}:`);
  lines.push(affiliateUrl);
  lines.push('');
  lines.push(pick(CLOSERS));

  return lines.join('\n');
}
