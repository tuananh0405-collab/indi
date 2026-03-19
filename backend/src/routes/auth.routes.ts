import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { googleLogin } from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/auth/google
 * Body: { idToken: string }
 * Returns: { success, data: { token, admin } }
 */
router.post('/google', asyncHandler(googleLogin));

export default router;
