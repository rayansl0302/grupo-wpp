import { prisma } from '../../config/database';
import { productService } from '../products/product.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { buildMessage, type TemplateType } from '../../shared/templates/message.template';
import { isWithinActiveHours, chunkArray, backoffDelay } from '../../shared/utils/anti-ban';
import { aiTextService } from '../ai/ai-text.service';
import { logger } from '../../config/logger';
import { log } from '../logs/app-logger';
import type { Campaign, WhatsAppGroup } from '@prisma/client';

/**
 * Verifica se o link e "oficial" (apto pra afiliacao com tracking correto).
 *
 * ML: gerado pelo painel ML (meli.la/XXX, /sec/XXX, /social/XXX).
 *     Links com matt_word manual sao considerados fallback (nao oficial).
 *
 * Shopee: a API Affiliate ja retorna offerLink/permalink com tag de afiliado
 *         embutida (productOfferV2). Qualquer link shopee.com.br ou
 *         s.shopee.com.br vindo da nossa integracao oficial e valido.
 */
function isOfficialAffiliateLink(url: string | null | undefined, provider?: 'ml' | 'shopee'): boolean {
  if (!url) return false;
  // Shopee: API oficial sempre retorna link de afiliado pronto
  if (provider === 'shopee') {
    return /shopee\.com\.br/i.test(url) || /s\.shopee\.com\.br/i.test(url);
  }
  // ML: precisa ser meli.la, /sec/ ou /social/
  return /meli\.la\//i.test(url) || /\/sec\//i.test(url) || /\/social\//i.test(url);
}

/** Se REQUIRE_OFFICIAL_LINK=true, descarta produtos sem link oficial */
const REQUIRE_OFFICIAL_LINK = process.env.REQUIRE_OFFICIAL_LINK === 'true';

/**
 * Cap de produtos buscados por execucao, por provider.
 * Reduzir o ML diminui consumo de banda IPRoyal (proxy pago).
 * Shopee usa API oficial gratuita - pode buscar mais.
 *
 * Defaults pensados pra estrategia "Shopee primario, ML magro":
 *   ML_MAX_PER_RUN=1     -> 1 produto ML por execucao (economia maxima de proxy)
 *   SHOPEE_MAX_PER_RUN=5 -> 5 produtos Shopee por execucao (volume alto, sem custo)
 */
const ML_MAX_PER_RUN = Number(process.env.ML_MAX_PER_RUN ?? 1);
const SHOPEE_MAX_PER_RUN = Number(process.env.SHOPEE_MAX_PER_RUN ?? 5);

function maxPerRun(provider: 'ml' | 'shopee'): number {
  return provider === 'shopee' ? SHOPEE_MAX_PER_RUN : ML_MAX_PER_RUN;
}

export class CampaignService {
  /**
   * Executa uma campanha: busca produtos e envia para todos os grupos ativos.
   * Chamado pelo Scheduler ou manualmente via API.
   */
  async runCampaign(campaignId: string): Promise<{ sent: number; failed: number }> {
    if (!isWithinActiveHours()) {
      logger.info({ campaignId }, 'Fora do horário ativo — campanha adiada');
      return { sent: 0, failed: 0 };
    }

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { groups: { include: { group: { include: { session: true } } } } },
    });

    if (!campaign.active) return { sent: 0, failed: 0 };

    const keywords: string[] = JSON.parse(campaign.keywords || '[]');
    const keyword = keywords[Math.floor(Math.random() * keywords.length)] ?? '';

    let totalSent = 0;
    let totalFailed = 0;

    const activeGroups = campaign.groups
      .map((cg) => cg.group)
      .filter((g) => g.active && g.session.status === 'connected');

    for (const group of activeGroups) {
      // Roteamento baseado no contentType da campanha
      const contentType = (campaign as any).contentType || 'product';

      let result: { sent: number; failed: number };
      if (contentType === 'coupon') {
        result = await this.sendCouponToGroup(campaign, group);
      } else if (contentType === 'social-profile') {
        result = await this.sendSocialProfileToGroup(campaign, group);
      } else if (contentType === 'mixed') {
        // 50/50 entre produto e cupom
        if (Math.random() < 0.5) {
          result = await this.sendCouponToGroup(campaign, group);
        } else {
          result = await this.sendToGroup(campaign, group, keyword);
        }
      } else {
        // 'product' (default)
        result = await this.sendToGroup(campaign, group, keyword);
      }

      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  }

  /**
   * Envia 1 cupom aleatorio (ainda nao enviado) pro grupo.
   */
  private async sendCouponToGroup(
    campaign: Campaign,
    group: WhatsAppGroup & { session: { name: string } },
  ): Promise<{ sent: number; failed: number }> {
    const { couponService } = await import('../coupons/coupon.service');
    const { buildCouponMessage } = await import('../../shared/templates/coupon.template');

    // Checa limite diario
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.sentPost.count({
      where: { groupId: group.id, sentAt: { gte: today } },
    });
    if (sentToday >= group.dailyLimit) {
      return { sent: 0, failed: 0 };
    }

    const coupon = await couponService.getRandomForGroup(group.id);
    if (!coupon) {
      log.warn('campaign', 'Sem cupons disponiveis para enviar', { groupId: group.id });
      return { sent: 0, failed: 0 };
    }

    const affiliateUrl = coupon.affiliateUrl || coupon.url;
    const message = buildCouponMessage(coupon, affiliateUrl);

    try {
      if (coupon.thumbnail) {
        await whatsappService.sendImageWithCaption(group.session.name, group.jid, coupon.thumbnail, message);
      } else {
        await whatsappService.sendText(group.session.name, group.jid, message);
      }

      await prisma.sentCoupon.upsert({
        where: { couponId_groupId: { couponId: coupon.id, groupId: group.id } },
        update: { status: 'sent', sentAt: new Date(), error: null, message },
        create: {
          couponId: coupon.id,
          groupId: group.id,
          campaignId: campaign.id,
          sessionId: group.sessionId,
          message,
          status: 'sent',
        },
      });

      log.info('campaign', `Cupom enviado: ${coupon.title.slice(0, 60)}`, {
        campaignId: campaign.id,
        couponId: coupon.id,
        groupName: group.name,
      });
      return { sent: 1, failed: 0 };
    } catch (err: any) {
      log.error('campaign', 'Falha ao enviar cupom', {
        error: String(err).slice(0, 200),
        couponId: coupon.id,
      });
      return { sent: 0, failed: 1 };
    }
  }

  /**
   * Envia link do perfil social do afiliado com produtos em destaque.
   */
  private async sendSocialProfileToGroup(
    campaign: Campaign,
    group: WhatsAppGroup & { session: { name: string } },
  ): Promise<{ sent: number; failed: number }> {
    const { buildSocialProfileMessage } = await import('../../shared/templates/social-profile.template');

    const username = process.env.ML_AFFILIATE_USERNAME || process.env.ML_AFFILIATE_ID;
    if (!username) {
      log.warn('campaign', 'ML_AFFILIATE_USERNAME nao configurado', {});
      return { sent: 0, failed: 0 };
    }

    const profileUrl = `https://www.mercadolivre.com.br/social/${username}`;

    // Pega 4 produtos recentes pra destaque (cache do banco)
    const highlights = await prisma.product.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 4,
      where: { permalink: { contains: 'MLB' } },
    });

    const message = buildSocialProfileMessage(profileUrl, highlights);

    try {
      await whatsappService.sendText(group.session.name, group.jid, message);

      log.info('campaign', 'Perfil social enviado', {
        campaignId: campaign.id,
        groupName: group.name,
        highlightsCount: highlights.length,
      });
      return { sent: 1, failed: 0 };
    } catch (err: any) {
      log.error('campaign', 'Falha ao enviar perfil social', {
        error: String(err).slice(0, 200),
      });
      return { sent: 0, failed: 1 };
    }
  }

  /**
   * Modo TESTE: envia apenas 1 produto aleatorio (ignora dailyLimit e horario ativo).
   */
  async runCampaignTest(campaignId: string): Promise<{ sent: number; failed: number; product?: string }> {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { groups: { include: { group: { include: { session: true } } } } },
    });

    const keywords: string[] = JSON.parse(campaign.keywords || '[]');
    const keyword = keywords[Math.floor(Math.random() * keywords.length)] ?? '';

    const activeGroups = campaign.groups
      .map((cg) => cg.group)
      .filter((g) => g.session.status === 'connected');

    if (activeGroups.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const group = activeGroups[0]; // envia so no primeiro grupo elegivel

    // Busca 1 produto
    const { productService } = await import('../products/product.service');
    const { buildMessage } = await import('../../shared/templates/message.template');
    const { whatsappService } = await import('../whatsapp/whatsapp.service');

    const provider = ((campaign as any).provider || 'ml') as 'ml' | 'shopee';
    const products = await productService.fetchAndFilter(
      {
        query: keyword,
        minDiscount: campaign.minDiscount,
        maxPrice: campaign.maxPrice ?? undefined,
        minPrice: campaign.minPrice ?? undefined,
        freeShipping: campaign.freeShipping,
        limit: 1,
      },
      group.id,
      provider,
    );

    if (products.length === 0) {
      console.log(`[TEST] fetchAndFilter retornou 0 produtos (keyword: "${keyword}", provider: ${provider})`);
      console.log(`[TEST] Causa provavel: todos ja foram enviados a este grupo OU filtros muito restritivos`);
      return { sent: 0, failed: 0 };
    }

    // Se REQUIRE_OFFICIAL_LINK estiver ligado, filtra produtos sem link oficial
    const eligible = REQUIRE_OFFICIAL_LINK
      ? products.filter((p) => isOfficialAffiliateLink(p.affiliateUrl, provider))
      : products;

    if (eligible.length === 0) {
      const linkSample = products[0]?.affiliateUrl?.slice(0, 80);
      console.log(`[TEST] Nenhum produto passou em REQUIRE_OFFICIAL_LINK (provider=${provider})`);
      console.log(`[TEST] Link rejeitado (exemplo): ${linkSample}`);
      log.warn('campaign', '[TESTE] Nenhum produto com link oficial', {
        campaignId: campaign.id,
        provider,
        triedProducts: products.length,
        linkSample,
        REQUIRE_OFFICIAL_LINK,
      });
      return { sent: 0, failed: 0 };
    }

    const product = eligible[0];

    const affiliateUrl = product.affiliateUrl ?? product.permalink;
    const message = buildMessage(product, affiliateUrl, campaign.templateType as TemplateType);

    try {
      if (product.thumbnail) {
        await whatsappService.sendImageWithCaption(
          group.session.name,
          group.jid,
          product.thumbnail,
          message,
        );
      } else {
        await whatsappService.sendText(group.session.name, group.jid, message);
      }

      await prisma.sentPost.upsert({
        where: { productId_groupId: { productId: product.id, groupId: group.id } },
        update: { message, status: 'sent', sentAt: new Date(), error: null },
        create: {
          productId: product.id,
          groupId: group.id,
          campaignId: campaign.id,
          sessionId: group.sessionId,
          message,
          status: 'sent',
        },
      });

      return { sent: 1, failed: 0, product: product.title };
    } catch (err) {
      logger.error({ err }, '[TEST] Falha ao enviar produto teste');
      return { sent: 0, failed: 1 };
    }
  }

  private async sendToGroup(
    campaign: Campaign,
    group: WhatsAppGroup & { session: { name: string } },
    keyword: string,
  ): Promise<{ sent: number; failed: number }> {
    // Checa limite diário do grupo
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.sentPost.count({
      where: { groupId: group.id, sentAt: { gte: today } },
    });

    if (sentToday >= group.dailyLimit) {
      logger.info({ groupId: group.id, sentToday }, 'Limite diário atingido para o grupo');
      return { sent: 0, failed: 0 };
    }

    const remaining = group.dailyLimit - sentToday;

    const provider = ((campaign as any).provider || 'ml') as 'ml' | 'shopee';
    // Cap por provider: ML magro (1), Shopee gordo (5) - configuravel via env
    const providerCap = maxPerRun(provider);
    const products = await productService.fetchAndFilter(
      {
        query: keyword,
        minDiscount: campaign.minDiscount,
        maxPrice: campaign.maxPrice ?? undefined,
        minPrice: campaign.minPrice ?? undefined,
        freeShipping: campaign.freeShipping,
        limit: Math.min(remaining, providerCap),
      },
      group.id,
      provider,
    );

    if (products.length === 0) {
      logger.info({ campaignId: campaign.id, groupId: group.id, keyword }, 'Nenhum produto novo para enviar');
      console.log(`[CAMPAIGN] Sem produtos para keyword "${keyword}". Verifique filtros (minDiscount, maxPrice, freeShipping).`);
      return { sent: 0, failed: 0 };
    }

    // Se REQUIRE_OFFICIAL_LINK ativado, filtra produtos sem link oficial
    // (ML: meli.la/sec/social, Shopee: shopee.com.br/s.shopee.com.br)
    const eligibleProducts = REQUIRE_OFFICIAL_LINK
      ? products.filter((p) => {
          const ok = isOfficialAffiliateLink(p.affiliateUrl, provider);
          if (!ok) console.log(`[CAMPAIGN] Descartado (sem link oficial, provider=${provider}): ${p.title?.slice(0, 60)}`);
          return ok;
        })
      : products;

    if (eligibleProducts.length === 0) {
      console.log(`[CAMPAIGN] Nenhum produto com link oficial - LinkGenerator pode estar com problema`);
      log.warn('campaign', 'Todos produtos cairam no fallback matt_word - LinkGen falhou', {
        campaignId: campaign.id,
        keyword,
        tried: products.length,
      });
      return { sent: 0, failed: 0 };
    }

    if (eligibleProducts.length < products.length) {
      log.warn('campaign', `${products.length - eligibleProducts.length} produto(s) descartado(s) por falta de link oficial`, {
        campaignId: campaign.id,
        kept: eligibleProducts.length,
        dropped: products.length - eligibleProducts.length,
      });
    }

    let sent = 0;
    let failed = 0;

    // Envia em lotes de 2 produtos para não parecer spam
    const batches = chunkArray(eligibleProducts, 2);

    for (const batch of batches) {
      for (const product of batch) {
        const affiliateUrl = product.affiliateUrl ?? product.permalink;
        console.log(`[SEND] permalink: ${product.permalink}`);
        console.log(`[SEND] affiliateUrl: ${affiliateUrl}`);

        let message: string;
        if (campaign.useAI) {
          message = await aiTextService
            .generateMessage(product, affiliateUrl)
            .catch(() => buildMessage(product, affiliateUrl, campaign.templateType as TemplateType));
        } else {
          message = buildMessage(product, affiliateUrl, campaign.templateType as TemplateType);
        }

        try {
          if (product.thumbnail) {
            await whatsappService.sendImageWithCaption(
              group.session.name,
              group.jid,
              product.thumbnail,
              message,
            );
          } else {
            await whatsappService.sendText(group.session.name, group.jid, message);
          }

          // Usa upsert pra evitar erro P2002 (mesma productId+groupId enviado 2x)
          await prisma.sentPost.upsert({
            where: { productId_groupId: { productId: product.id, groupId: group.id } },
            update: { message, status: 'sent', sentAt: new Date(), error: null },
            create: {
              productId: product.id,
              groupId: group.id,
              campaignId: campaign.id,
              sessionId: group.sessionId,
              message,
              status: 'sent',
            },
          });

          sent++;
          logger.info({ productId: product.id, groupId: group.id }, 'Produto enviado');
          log.info('campaign', `Produto enviado: ${product.title.slice(0, 60)}`, {
            campaignId: campaign.id,
            campaignName: campaign.name,
            groupName: group.name,
            productId: product.id,
            price: product.salePrice,
            discount: product.discount,
          });
        } catch (err) {
          failed++;
          await prisma.sentPost.upsert({
            where: { productId_groupId: { productId: product.id, groupId: group.id } },
            update: { status: 'failed', error: String(err), sentAt: new Date() },
            create: {
              productId: product.id,
              groupId: group.id,
              campaignId: campaign.id,
              sessionId: group.sessionId,
              message,
              status: 'failed',
              error: String(err),
            },
          });
          logger.error({ err, productId: product.id }, 'Falha ao enviar produto');
          log.error('campaign', `Falha ao enviar: ${product.title.slice(0, 60)}`, {
            error: String(err).slice(0, 200),
            productId: product.id,
            campaignId: campaign.id,
          });
          await backoffDelay(failed);
        }
      }

      // Pausa maior entre batches (5-15 min) para parecer orgânico
      if (batches.indexOf(batch) < batches.length - 1) {
        const batchDelay = 300_000 + Math.floor(Math.random() * 600_000);
        logger.debug({ batchDelay }, 'Aguardando próximo batch');
        await new Promise((r) => setTimeout(r, batchDelay));
      }
    }

    return { sent, failed };
  }
}

export const campaignService = new CampaignService();
