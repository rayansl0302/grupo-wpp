import type { Product } from '@prisma/client';

const HEADERS = [
  '✨ CENTRAL DE OFERTAS ✨',
  '🛍️ MEU CATÁLOGO DE PROMOÇÕES 🛍️',
  '🎯 OFERTAS SELECIONADAS 🎯',
  '💎 ACHADOS DO DIA 💎',
  '🔥 PROMOÇÕES IMPERDÍVEIS 🔥',
];

const CTAS = [
  '👉 ACESSE TODAS AS OFERTAS:',
  '👉 CONFIRA TODOS OS PRODUTOS:',
  '👉 VEJA TUDO AQUI:',
  '👉 PROMOÇÕES SELECIONADAS:',
  '👉 CLIQUE PRA VER MAIS:',
];

const CLOSERS = [
  '⭐ Ofertas atualizadas todo dia!',
  '🔔 Salve o link, vale a pena!',
  '💯 Curadoria diária de produtos!',
  '🎁 Mais de 100 promoções ativas!',
  '💰 Economize de verdade!',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Template que envia o link do perfil social do afiliado + alguns produtos
 * em destaque (texto teaser, sem listar URL de cada um).
 */
export function buildSocialProfileMessage(
  profileUrl: string,
  highlightProducts: Product[],
): string {
  const lines: string[] = [pick(HEADERS), ''];

  if (highlightProducts.length > 0) {
    lines.push('🌟 *Em destaque hoje:*');
    lines.push('');
    for (const p of highlightProducts.slice(0, 4)) {
      const title = p.title.length > 60 ? p.title.slice(0, 57) + '...' : p.title;
      const priceStr = p.originalPrice && p.discount
        ? `~${formatPrice(p.originalPrice)}~ → *${formatPrice(p.salePrice)}* (-${p.discount}%)`
        : `*${formatPrice(p.salePrice)}*`;
      lines.push(`🛒 ${title}`);
      lines.push(`💰 ${priceStr}`);
      lines.push('');
    }
    lines.push('━━━━━━━━━━━━━━━━━');
    lines.push('');
  }

  lines.push(pick(CTAS));
  lines.push(profileUrl);
  lines.push('');
  lines.push(pick(CLOSERS));

  return lines.join('\n');
}
