import { shopeeService, type ShopeeProduct } from './shopee.service';
import type { MLNormalizedProduct, MLSearchParams } from '../mercadolivre/ml.types';

/**
 * Converte produto Shopee pro formato unificado (MLNormalizedProduct).
 * Assim podemos reaproveitar todo o pipeline existente (cache, dedup, templates, etc).
 */
export function shopeeProductToNormalized(p: ShopeeProduct): MLNormalizedProduct {
  const salePrice = p.priceMin / 100000; // Shopee usa preco em "10^-5"
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
    category: p.categoryName,
  };
}

/**
 * Busca produtos no Shopee com mesma interface do ML.
 * Retorna no formato unificado pra reuso do pipeline.
 */
export async function searchShopeeNormalized(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const keyword = params.query?.trim();
  if (!keyword) return [];

  const raw = await shopeeService.searchProducts(keyword, params.limit ?? 20);

  // Aplica filtros do params
  const normalized = raw.map(shopeeProductToNormalized).filter((p) => {
    if (params.minDiscount && (!p.discount || p.discount < params.minDiscount)) return false;
    if (params.minPrice && p.salePrice < params.minPrice) return false;
    if (params.maxPrice && p.salePrice > params.maxPrice) return false;
    if (params.freeShipping && !p.freeShipping) return false;
    return true;
  });

  console.log(`[SHOPEE-ADAPTER] "${keyword}" -> ${raw.length} raw, ${normalized.length} apos filtros`);
  return normalized;
}

/**
 * Pega offerLink (link de afiliado) direto do produto Shopee.
 * Shopee ja retorna isso no `productOfferV2`, entao nao precisa chamar generateShortLink.
 */
export function getShopeeAffiliateUrl(rawProduct: ShopeeProduct): string {
  return rawProduct.offerLink || rawProduct.productLink;
}
