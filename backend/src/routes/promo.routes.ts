import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, promoCodes } from '../db';
import { AppError } from '../utils/AppError';

const router = Router();

/**
 * POST /api/promo/validate
 * Body: { code: string, subtotal: number }
 * Public — validates a promo code and returns the discount amount.
 */
router.post('/validate', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code, subtotal } = req.body;

  if (!code || typeof code !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã giảm giá là bắt buộc.');
  }
  if (!subtotal || typeof subtotal !== 'number' || subtotal <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tổng đơn hàng không hợp lệ.');
  }

  const normalizedCode = code.trim().toUpperCase();
  const promo = db.select().from(promoCodes)
    .where(and(eq(promoCodes.code, normalizedCode), eq(promoCodes.active, true)))
    .get();

  if (!promo) {
    throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
  }

  // Check date range (use epoch comparison to handle format differences)
  const nowMs = Date.now();
  if (promo.validFrom) {
    const fromMs = new Date(promo.validFrom.replace(' ', 'T') + (promo.validFrom.includes('Z') ? '' : 'Z')).getTime();
    if (nowMs < fromMs) {
      throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá chưa có hiệu lực.');
    }
  }
  if (promo.validUntil) {
    const untilMs = new Date(promo.validUntil.replace(' ', 'T') + (promo.validUntil.includes('Z') ? '' : 'Z')).getTime();
    if (nowMs > untilMs) {
      throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá đã hết hạn.');
    }
  }

  // Check usage limit
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw new AppError(400, 'PROMO_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng.');
  }

  // Check min order amount
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
    throw new AppError(400, 'INVALID_PROMO', `Đơn hàng tối thiểu ${promo.minOrderAmount.toLocaleString()}đ để sử dụng mã này.`);
  }

  // Calculate discount
  let discountAmount: number;
  if (promo.discountType === 'percent') {
    discountAmount = Math.floor(subtotal * promo.discountValue / 100);
  } else {
    discountAmount = Math.min(promo.discountValue, subtotal);
  }

  res.status(200).json({
    success: true,
    data: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
      finalAmount: subtotal - discountAmount,
    },
  });
}));

export default router;
