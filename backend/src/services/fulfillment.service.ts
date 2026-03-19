import QRCode from 'qrcode';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket';
import { sendTicketEmail } from './email.service';

/**
 * Fulfills a paid order:
 * - For each ticket in the order, generates a QR code in-memory
 * - Sends ticket confirmation email with embedded QR
 * - Updates ticket emailSent flags
 *
 * This function is called asynchronously after a webhook confirms payment.
 * Errors are logged but do NOT affect the webhook response.
 */
export async function fulfillOrder(orderId: mongoose.Types.ObjectId): Promise<void> {
  const tickets = await Ticket.find({ orderId, status: 'ACTIVE' });

  if (tickets.length === 0) {
    console.warn(`⚠️  fulfillOrder: No ACTIVE tickets found for order ${orderId}`);
    return;
  }

  const totalTickets = tickets.length;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const ticketIndex = i + 1;

    try {
      // 1. Generate QR code as PNG buffer (in-memory, NOT stored in DB)
      const qrBuffer = await QRCode.toBuffer(ticket.uuid, {
        type: 'png',
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      });

      // 2. Send email with QR code attached inline
      await sendTicketEmail(
        ticket.buyerEmail,
        ticket.buyerName,
        ticket.uuid,
        ticket.orderCode,
        qrBuffer,
        ticketIndex,
        totalTickets
      );

      // 3. Mark email as sent
      await Ticket.updateOne(
        { _id: ticket._id },
        { emailSent: true, emailSentAt: new Date() }
      );

      console.log(`📧 Ticket email sent: ${ticket.uuid} → ${ticket.buyerEmail} (${ticketIndex}/${totalTickets})`);
    } catch (err) {
      console.error(`❌ Failed to fulfill ticket ${ticket.uuid}:`, err);
      // Continue with the next ticket — don't fail the whole batch
    }
  }
}

/**
 * Re-send the ticket email for a single ticket.
 * Used by the admin "resend email" API.
 */
export async function resendTicketEmail(ticketId: mongoose.Types.ObjectId): Promise<void> {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  // Find sibling count for "X of Y" display
  const siblingCount = await Ticket.countDocuments({ orderId: ticket.orderId, status: { $in: ['ACTIVE', 'INACTIVE'] } });

  // Generate QR code fresh
  const qrBuffer = await QRCode.toBuffer(ticket.uuid, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });

  await sendTicketEmail(
    ticket.buyerEmail,
    ticket.buyerName,
    ticket.uuid,
    ticket.orderCode,
    qrBuffer,
    1, // re-send always shows as ticket 1
    siblingCount
  );

  await Ticket.updateOne(
    { _id: ticket._id },
    { emailSent: true, emailSentAt: new Date() }
  );
}
