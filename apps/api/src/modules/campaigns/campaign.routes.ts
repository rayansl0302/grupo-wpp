import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { campaignService } from './campaign.service';
import { schedulerService } from '../scheduler/scheduler.service';

export const campaignRouter = Router();

const campaignSchema = z.object({
  name: z.string().min(2),
  keywords: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  minDiscount: z.number().min(0).max(100).default(0),
  maxPrice: z.number().optional(),
  minPrice: z.number().optional(),
  freeShipping: z.boolean().default(false),
  cronExpr: z.string().default('0 */2 * * *'),
  templateType: z.enum(['standard', 'hype', 'minimal', 'flash']).default('standard'),
  useAI: z.boolean().default(false),
  groupIds: z.array(z.string()),
});

// POST /campaigns
campaignRouter.post('/', async (req, res) => {
  const data = campaignSchema.parse(req.body);
  const { groupIds, keywords, categories, ...rest } = data;

  const campaign = await prisma.campaign.create({
    data: {
      ...rest,
      keywords: JSON.stringify(keywords),
      categories: JSON.stringify(categories),
      groups: { create: groupIds.map((groupId) => ({ groupId })) },
    },
    include: { groups: true },
  });

  schedulerService.registerCampaign(campaign.id, campaign.cronExpr);

  res.status(201).json(campaign);
});

// GET /campaigns
campaignRouter.get('/', async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      groups: { include: { group: { select: { name: true, jid: true } } } },
      _count: { select: { sentPosts: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(campaigns);
});

// GET /campaigns/:id
campaignRouter.get('/:id', async (req, res) => {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { groups: { include: { group: true } }, sentPosts: { take: 20, orderBy: { sentAt: 'desc' } } },
  });
  res.json(campaign);
});

// PATCH /campaigns/:id/toggle
campaignRouter.patch('/:id/toggle', async (req, res) => {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: req.params.id } });
  const updated = await prisma.campaign.update({
    where: { id: req.params.id },
    data: { active: !campaign.active },
  });

  if (updated.active) {
    schedulerService.registerCampaign(updated.id, updated.cronExpr);
  } else {
    schedulerService.removeCampaign(updated.id);
  }

  res.json(updated);
});

// POST /campaigns/:id/run - executa manualmente com diagnostico
campaignRouter.post('/:id/run', async (req, res) => {
  console.log(`\n[CAMPAIGN] Execucao manual iniciada: ${req.params.id}`);
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { groups: { include: { group: { include: { session: true } } } } },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    const diagnostics = {
      campaignActive: campaign.active,
      totalGroups: campaign.groups.length,
      activeGroups: campaign.groups.filter((cg) => cg.group.active).length,
      connectedGroups: campaign.groups.filter((cg) => cg.group.session.status === 'connected').length,
      eligibleGroups: campaign.groups.filter((cg) => cg.group.active && cg.group.session.status === 'connected').length,
      keywords: JSON.parse(campaign.keywords || '[]'),
    };

    console.log('[CAMPAIGN] Diagnostico:', diagnostics);

    if (!campaign.active) {
      return res.json({ sent: 0, failed: 0, diagnostics, warning: 'Campanha pausada (clique em Play para ativar)' });
    }
    if (diagnostics.eligibleGroups === 0) {
      return res.json({
        sent: 0, failed: 0, diagnostics,
        warning: `Nenhum grupo elegivel. Vinculados: ${diagnostics.totalGroups}, ativos: ${diagnostics.activeGroups}, conectados: ${diagnostics.connectedGroups}`,
      });
    }

    const result = await campaignService.runCampaign(req.params.id);
    console.log('[CAMPAIGN] Resultado:', result);
    res.json({ ...result, diagnostics });
  } catch (err: any) {
    console.error('[CAMPAIGN] Erro na execucao:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// DELETE /campaigns/:id
campaignRouter.delete('/:id', async (req, res) => {
  schedulerService.removeCampaign(req.params.id);
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
