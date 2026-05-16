import { prisma } from '../../config/database';
import { mlService } from '../mercadolivre/ml.service';
import { generateAffiliateLink } from '../mercadolivre/ml.link-generator';
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
    // CACHE: se ja temos produtos dessa keyword recentes (<2h), reusa do banco
    // Economiza banda do proxy e evita rate limit do ML
    const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (params.query) {
      const cached = await prisma.product.findMany({
        where: {
          title: { contains: params.query, mode: 'insensitive' },
          fetchedAt: { gte: TWO_HOURS_AGO },
          // Filtra produtos com URLs invalidas (legado do cache antigo)
          NOT: [
            { permalink: { contains: 'click1.mercadolivre' } },
            { permalink: { contains: '/mclics/' } },
          ],
          permalink: { contains: 'MLB' },
        },
        orderBy: { fetchedAt: 'desc' },
        take: 20,
      });
      if (cached.length >= 5) {
        console.log(`[PRODUCT] CACHE HIT: ${cached.length} produtos recentes para "${params.query}"`);
        const alreadySentIds = new Set(
          (await prisma.sentPost.findMany({ where: { groupId }, select: { productId: true } }))
            .map((s) => s.productId),
        );
        const fresh = cached.filter((p) => !alreadySentIds.has(p.id));
        if (fresh.length > 0) {
          return fresh.slice(0, params.limit ?? 5);
        }
      }
    }

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
    const seenProductIds = new Set<string>();

    for (const raw of rawProducts) {
      // 1a tentativa: link bonito via painel de afiliado (se ML_STORAGE_STATE estiver setado)
      let officialLink: string | null = null;
      if (process.env.ML_STORAGE_STATE) {
        officialLink = await generateAffiliateLink(raw.permalink).catch(() => null);
      }

      // Fallback: monta manualmente com matt_word
      const affiliatePermalink = officialLink ?? mlService.buildAffiliateUrl(raw.permalink);
      console.log(`[PRODUCT] origem: ${officialLink ? 'OFICIAL (painel)' : 'MANUAL (matt_word)'}`);
      console.log(`[PRODUCT] link: ${affiliatePermalink.slice(0, 100)}`);

      // So encurta links manuais - oficiais ja vem encurtados (meli.la)
      const affiliateUrl = officialLink
        ? officialLink
        : await shortenUrl(affiliatePermalink).catch(() => affiliatePermalink);

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

      // Dedup: nao adiciona o mesmo produto 2x no mesmo lote
      if (seenProductIds.has(product.id)) continue;
      seenProductIds.add(product.id);

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
