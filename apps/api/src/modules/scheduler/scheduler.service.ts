import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../../config/database';
import { campaignService } from '../campaigns/campaign.service';
import { logger } from '../../config/logger';

class SchedulerService {
  private tasks = new Map<string, ScheduledTask>();

  /** Carrega e registra todas as campanhas ativas ao iniciar o servidor */
  async loadActiveCampaigns(): Promise<void> {
    const campaigns = await prisma.campaign.findMany({ where: { active: true } });
    for (const c of campaigns) {
      this.registerCampaign(c.id, c.cronExpr);
    }
    logger.info({ count: campaigns.length }, 'Campanhas ativas carregadas no scheduler');
  }

  registerCampaign(campaignId: string, cronExpr: string): void {
    // Remove task anterior se existir
    this.removeCampaign(campaignId);

    if (!cron.validate(cronExpr)) {
      logger.warn({ campaignId, cronExpr }, 'Expressão cron inválida — campanha não agendada');
      return;
    }

    const task = cron.schedule(
      cronExpr,
      async () => {
        logger.info({ campaignId }, '⏰ Executando campanha agendada');
        await prisma.schedule.create({
          data: { campaignId, runAt: new Date(), status: 'running' },
        });

        try {
          const result = await campaignService.runCampaign(campaignId);
          logger.info({ campaignId, ...result }, 'Campanha executada');

          await prisma.schedule.updateMany({
            where: { campaignId, status: 'running' },
            data: { status: 'done' },
          });
        } catch (err) {
          logger.error({ err, campaignId }, 'Erro na execução da campanha');
          await prisma.schedule.updateMany({
            where: { campaignId, status: 'running' },
            data: { status: 'failed' },
          });
        }
      },
      { timezone: 'America/Sao_Paulo' },
    );

    this.tasks.set(campaignId, task);
    logger.info({ campaignId, cronExpr }, 'Campanha registrada no scheduler');
  }

  removeCampaign(campaignId: string): void {
    const task = this.tasks.get(campaignId);
    if (task) {
      task.stop();
      this.tasks.delete(campaignId);
      logger.info({ campaignId }, 'Campanha removida do scheduler');
    }
  }

  listScheduled(): string[] {
    return [...this.tasks.keys()];
  }
}

export const schedulerService = new SchedulerService();
