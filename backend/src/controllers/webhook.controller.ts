import { Request, Response } from 'express';
import Order from '../models/Order';
import Ticket from '../models/Ticket';
import payos from '../services/payos.service';
import { fulfillOrder } from '../services/fulfillment.service';

/**
 * POST /api/webhooks/payos
 *
 * Handles PayOS payment confirmation webhook.
 * - Verifies checksum/signature
 * - Idempotency: only processes PENDING → PAID transition
 * - Activates tickets
 * - Triggers async fulfillment (QR + email)
 *
 * MUST always return 200 to acknowledge receipt to PayOS.
 */
export async function handlePayOSWebhook(req: Request, res: Response): Promise<void> {
  try {
    // ── Step 1: Verify webhook signature ──────────────────────
    let webhookData;
    try {
      webhookData = payos.verifyPaymentWebhookData(req.body);
    } catch {
      console.warn('⚠️  Webhook checksum verification failed:', JSON.stringify(req.body).slice(0, 200));
      res.status(200).json({ success: true });
      return;
    }

    // PayOS test webhook (orderCode === 123) — acknowledge and skip
    if (webhookData.orderCode === 123) {
      console.log('ℹ️  PayOS test webhook received — acknowledged');
      res.status(200).json({ success: true });
      return;
    }

    const { orderCode } = webhookData;
    console.log(`📥 Webhook received for orderCode: ${orderCode}`);

    // ── Step 2: Idempotent order update ───────────────────────
    // Only update if status is currently PENDING.
    // If already PAID/EXPIRED/CANCELLED, this returns null (no-op).
    const order = await Order.findOneAndUpdate(
      { orderCode, status: 'PENDING' },
      { status: 'PAID', paidAt: new Date() },
      { new: true }
    );

    if (!order) {
      console.log(`ℹ️  Webhook for orderCode ${orderCode}: order not PENDING (already processed or expired)`);
      res.status(200).json({ success: true });
      return;
    }

    // ── Step 3: Activate all HOLDING tickets ──────────────────
    const updateResult = await Ticket.updateMany(
      { orderId: order._id, status: 'HOLDING' },
      { status: 'ACTIVE' }
    );

    console.log(`✅ Order ${orderCode} → PAID | ${updateResult.modifiedCount} tickets activated`);

    // ── Step 4: Trigger fulfillment (async, non-blocking) ─────
    // Generate QR codes + send emails in the background.
    // Errors are logged internally but never block the 200 response.
    fulfillOrder(order._id).catch((err) => {
      console.error(`❌ Fulfillment failed for order ${orderCode}:`, err);
    });

  } catch (err) {
    // Log but NEVER fail the webhook — PayOS must always get 200
    console.error('❌ Unexpected webhook error:', err);
  }

  // ALWAYS return 200
  res.status(200).json({ success: true });
}
