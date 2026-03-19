import Counter from '../models/Counter';
import Order from '../models/Order';
import Ticket from '../models/Ticket';
import config from '../config';
import payos from '../services/payos.service';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Finds PENDING orders older than the TTL cutoff, expires them,
 * releases capacity back to the Counter, and cancels PayOS payment links.
 *
 * Each order is guarded with a status: 'PENDING' filter in the
 * findOneAndUpdate call to prevent race conditions.
 */
async function cleanupExpiredOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - config.orderTtlMinutes * 60 * 1000);

  const expiredOrders = await Order.find({
    status: 'PENDING',
    createdAt: { $lt: cutoff },
  });

  if (expiredOrders.length === 0) return;

  console.log(`🧹 TTL Cleanup: found ${expiredOrders.length} expired order(s)`);

  for (const order of expiredOrders) {
    // Atomic guard: only expire if still PENDING (prevents race with webhook)
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'PENDING' },
      { status: 'EXPIRED' },
      { new: true }
    );

    if (!updated) {
      // Order was already processed (e.g. webhook arrived just in time)
      continue;
    }

    // Release capacity back to pool
    await Counter.findOneAndUpdate(
      { _id: 'ticket_capacity' },
      { $inc: { sold: -updated.quantity } }
    );

    // Expire holding tickets
    await Ticket.updateMany(
      { orderId: updated._id, status: 'HOLDING' },
      { status: 'EXPIRED' }
    );

    // Cancel PayOS payment link (best-effort, don't throw on failure)
    try {
      if (updated.paymentLinkId && !updated.paymentLinkId.startsWith('mock-')) {
        await payos.cancelPaymentLink(updated.orderCode);
      }
    } catch (err) {
      console.warn(`⚠️  Failed to cancel PayOS link for order ${updated.orderCode}:`, err);
    }

    console.log(`🧹 Order ${updated.orderCode} expired → ${updated.quantity} ticket(s) released`);
  }
}

/**
 * Start the periodic TTL cleanup job.
 * Runs every 60 seconds.
 */
export function startTtlCleanupJob(): void {
  console.log(`⏰ TTL Cleanup job started (every 60s, TTL: ${config.orderTtlMinutes} min)`);

  // Run immediately on startup to catch any orders that expired while server was down
  cleanupExpiredOrders().catch((err) => {
    console.error('❌ TTL Cleanup error:', err);
  });

  intervalId = setInterval(() => {
    cleanupExpiredOrders().catch((err) => {
      console.error('❌ TTL Cleanup error:', err);
    });
  }, 60 * 1000);
}

/**
 * Stop the periodic TTL cleanup job (for graceful shutdown).
 */
export function stopTtlCleanupJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏰ TTL Cleanup job stopped');
  }
}
