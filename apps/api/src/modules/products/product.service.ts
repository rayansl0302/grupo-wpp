import { prisma } from '../../config/database';
import { mlService } from '../mercadolivre/ml.service';
import { shortenUrl } from '../../shared/utils/url-shortener';
import { logger } from '../../config/logger';
import type { MLSearchParams } from '../mercadolivre/ml.types';
import type { Product } from '@prisma/client';

export class ProductService {
  /**
   * Busca novos produtos do ML, persiste no banco e retorna apenas os que
   * ainda não foram enviados para o grupo informado.
   */
  async fetchAndFilter(params: MLSearchParams, groupId: string): Promise<Product[]> {
    const rawProducts = await mlService.searchProducts(params);

    // Produtos já enviados para este grupo
    const alreadySent = new Set(
      (
        await prisma.sentPost.findMany({
          where: { groupId },
          select: { productId: true },
        })
      ).map((s) => s.productId),
    );

    const results: Product[] = [];

    for (const raw of rawProducts) {
      const affiliatePermalink = mlService.buildAffiliateUrl(raw.permalink);
      console.log(`[PRODUCT] permalink original: ${raw.permalink}`);
      console.log(`[PRODUCT] com matt_word: ${affiliatePermalink}`);
      const affiliateUrl = await shortenUrl(affiliatePermalink).catch(() => affiliatePermalink);
      console.log(`[PRODUCT] final (encurtado): ${affiliateUrl}`);

      const product = await prisma.product.upsert({
        where: { mlId: raw.mlId },
        update: {
          salePrice: raw.salePrice,
          originalPrice: raw.originalPrice,
          discount: raw.discount,
          affiliateUrl,
          freeShipping: raw.freeShipping,
          soldCount: raw.soldCount,
          rating: raw.rating,
          fetchedAt: new Date(),
        },
        create: {
          mlId: raw.mlId,
          title: raw.title,
          salePrice: raw.salePrice,
          originalPrice: raw.originalPrice,
          discount: raw.discount,
          thumbnail: raw.thumbnail,
          permalink: raw.permalink,
          affiliateUrl,
          freeShipping: raw.freeShipping,
          seller: raw.seller,
          soldCount: raw.soldCount,
          rating: raw.rating,
          category: raw.category,
        },
      });

      if (!alreadySent.has(product.id)) {
        results.push(product);
      }
    }

    logger.info(
      { total: rawProducts.length, new: results.length, groupId },
      'Produtos filtrados para envio',
    );

    return results;
  }

  async getRecentProducts(take = 50): Promise<Product[]> {
    return prisma.product.findMany({ orderBy: { fetchedAt: 'desc' }, take });
  }
}

export const productService = new ProductService();
