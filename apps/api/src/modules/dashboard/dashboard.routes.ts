import { Router } from 'express';
import { prisma } from '../../config/database';
import { schedulerService } from '../scheduler/scheduler.service';

export const dashboardRouter = Router();

// GET /dashboard/stats — métricas gerais
dashboardRouter.get('/stats', async (_req, res) => {
  const [totalCampaigns, activeCampaigns, totalGroups, activeGroups, totalSent, failedSent, totalProducts] =
    await Promise.all([
      prisma.campaign.count(),
      prisma.campaign.count({ where: { active: true } }),
      prisma.whatsAppGroup.count(),
      prisma.whatsAppGroup.count({ where: { active: true } }),
      prisma.sentPost.count({ where: { status: 'sent' } }),
      prisma.sentPost.count({ where: { status: 'failed' } }),
      prisma.product.count(),
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentToday = await prisma.sentPost.count({ where: { sentAt: { gte: today } } });

  const scheduledCampaigns = schedulerService.listScheduled().length;

  res.json({
    campaigns: { total: totalCampaigns, active: activeCampaigns },
    groups: { total: totalGroups, active: activeGroups },
    posts: { total: totalSent, failed: failedSent, today: sentToday },
    products: { total: totalProducts },
    scheduler: { active: scheduledCampaigns },
  });
});

// GET /dashboard/history — histórico de envios paginado
dashboardRouter.get('/history', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.sentPost.findMany({
      skip,
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        product: { select: { title: true, salePrice: true, discount: true, thumbnail: true } },
        group: { select: { name: true } },
        campaign: { select: { name: true } },
      },
    }),
    prisma.sentPost.count(),
  ]);

  res.json({ data: posts, total, page, pages: Math.ceil(total / limit) });
});

// GET /dashboard/top-products — produtos mais enviados
dashboardRouter.get('/top-products', async (_req, res) => {
  const top = await prisma.sentPost.groupBy({
    by: ['productId'],
    _count: { productId: true },
    where: { status: 'sent' },
    orderBy: { _count: { productId: 'desc' } },
    take: 10,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: top.map((t) => t.productId) } },
    select: { id: true, title: true, salePrice: true, discount: true, thumbnail: true },
  });

  const result = top.map((t) => ({
    ...products.find((p) => p.id === t.productId),
    sentCount: t._count.productId,
  }));

  res.json(result);
});

// GET /dashboard/chart — dados para gráfico de envios por dia (últimos 7 dias)
dashboardRouter.get('/chart', async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const posts = await prisma.sentPost.findMany({
    where: { sentAt: { gte: since } },
    select: { sentAt: true, status: true },
  });

  const byDay: Record<string, { sent: number; failed: number }> = {};
  for (let i = 0; i <= 6; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    byDay[d.toISOString().split('T')[0]] = { sent: 0, failed: 0 };
  }

  for (const p of posts) {
    const key = p.sentAt.toISOString().split('T')[0];
    if (byDay[key]) {
      if (p.status === 'sent') byDay[key].sent++;
      else byDay[key].failed++;
    }
  }

  res.json(Object.entries(byDay).map(([date, counts]) => ({ date, ...counts })));
});
