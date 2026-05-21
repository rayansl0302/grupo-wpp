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

// GET /dashboard/history — histórico unificado (produtos + cupons) paginado
dashboardRouter.get('/history', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const filterType = req.query.type as string | undefined; // 'product' | 'coupon' | undefined (todos)

  const [posts, postsTotal, coupons, couponsTotal] = await Promise.all([
    filterType === 'coupon' ? [] : prisma.sentPost.findMany({
      take: limit * page,
      orderBy: { sentAt: 'desc' },
      include: {
        product: { select: { title: true, salePrice: true, discount: true, thumbnail: true, provider: true } },
        group: { select: { name: true } },
        campaign: { select: { name: true } },
      },
    }),
    filterType === 'coupon' ? 0 : prisma.sentPost.count(),
    filterType === 'product' ? [] : prisma.sentCoupon.findMany({
      take: limit * page,
      orderBy: { sentAt: 'desc' },
      include: {
        coupon: { select: { title: true, discount: true, code: true, thumbnail: true, store: true } },
        group: { select: { name: true } },
        campaign: { select: { name: true } },
      },
    }),
    filterType === 'product' ? 0 : prisma.sentCoupon.count(),
  ]);

  // Normaliza pra formato unificado e ordena por sentAt desc
  type UnifiedItem = {
    id: string;
    type: 'product' | 'coupon';
    sentAt: Date;
    status: string;
    error: string | null;
    title: string;
    subtitle: string;
    thumbnail: string | null;
    groupName: string;
    campaignName: string | null;
    discount: number | string | null;
  };

  const unified: UnifiedItem[] = [
    ...(posts as any[]).map((p) => ({
      id: p.id,
      type: 'product' as const,
      provider: (p.product?.provider || 'ml') as 'ml' | 'shopee',
      sentAt: p.sentAt,
      status: p.status,
      error: p.error,
      title: p.product?.title || '—',
      subtitle: p.product?.salePrice ? `R$ ${p.product.salePrice.toFixed(2)}` : '—',
      thumbnail: p.product?.thumbnail || null,
      groupName: p.group?.name || '—',
      campaignName: p.campaign?.name || null,
      discount: p.product?.discount ?? null,
    })),
    ...(coupons as any[]).map((c) => ({
      id: c.id,
      type: 'coupon' as const,
      provider: 'ml' as 'ml' | 'shopee', // cupons hoje só são do ML
      sentAt: c.sentAt,
      status: c.status,
      error: c.error,
      title: c.coupon?.title || '—',
      subtitle: c.coupon?.store ? `🏪 ${c.coupon.store}` : (c.coupon?.code ? `🎟️ ${c.coupon.code}` : '—'),
      thumbnail: c.coupon?.thumbnail || null,
      groupName: c.group?.name || '—',
      campaignName: c.campaign?.name || null,
      discount: c.coupon?.discount ?? null,
    })),
  ];

  // Ordena combinado e pagina
  unified.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  const total = (postsTotal as number) + (couponsTotal as number);
  const skip = (page - 1) * limit;
  const paginated = unified.slice(skip, skip + limit);

  res.json({
    data: paginated,
    total,
    page,
    pages: Math.ceil(total / limit),
    counts: { products: postsTotal, coupons: couponsTotal },
  });
});

// GET /dashboard/history/:id — detalhes completos de um envio (produto OU cupom)
dashboardRouter.get('/history/:id', async (req, res) => {
  // Tenta encontrar como produto primeiro
  try {
    const post = await prisma.sentPost.findUnique({
      where: { id: req.params.id },
      include: {
        product: true,
        group: { include: { session: { select: { name: true, phoneNumber: true } } } },
        campaign: true,
      },
    });
    if (post) {
      return res.json({ ...post, type: 'product' });
    }
  } catch {}

  // Senao, tenta como cupom
  try {
    const sentCoupon = await prisma.sentCoupon.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        coupon: true,
        group: { include: { session: { select: { name: true, phoneNumber: true } } } },
        campaign: true,
      },
    });
    return res.json({ ...sentCoupon, type: 'coupon' });
  } catch (err: any) {
    res.status(404).json({ error: 'Envio nao encontrado' });
  }
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
