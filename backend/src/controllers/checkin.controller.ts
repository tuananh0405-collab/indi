import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, sqlite, tickets, ticketTypes } from '../db';
import { AppError } from '../utils/AppError';

/**
 * POST /api/checkin
 *
 * Scans a QR code (UUID), validates the ticket, and marks it as checked in.
 * Edge cases: not found, already checked in, inactive ticket, expired ticket.
 */
export async function checkIn(req: Request, res: Response): Promise<void> {
  const { uuid } = req.body;

  if (!uuid || typeof uuid !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã QR (UUID) là bắt buộc.');
  }

  // Look up ticket with its type label
  const ticket = db.select({
    id: tickets.id,
    uuid: tickets.uuid,
    orderId: tickets.orderId,
    orderCode: tickets.orderCode,
    buyerName: tickets.buyerName,
    buyerEmail: tickets.buyerEmail,
    buyerPhone: tickets.buyerPhone,
    price: tickets.price,
    status: tickets.status,
    checkedIn: tickets.checkedIn,
    checkedInAt: tickets.checkedInAt,
    checkedInBy: tickets.checkedInBy,
    ticketTypeLabel: ticketTypes.label,
  })
    .from(tickets)
    .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
    .where(eq(tickets.uuid, uuid.trim()))
    .get();

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé với mã QR này.');
  }

  // Ticket is cancelled (order was cancelled)
  if (ticket.status === 'CANCELLED') {
    throw new AppError(403, 'TICKET_CANCELLED', 'Vé đã bị hủy. Liên hệ Ban Tổ Chức.');
  }

  // Ticket is inactive (admin disabled)
  if (ticket.status === 'INACTIVE') {
    throw new AppError(403, 'TICKET_INACTIVE', 'Vé đã bị vô hiệu hóa. Liên hệ Ban Tổ Chức.');
  }

  // Ticket is expired (TTL)
  if (ticket.status === 'EXPIRED' || ticket.status === 'HOLDING') {
    throw new AppError(
      410,
      'TICKET_EXPIRED',
      ticket.status === 'HOLDING'
        ? 'Vé này chưa được thanh toán.'
        : 'Vé đã hết hạn.'
    );
  }

  // Already checked in
  if (ticket.checkedIn) {
    const checkedInTime = ticket.checkedInAt
      ? new Date(ticket.checkedInAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : 'N/A';
    throw new AppError(
      409,
      'ALREADY_CHECKED_IN',
      `Vé này đã được check-in lúc ${checkedInTime}.`
    );
  }

  // ── Perform check-in (atomic) ───────────────────────────────
  const now = new Date().toISOString();
  // Get admin email from JWT if available
  const adminEmail = (req as any).admin?.email || '';

  const updated = sqlite.prepare(`
    UPDATE tickets
    SET checked_in = 1, checked_in_at = ?, checked_in_by = ?, updated_at = ?
    WHERE id = ? AND checked_in = 0 AND status = 'ACTIVE'
  `).run(now, adminEmail, now, ticket.id);

  if (updated.changes === 0) {
    throw new AppError(409, 'ALREADY_CHECKED_IN', 'Vé vừa được check-in bởi người khác.');
  }

  res.status(200).json({
    success: true,
    data: {
      ticketId: ticket.id,
      uuid: ticket.uuid,
      buyerName: ticket.buyerName,
      buyerEmail: ticket.buyerEmail,
      buyerPhone: ticket.buyerPhone,
      ticketType: ticket.ticketTypeLabel,
      status: ticket.status,
      checkedIn: true,
      checkedInAt: now,
      message: 'Check-in thành công! 🎉',
    },
  });
}
