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
        const affiliateUrl = r.url ? mlService.buildAffiliateUrl(r.url) : null;
        // Tenta parsear "1 de junho" pra date (best effort)
        let validUntilDate: Date | null = null;
        if (r.validUntil) {
          const m = r.validUntil.match(/(\d+)\s+de\s+(\w+)/i);
          if (m) {
            const months: Record<string, number> = {
              janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
              julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
            };
            const month = months[m[2].toLowerCase()];
            if (month !== undefined) {
              const now = new Date();
              const year = now.getMonth() > month ? now.getFullYear() + 1 : now.getFullYear();
              validUntilDate = new Date(year, month, parseInt(m[1]));
            }
          }
        }

        const description = [r.description, r.budget ? `Orçamento restante: R$ ${r.budget}` : null]
          .filter(Boolean)
          .join(' · ');

        const coupon = await prisma.coupon.upsert({
          where: { externalId: r.externalId },
          update: {
            title: r.title,
            description: description || null,
            code: r.code,
            discount: r.discount,
            thumbnail: r.thumbnail,
            url: r.url,
            affiliateUrl,
            store: r.store,
            validUntil: validUntilDate,
            fetchedAt: new Date(),
          },
          create: {
            externalId: r.externalId,
            title: r.title,
            description: description || null,
            code: r.code,
            discount: r.discount,
            thumbnail: r.thumbnail,
            url: r.url,
            affiliateUrl,
            store: r.store,
            validUntil: validUntilDate,
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
