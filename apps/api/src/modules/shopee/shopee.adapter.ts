import { shopeeService, type ShopeeProduct } from './shopee.service';
import type { MLNormalizedProduct, MLSearchParams } from '../mercadolivre/ml.types';

/**
 * Converte produto Shopee pro formato unificado (MLNormalizedProduct).
 * Assim podemos reaproveitar todo o pipeline existente (cache, dedup, templates, etc).
 */
export function shopeeProductToNormalized(p: ShopeeProduct): MLNormalizedProduct {
  // Shopee API retorna preco JA em reais (testado em prod: priceMin=24.88 = R$ 24,88)
  // Anteriormente assumi 10^-5 baseado em doc desatualizada - estava errado
  const salePrice = p.priceMin;
  const discount = p.priceDiscountRate > 0 ? p.priceDiscountRate : null;
  const originalPrice = discount
    ? Math.round((salePrice / (1 - discount / 100)) * 100) / 100
    : null;

  return {
    mlId: `SHOPEE-${p.shopId}-${p.itemId}`,
    title: p.productName,
    originalPrice,
    salePrice,
    discount,
    thumbnail: p.imageUrl,
    permalink: p.productLink,
    freeShipping: false, // Shopee nao expoe esse campo direto
    seller: p.shopName,
    soldCount: p.sales,
    rating: p.ratingStar > 0 ? p.ratingStar : null,
    category: null, // Shopee productOfferV2 nao expoe categoria - pode ser puxado de outra query depois
  };
}

/**
 * Busca produtos no Shopee com mesma interface do ML.
 * Retorna no formato unificado pra reuso do pipeline.
 */
/**
 * Shopee API tem um minimo de produtos por request (testado: limit=1 retorna
 * "System Error" code 10000). Sempre buscamos batch de 20 e fatiamos depois.
 * Bonus: como busca 20 e filtra pra N, fica mais provavel achar produto com
 * bom desconto / dentro do faixa de preco configurada.
 */
const SHOPEE_API_MIN_BATCH = 20;

export async function searchShopeeNormalized(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const keyword = params.query?.trim();
  if (!keyword) return [];

  // SEMPRE busca 20 (minimo aceito pela API) - depois corta pra params.limit
  const raw = await shopeeService.searchProducts(keyword, SHOPEE_API_MIN_BATCH);

  // Aplica filtros do params
  const normalized = raw.map(shopeeProductToNormalized).filter((p) => {
    if (params.minDiscount && (!p.discount || p.discount < params.minDiscount)) return false;
    if (params.minPrice && p.salePrice < params.minPrice) return false;
    if (params.maxPrice && p.salePrice > params.maxPrice) return false;
    if (params.freeShipping && !p.freeShipping) return false;
    return true;
  });

  // Fatia pelo limit pedido (default: retorna todos os filtrados)
  const limited = params.limit ? normalized.slice(0, params.limit) : normalized;

  console.log(
    `[SHOPEE-ADAPTER] "${keyword}" -> ${raw.length} raw, ${normalized.length} apos filtros, ${limited.length} apos limit(${params.limit ?? 'all'})`,
  );
  return limited;
}

/**
 * Pega offerLink (link de afiliado) direto do produto Shopee.
 * Shopee ja retorna isso no `productOfferV2`, entao nao precisa chamar generateShortLink.
 */
export function getShopeeAffiliateUrl(rawProduct: ShopeeProduct): string {
  return rawProduct.offerLink || rawProduct.productLink;
}
