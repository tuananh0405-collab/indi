import { Request, Response } from 'express';
import Ticket from '../models/Ticket';
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

  const ticket = await Ticket.findOne({ uuid: uuid.trim() });

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé với mã QR này.');
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
      ? ticket.checkedInAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : 'N/A';
    throw new AppError(
      409,
      'ALREADY_CHECKED_IN',
      `Vé này đã được check-in lúc ${checkedInTime}.`
    );
  }

  // ── Perform check-in (atomic) ───────────────────────────────
  const now = new Date();
  const updated = await Ticket.findOneAndUpdate(
    { _id: ticket._id, checkedIn: false, status: 'ACTIVE' },
    { checkedIn: true, checkedInAt: now },
    { new: true }
  );

  if (!updated) {
    // Race condition: someone else checked in between our read and write
    throw new AppError(409, 'ALREADY_CHECKED_IN', 'Vé vừa được check-in bởi người khác.');
  }

  res.status(200).json({
    success: true,
    data: {
      ticketId: updated._id,
      uuid: updated.uuid,
      buyerName: updated.buyerName,
      buyerEmail: updated.buyerEmail,
      buyerPhone: updated.buyerPhone,
      ticketType: updated.ticketType,
      status: updated.status,
      checkedIn: updated.checkedIn,
      checkedInAt: updated.checkedInAt?.toISOString(),
      message: 'Check-in thành công! 🎉',
    },
  });
}
