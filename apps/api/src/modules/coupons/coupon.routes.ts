import { Router } from 'express';
import { couponService } from './coupon.service';

export const couponRouter = Router();

/** GET /coupons - lista cupons em cache */
couponRouter.get('/', async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const coupons = await couponService.listAll(limit);
  res.json(coupons);
});

/** POST /coupons/refresh - forca crawler de cupons */
couponRouter.post('/refresh', async (_req, res) => {
  try {
    const coupons = await couponService.fetchAndCache();
    res.json({ count: coupons.length, coupons: coupons.slice(0, 10) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
