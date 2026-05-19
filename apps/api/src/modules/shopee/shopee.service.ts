import { shopeeClient } from './shopee.client';
import { log } from '../logs/app-logger';

export interface ShopeeProduct {
  itemId: string;
  shopId: string;
  productName: string;
  imageUrl: string | null;
  productLink: string;
  offerLink: string; // link de afiliado (curto)
  priceMin: number;
  priceMax: number;
  priceDiscountRate: number;
  sales: number;
  ratingStar: number;
  shopName: string | null;
  categoryName: string | null;
}

/**
 * Service que envolve as queries GraphQL da Shopee Affiliate API.
 */
class ShopeeService {
  /**
   * Busca produtos por palavra-chave (productOfferV2).
   * Retorna produtos com link de afiliado ja gerado.
   */
  async searchProducts(keyword: string, limit = 20): Promise<ShopeeProduct[]> {
    if (!shopeeClient.enabled) {
      console.log('[SHOPEE-SERVICE] cliente desativado, retornando vazio');
      return [];
    }

    const query = `
      query SearchProducts($keyword: String!, $limit: Int!, $page: Int!) {
        productOfferV2(keyword: $keyword, limit: $limit, page: $page, sortType: 2) {
          nodes {
            itemId
            shopId
            productName
            imageUrl
            productLink
            offerLink
            priceMin
            priceMax
            priceDiscountRate
            sales
            ratingStar
            shopName
            categoryName
          }
          pageInfo {
            page
            limit
            hasNextPage
          }
        }
      }
    `;

    try {
      const data = await shopeeClient.query<{
        productOfferV2: {
          nodes: ShopeeProduct[];
          pageInfo: { page: number; limit: number; hasNextPage: boolean };
        };
      }>(query, { keyword, limit, page: 1 });

      const products = data.productOfferV2?.nodes || [];
      console.log(`[SHOPEE] "${keyword}" -> ${products.length} produtos`);
      return products;
    } catch (err: any) {
      log.error('crawler', `Shopee API falhou: ${err?.message?.slice(0, 100)}`, { keyword });
      return [];
    }
  }

  /**
   * Gera link curto de afiliado pra uma URL de produto.
   * (Usado se voce ja tem a URL e quer encurtar com seu tag de afiliado)
   */
  async generateShortLink(originalUrl: string, subIds?: string[]): Promise<string | null> {
    if (!shopeeClient.enabled) return null;

    const query = `
      mutation GenerateShortLink($input: ShortLinkInput!) {
        generateShortLink(input: $input) {
          shortLink
        }
      }
    `;

    try {
      const data = await shopeeClient.query<{
        generateShortLink: { shortLink: string };
      }>(query, {
        input: {
          originalLink: originalUrl,
          subIds: subIds || ['wpp-bot'],
        },
      });
      return data.generateShortLink?.shortLink || null;
    } catch (err: any) {
      console.error('[SHOPEE] generateShortLink falhou:', err?.message);
      return null;
    }
  }
}

export const shopeeService = new ShopeeService();
