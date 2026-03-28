import QRCode from 'qrcode';
import { eq, and, inArray, sql as dsql } from 'drizzle-orm';
import { db, tickets } from '../db';
import { sendTicketEmail } from './email.service';

/**
 * Fulfills a paid order:
 * - For each ticket in the order, generates a QR code in-memory
 * - Sends ticket confirmation email with embedded QR
 * - Updates ticket emailSent flags
 */
export async function fulfillOrder(orderId: number): Promise<void> {
  const orderTickets = db.select().from(tickets)
    .where(and(eq(tickets.orderId, orderId), eq(tickets.status, 'ACTIVE')))
    .all();

  if (orderTickets.length === 0) {
    console.warn(`⚠️  fulfillOrder: No ACTIVE tickets found for order ${orderId}`);
    return;
  }

  const totalTickets = orderTickets.length;

  for (let i = 0; i < orderTickets.length; i++) {
    const ticket = orderTickets[i];
    const ticketIndex = i + 1;

    try {
      // 1. Generate QR code as PNG buffer
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
      db.update(tickets)
        .set({ emailSent: true, emailSentAt: new Date().toISOString() })
        .where(eq(tickets.id, ticket.id))
        .run();

      console.log(`📧 Ticket email sent: ${ticket.uuid} → ${ticket.buyerEmail} (${ticketIndex}/${totalTickets})`);
    } catch (err) {
      console.error(`❌ Failed to fulfill ticket ${ticket.uuid}:`, err);
    }
  }
}

/**
 * Re-send the ticket email for a single ticket.
 */
export async function resendTicketEmail(ticketId: number): Promise<void> {
  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();

  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  // Find sibling count
  const siblingResult = db.select({ count: dsql<number>`COUNT(*)` })
    .from(tickets)
    .where(and(
      eq(tickets.orderId, ticket.orderId),
      inArray(tickets.status, ['ACTIVE', 'INACTIVE'])
    ))
    .get();
  const siblingCount = siblingResult?.count ?? 1;

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
    1,
    siblingCount
  );

  db.update(tickets)
    .set({ emailSent: true, emailSentAt: new Date().toISOString() })
    .where(eq(tickets.id, ticket.id))
    .run();
}
