import type { Product } from '@prisma/client';

export type TemplateType = 'standard' | 'hype' | 'minimal' | 'flash';

interface MessageContext {
  product: Product;
  affiliateUrl: string;
}

// Pool de frases de abertura para variar as mensagens e evitar padrão detectável
const OPENERS = [
  '🔥 OFERTA IMPERDÍVEL 🔥',
  '🚨 ALERTA DE PROMOÇÃO 🚨',
  '💥 PROMOÇÃO RELÂMPAGO 💥',
  '⚡ OFERTA EXCLUSIVA ⚡',
  '🎯 DESCONTO INCRÍVEL 🎯',
  '🛍️ ACHADO DO DIA 🛍️',
  '💣 BOMBA DE DESCONTO 💣',
  '🏷️ PREÇO DE FÁBRICA 🏷️',
];

const CTAS = [
  '👉 GARANTA O SEU AGORA',
  '👉 COMPRE ANTES QUE ACABE',
  '👉 APROVEITE ENQUANTO DURA',
  '👉 CLIQUE E COMPRE JÁ',
  '👉 PEGAR DESCONTO',
  '🛒 COMPRAR COM DESCONTO',
];

const CLOSERS = [
  '⏰ Promoção por tempo limitado!',
  '🔔 Corre que acaba!',
  '⚠️ Estoque limitado!',
  '💨 Oferta relâmpago!',
  '🕐 Só por hoje!',
  '📦 Últimas unidades!',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Templates ────────────────────────────────────────────────────────────────

function standardTemplate({ product, affiliateUrl }: MessageContext): string {
  const lines = [
    pick(OPENERS),
    '',
    `🛒 *${product.title}*`,
  ];

  if (product.originalPrice && product.discount) {
    lines.push(`💸 De: ~${formatPrice(product.originalPrice)}~`);
    lines.push(`✅ Por: *${formatPrice(product.salePrice)}*`);
    lines.push(`🏷️ ${product.discount}% OFF`);
  } else {
    lines.push(`✅ Por: *${formatPrice(product.salePrice)}*`);
  }

  if (product.freeShipping) lines.push('🚚 *Frete Grátis*');
  if (product.rating) lines.push(`⭐ Avaliação: ${product.rating.toFixed(1)}/5`);
  if (product.soldCount) lines.push(`📊 +${product.soldCount.toLocaleString('pt-BR')} vendidos`);

  lines.push('');
  lines.push(`${pick(CTAS)}:`);
  lines.push(affiliateUrl);
  lines.push('');
  lines.push(pick(CLOSERS));

  return lines.join('\n');
}

function hypeTemplate({ product, affiliateUrl }: MessageContext): string {
  const lines = [
    '━━━━━━━━━━━━━━━━━',
    pick(OPENERS),
    '━━━━━━━━━━━━━━━━━',
    '',
    `📌 ${product.title}`,
    '',
  ];

  if (product.originalPrice && product.discount) {
    lines.push(`❌ ANTES: ${formatPrice(product.originalPrice)}`);
    lines.push(`✅ AGORA: *${formatPrice(product.salePrice)}*`);
    lines.push(`💰 VOCÊ ECONOMIZA: ${formatPrice(product.originalPrice - product.salePrice)}`);
  } else {
    lines.push(`💰 PREÇO: *${formatPrice(product.salePrice)}*`);
  }

  lines.push('');
  if (product.freeShipping) lines.push('📦 FRETE GRÁTIS ✔️');
  if (product.rating) lines.push(`⭐ ${product.rating.toFixed(1)} estrelas`);

  lines.push('');
  lines.push('🔗 Link do produto:');
  lines.push(affiliateUrl);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━');
  lines.push(pick(CLOSERS));

  return lines.join('\n');
}

function minimalTemplate({ product, affiliateUrl }: MessageContext): string {
  const priceStr = product.originalPrice
    ? `~${formatPrice(product.originalPrice)}~ → *${formatPrice(product.salePrice)}*${product.discount ? ` (${product.discount}% OFF)` : ''}`
    : `*${formatPrice(product.salePrice)}*`;

  return [
    `🔥 *${product.title}*`,
    `💲 ${priceStr}`,
    product.freeShipping ? '🚚 Frete grátis' : '',
    `🛒 ${affiliateUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function flashTemplate({ product, affiliateUrl }: MessageContext): string {
  return [
    '⚡⚡ OFERTA FLASH ⚡⚡',
    '',
    `🔖 *${product.title}*`,
    product.discount ? `🏷️ *${product.discount}% de desconto*` : '',
    `💵 *${formatPrice(product.salePrice)}*`,
    product.freeShipping ? '📦 Frete grátis incluído' : '',
    '',
    `👉 ${affiliateUrl}`,
    '',
    '⏳ *Corra! Oferta por tempo limitado!*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

// ─── Factory ──────────────────────────────────────────────────────────────────

const TEMPLATES: Record<TemplateType, (ctx: MessageContext) => string> = {
  standard: standardTemplate,
  hype: hypeTemplate,
  minimal: minimalTemplate,
  flash: flashTemplate,
};

export function buildMessage(
  product: Product,
  affiliateUrl: string,
  templateType: TemplateType = 'standard',
): string {
  const fn = TEMPLATES[templateType] ?? TEMPLATES.standard;
  return fn({ product, affiliateUrl });
}
