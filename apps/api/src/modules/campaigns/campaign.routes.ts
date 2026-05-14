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

// POST /campaigns/:id/run — executa manualmente
campaignRouter.post('/:id/run', async (req, res) => {
  const result = await campaignService.runCampaign(req.params.id);
  res.json(result);
});

// DELETE /campaigns/:id
campaignRouter.delete('/:id', async (req, res) => {
  schedulerService.removeCampaign(req.params.id);
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
