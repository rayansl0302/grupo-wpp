import { prisma } from '../../config/database';
import { crawlCoupons } from '../mercadolivre/ml.coupons-crawler';
import { mlService } from '../mercadolivre/ml.service';
import { log } from '../logs/app-logger';
import type { Coupon } from '@prisma/client';

const CACHE_TTL_HOURS = 6; // cupons mudam menos frequente que produtos

class CouponService {
  /**
   * Busca cupons do ML — usa cache de 6h.
   */
  async fetchAndCache(): Promise<Coupon[]> {
    const cacheLimit = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);

    // Verifica cache
    const cached = await prisma.coupon.findMany({
      where: { fetchedAt: { gte: cacheLimit } },
      orderBy: { fetchedAt: 'desc' },
      take: 50,
    });

    if (cached.length >= 5) {
      console.log(`[COUPON] CACHE HIT: ${cached.length} cupons recentes`);
      return cached;
    }

    // Busca novos
    log.info('crawler', 'Iniciando crawler de cupons');
    const raw = await crawlCoupons(30);

    if (raw.length === 0) {
      log.warn('crawler', 'Crawler de cupons retornou vazio');
      return cached; // retorna o que tem no banco mesmo que < 5
    }

    // Persiste
    const saved: Coupon[] = [];
    for (const r of raw) {
      try {
        const affiliateUrl = mlService.buildAffiliateUrl(r.url);
        const coupon = await prisma.coupon.upsert({
          where: { externalId: r.externalId },
          update: {
            title: r.title,
            description: r.description,
            code: r.code,
            discount: r.discount,
            thumbnail: r.thumbnail,
            url: r.url,
            affiliateUrl,
            store: r.store,
            fetchedAt: new Date(),
          },
          create: {
            externalId: r.externalId,
            title: r.title,
            description: r.description,
            code: r.code,
            discount: r.discount,
            thumbnail: r.thumbnail,
            url: r.url,
            affiliateUrl,
            store: r.store,
          },
        });
        saved.push(coupon);
      } catch (err: any) {
        console.error(`[COUPON] Falha ao persistir cupom: ${err?.message}`);
      }
    }

    log.info('crawler', `Cupons persistidos: ${saved.length}`, { total: raw.length });
    return saved;
  }

  /**
   * Pega cupom aleatorio que ainda nao foi enviado pro grupo.
   */
  async getRandomForGroup(groupId: string): Promise<Coupon | null> {
    const all = await this.fetchAndCache();

    const alreadySent = await prisma.sentCoupon.findMany({
      where: { groupId },
      select: { couponId: true },
    });
    const sentIds = new Set(alreadySent.map((s) => s.couponId));

    const eligible = all.filter((c) => !sentIds.has(c.id));
    if (eligible.length === 0) return null;

    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  async listAll(limit = 50): Promise<Coupon[]> {
    return prisma.coupon.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: limit,
    });
  }
}

export const couponService = new CouponService();
