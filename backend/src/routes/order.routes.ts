import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createOrder, getOrderStatus, devConfirmOrder } from '../controllers/order.controller';

const router = Router();

/**
 * POST /api/orders
 * Body: { buyerName, buyerEmail, buyerPhone, quantity, ticketPrice }
 * Returns: { success, data: { orderCode, quantity, totalAmount, status, paymentLink, expiresAt } }
 */
router.post('/', asyncHandler(createOrder));

/**
 * GET /api/orders/:orderCode/status
 * Returns: { success, data: { orderCode, status, ... } }
 */
router.get('/:orderCode/status', asyncHandler(getOrderStatus));

/**
 * POST /api/orders/:orderCode/dev-confirm
 * DEV ONLY — Simulates PayOS webhook to confirm payment.
 */
router.post('/:orderCode/dev-confirm', asyncHandler(devConfirmOrder));

export default router;
