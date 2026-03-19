import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAdminJwt } from '../middlewares/auth.middleware';
import {
  listTickets,
  updateTicket,
  toggleTicketStatus,
  resendEmail,
  getDashboard,
  exportExcel,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes are JWT-protected
router.use(verifyAdminJwt);

/**
 * GET  /api/admin/tickets          — List & search with filters (US-10, 11)
 * PATCH /api/admin/tickets/:id      — Update buyer info + notes (US-13)
 * PATCH /api/admin/tickets/:id/toggle-status — Toggle Active/Inactive (US-12)
 * POST /api/admin/tickets/:id/resend-email   — Resend ticket email (US-14)
 * GET  /api/admin/dashboard          — Dashboard stats (US-18)
 * GET  /api/admin/export             — Export Excel .xlsx (US-19)
 */
router.get('/tickets', asyncHandler(listTickets));
router.patch('/tickets/:id', asyncHandler(updateTicket));
router.patch('/tickets/:id/toggle-status', asyncHandler(toggleTicketStatus));
router.post('/tickets/:id/resend-email', asyncHandler(resendEmail));
router.get('/dashboard', asyncHandler(getDashboard));
router.get('/export', asyncHandler(exportExcel));

export default router;
