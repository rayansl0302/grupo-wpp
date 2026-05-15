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

// PATCH /campaigns/:id - atualiza campanha
campaignRouter.patch('/:id', async (req, res) => {
  try {
    const partialSchema = campaignSchema.partial();
    const data = partialSchema.parse(req.body);
    const { groupIds, keywords, categories, ...rest } = data;

    const updateData: any = { ...rest };
    if (keywords !== undefined) updateData.keywords = JSON.stringify(keywords);
    if (categories !== undefined) updateData.categories = JSON.stringify(categories);

    // Se mandou groupIds, recria os vinculos
    const ops: Promise<any>[] = [
      prisma.campaign.update({ where: { id: req.params.id }, data: updateData }),
    ];

    if (groupIds !== undefined) {
      ops.push(prisma.campaignGroup.deleteMany({ where: { campaignId: req.params.id } }));
    }

    await Promise.all(ops);

    if (groupIds !== undefined && groupIds.length > 0) {
      await prisma.campaignGroup.createMany({
        data: groupIds.map((groupId) => ({ campaignId: req.params.id, groupId })),
        skipDuplicates: true,
      });
    }

    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { groups: { include: { group: { select: { name: true, jid: true } } } } },
    });

    // Reagenda o cron se mudou
    if (rest.cronExpr) {
      schedulerService.removeCampaign(req.params.id);
      if (campaign.active) {
        schedulerService.registerCampaign(req.params.id, campaign.cronExpr);
      }
    }

    res.json(campaign);
  } catch (err: any) {
    console.error('[CAMPAIGN] erro update:', err);
    res.status(400).json({ error: err.message, issues: err.issues });
  }
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

// GET /campaigns/test-search?q=fone -- testa direto se o ML retorna produtos
campaignRouter.get('/test-search', async (req, res) => {
  try {
    const { mlService } = await import('../mercadolivre/ml.service');
    const q = (req.query.q as string) || 'notebook';
    const products = await mlService.searchProducts({ query: q, limit: 5 });
    res.json({
      query: q,
      count: products.length,
      products: products.map((p) => ({
        title: p.title,
        salePrice: p.salePrice,
        originalPrice: p.originalPrice,
        discount: p.discount,
        thumbnail: p.thumbnail,
        permalink: p.permalink,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// POST /campaigns/:id/test - envia 1 produto aleatorio pra teste rapido
campaignRouter.post('/:id/test', async (req, res) => {
  try {
    console.log(`[CAMPAIGN-TEST] Iniciando teste: ${req.params.id}`);
    const result = await campaignService.runCampaignTest(req.params.id);
    console.log('[CAMPAIGN-TEST] Resultado:', result);
    res.json(result);
  } catch (err: any) {
    console.error('[CAMPAIGN-TEST] Erro:', err);
    res.status(500).json({ error: err.message });
  }
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

    // Testa busca antes de rodar a campanha completa
    const { mlService } = await import('../mercadolivre/ml.service');
    const testKeyword = diagnostics.keywords[0] || 'notebook';
    const testProducts = await mlService.searchProducts({
      query: testKeyword,
      minDiscount: campaign.minDiscount,
      maxPrice: campaign.maxPrice ?? undefined,
      freeShipping: campaign.freeShipping,
      limit: 3,
    });

    const productSearch = {
      keyword: testKeyword,
      foundCount: testProducts.length,
      sample: testProducts.slice(0, 2).map((p) => ({
        title: p.title,
        price: p.salePrice,
        discount: p.discount,
      })),
    };

    if (testProducts.length === 0) {
      return res.json({
        sent: 0, failed: 0, diagnostics, productSearch,
        warning: `ML retornou 0 produtos para "${testKeyword}". Tente baixar minDiscount ou desmarcar freeShipping.`,
      });
    }

    const result = await campaignService.runCampaign(req.params.id);
    console.log('[CAMPAIGN] Resultado:', result);
    res.json({ ...result, diagnostics, productSearch });
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
