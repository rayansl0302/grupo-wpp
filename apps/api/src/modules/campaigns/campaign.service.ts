import { prisma } from '../../config/database';
import { productService } from '../products/product.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { buildMessage, type TemplateType } from '../../shared/templates/message.template';
import { isWithinActiveHours, chunkArray, backoffDelay } from '../../shared/utils/anti-ban';
import { aiTextService } from '../ai/ai-text.service';
import { logger } from '../../config/logger';
import type { Campaign, WhatsAppGroup } from '@prisma/client';

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
      const { sent, failed } = await this.sendToGroup(campaign, group, keyword);
      totalSent += sent;
      totalFailed += failed;
    }

    return { sent: totalSent, failed: totalFailed };
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

    const products = await productService.fetchAndFilter(
      {
        query: keyword,
        minDiscount: campaign.minDiscount,
        maxPrice: campaign.maxPrice ?? undefined,
        minPrice: campaign.minPrice ?? undefined,
        freeShipping: campaign.freeShipping,
        limit: Math.min(remaining, 5),
      },
      group.id,
    );

    if (products.length === 0) {
      logger.info({ campaignId: campaign.id, groupId: group.id, keyword }, 'Nenhum produto novo para enviar');
      console.log(`[CAMPAIGN] Sem produtos para keyword "${keyword}". Verifique filtros (minDiscount, maxPrice, freeShipping).`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Envia em lotes de 2 produtos para não parecer spam
    const batches = chunkArray(products, 2);

    for (const batch of batches) {
      for (const product of batch) {
        const affiliateUrl = product.affiliateUrl ?? product.permalink;

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

          await prisma.sentPost.create({
            data: {
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
        } catch (err) {
          failed++;
          await prisma.sentPost.create({
            data: {
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
