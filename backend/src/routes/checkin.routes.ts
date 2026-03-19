import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAdminJwt } from '../middlewares/auth.middleware';
import { checkIn } from '../controllers/checkin.controller';

const router = Router();

/**
 * POST /api/checkin
 * Auth: Bearer JWT (admin/staff only)
 * Body: { uuid: string }
 */
router.post('/', verifyAdminJwt, asyncHandler(checkIn));

export default router;
