import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { handlePayOSWebhook } from '../controllers/webhook.controller';

const router = Router();

/**
 * POST /api/webhooks/payos
 * Body: PayOS webhook payload (verified via checksum)
 * Returns: { success: true } (always 200)
 */
router.post('/payos', asyncHandler(handlePayOSWebhook));

export default router;
