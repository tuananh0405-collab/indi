import { eq, and, lt, sql } from 'drizzle-orm';
import { db, sqlite, orders, tickets, orderItems, ticketTypes } from '../db';
import config from '../config';
import payos from '../services/payos.service';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Finds PENDING orders older than the TTL cutoff, expires them,
 * releases per-type capacity back, and cancels PayOS payment links.
 */
function cleanupExpiredOrders(): void {
  // SQLite datetime('now') uses format: "YYYY-MM-DD HH:MM:SS" (no T, no Z)
  // We must match this format for string comparison to work correctly
  const cutoffDate = new Date(Date.now() - config.orderTtlMinutes * 60 * 1000);
  const cutoff = cutoffDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  const expiredOrders = db.select()
    .from(orders)
    .where(and(eq(orders.status, 'PENDING'), lt(orders.createdAt, cutoff)))
    .all();

  if (expiredOrders.length === 0) return;

  console.log(`🧹 TTL Cleanup: found ${expiredOrders.length} expired order(s)`);

  for (const order of expiredOrders) {
    // Use transaction for atomicity
    const wasExpired = sqlite.transaction(() => {
      // Atomic guard: only expire if still PENDING
      const updated = db.update(orders)
        .set({ status: 'EXPIRED', updatedAt: new Date().toISOString() })
        .where(and(eq(orders.id, order.id), eq(orders.status, 'PENDING')))
        .returning()
        .get();

      if (!updated) return false; // Already processed

      // Release per-type capacity
      const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).all();
      for (const item of items) {
        sqlite.prepare('UPDATE ticket_types SET sold = MAX(0, sold - ?) WHERE id = ?')
          .run(item.quantity, item.ticketTypeId);
      }

      // Expire holding tickets
      sqlite.prepare(`
        UPDATE tickets SET status = 'EXPIRED', updated_at = datetime('now')
        WHERE order_id = ? AND status = 'HOLDING'
      `).run(order.id);

      return true;
    })();

    if (!wasExpired) continue;

    // Cancel PayOS payment link (best-effort, outside transaction)
    try {
      if (order.paymentLinkId && !order.paymentLinkId.startsWith('mock-')) {
        payos.cancelPaymentLink(order.orderCode).catch((err: Error) => {
          console.warn(`⚠️  Failed to cancel PayOS link for order ${order.orderCode}:`, err);
        });
      }
    } catch (err) {
      console.warn(`⚠️  Failed to cancel PayOS link for order ${order.orderCode}:`, err);
    }

    console.log(`🧹 Order ${order.orderCode} expired → capacity released`);
  }
}

/**
 * Start the periodic TTL cleanup job.
 * Runs every 60 seconds.
 */
export function startTtlCleanupJob(): void {
  console.log(`⏰ TTL Cleanup job started (every 60s, TTL: ${config.orderTtlMinutes} min)`);

  // Run immediately on startup
  try {
    cleanupExpiredOrders();
  } catch (err) {
    console.error('❌ TTL Cleanup error:', err);
  }

  intervalId = setInterval(() => {
    try {
      cleanupExpiredOrders();
    } catch (err) {
      console.error('❌ TTL Cleanup error:', err);
    }
  }, 60 * 1000);
}

/**
 * Stop the periodic TTL cleanup job.
 */
export function stopTtlCleanupJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏰ TTL Cleanup job stopped');
  }
}
