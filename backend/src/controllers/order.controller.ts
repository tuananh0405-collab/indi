import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Counter from '../models/Counter';
import Order from '../models/Order';
import Ticket from '../models/Ticket';
import config from '../config';
import { AppError } from '../utils/AppError';
import payos from '../services/payos.service';
import { TICKET_TYPES, TicketType } from '../models/Ticket';
import { fulfillOrder } from '../services/fulfillment.service';

// ═══════════════════════════════════════════════════════════════
// Predefined Ticket Price List (server-authoritative)
// ═══════════════════════════════════════════════════════════════

/**
 * IMPORTANT: Prices are defined server-side to prevent client tampering.
 * The frontend sends only { ticketType, quantity }, and we look up the price here.
 * To update prices, change this map and redeploy.
 */
const TICKET_PRICE_LIST: Record<TicketType, number> = {
  EARLY_BIRD: 5_000,
  STANDARD: 10_000,
  VIP: 15_000,
};

// ─── Helper: Generate numeric order code ──────────────────────
// PayOS requires a unique numeric order code.
// We use Date.now() + random suffix for uniqueness.
function generateOrderCode(): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return Number(`${timestamp}${random}`.slice(-13));
}

// ─── Helper: Validate an item from the items array ────────────
interface OrderItemInput {
  ticketType: string;
  quantity: number;
}

function validateItems(items: unknown): OrderItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Danh sách vé (items) là bắt buộc và không được rỗng.');
  }

  const validated: OrderItemInput[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Mỗi item phải là một object { ticketType, quantity }.');
    }

    const { ticketType, quantity } = item as Record<string, unknown>;

    if (!ticketType || typeof ticketType !== 'string' || !TICKET_TYPES.includes(ticketType as TicketType)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Loại vé không hợp lệ: "${ticketType}". Chấp nhận: ${TICKET_TYPES.join(', ')}.`
      );
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', `Số lượng vé "${ticketType}" phải là số nguyên ≥ 1.`);
    }

    validated.push({ ticketType: ticketType as string, quantity: qty });
  }

  return validated;
}

/**
 * POST /api/orders
 *
 * Creates a new booking with multi-type ticket support:
 * 1. Validate items and compute quantities/prices server-side
 * 2. Atomically reserve capacity on the Counter (anti-overselling)
 * 3. Create Order (PENDING) with items array
 * 4. Create Ticket(s) with UUID v4, each with its ticketType and price (HOLDING)
 * 5. Generate payment link
 * 6. Return order info + payment link
 *
 * Payload: { buyerName, buyerEmail, buyerPhone, items: [{ ticketType, quantity }] }
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { buyerName, buyerEmail, buyerPhone, items } = req.body;

  // ── Input validation ──────────────────────────────────────
  if (!buyerName || typeof buyerName !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Họ tên người mua là bắt buộc.');
  }
  if (!buyerEmail || typeof buyerEmail !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email là bắt buộc.');
  }
  if (!buyerPhone || typeof buyerPhone !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Số điện thoại là bắt buộc.');
  }

  // ── Validate items and compute totals ─────────────────────
  const validatedItems = validateItems(items);

  // Build order items with server-authoritative prices
  const orderItems = validatedItems.map((item) => ({
    ticketType: item.ticketType,
    quantity: item.quantity,
    price: TICKET_PRICE_LIST[item.ticketType as TicketType],
  }));

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  if (totalQuantity < 1 || totalQuantity > 5) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tổng số lượng vé phải từ 1 đến 5.');
  }

  // ── Step 1: Atomically reserve capacity ───────────────────
  // CRITICAL: Single Counter for ALL ticket types combined.
  // This prevents overselling beyond the global 400 capacity.
  const counter = await Counter.findOneAndUpdate(
    {
      _id: 'ticket_capacity',
      $expr: { $lte: [{ $add: ['$sold', totalQuantity] }, '$total'] },
    },
    { $inc: { sold: totalQuantity } },
    { new: true }
  );

  if (!counter) {
    // Capacity exhausted — look up remaining for helpful error message
    const current = await Counter.findById('ticket_capacity');
    const remaining = current ? current.total - current.sold : 0;
    throw new AppError(
      409,
      'CAPACITY_EXCEEDED',
      remaining > 0
        ? `Không đủ vé. Chỉ còn lại ${remaining} vé.`
        : 'Rất tiếc, vé đã bán hết!'
    );
  }

  // ── Step 2–4: Create Order + Tickets (with rollback on failure) ──
  const orderCode = generateOrderCode();
  const normalizedEmail = buyerEmail.trim().toLowerCase();

  try {
    // Step 2: Create Order
    const order = await Order.create({
      orderCode,
      buyerName: buyerName.trim(),
      buyerEmail: normalizedEmail,
      buyerPhone: buyerPhone.trim(),
      items: orderItems,
      quantity: totalQuantity,
      totalAmount,
      status: 'PENDING',
    });

    // Step 3: Create Tickets — one per unit, each tagged with its ticketType and price
    const ticketDocs = orderItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        uuid: uuidv4(),
        orderId: order._id,
        orderCode: order.orderCode,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
        ticketType: item.ticketType,
        price: item.price,
        status: 'HOLDING' as const,
      }))
    );

    await Ticket.insertMany(ticketDocs);

    // Step 4: Create PayOS payment link (REAL SDK)
    const paymentLinkResponse = await payos.createPaymentLink({
      orderCode: order.orderCode,
      amount: order.totalAmount,
      description: `INDI ${order.orderCode}`,
      returnUrl: `${config.frontendUrl}/payment/success?orderCode=${order.orderCode}`,
      cancelUrl: `${config.frontendUrl}/payment/cancel?orderCode=${order.orderCode}`,
    });

    order.paymentLink = paymentLinkResponse.checkoutUrl;
    order.paymentLinkId = paymentLinkResponse.paymentLinkId;
    await order.save();

    // Calculate expiry time
    const expiresAt = new Date(
      order.createdAt.getTime() + config.orderTtlMinutes * 60 * 1000
    );

    // ── Response ──────────────────────────────────────────────
    res.status(201).json({
      success: true,
      data: {
        orderCode: order.orderCode,
        items: order.items,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentLink: order.paymentLink,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    // ── ROLLBACK: release reserved capacity on failure ───────
    await Counter.findOneAndUpdate(
      { _id: 'ticket_capacity' },
      { $inc: { sold: -totalQuantity } }
    );

    // Clean up any partially created documents
    await Order.deleteOne({ orderCode });
    await Ticket.deleteMany({ orderCode });

    throw err;
  }
}

/**
 * GET /api/orders/:orderCode/status
 *
 * Allows the buyer (frontend) to poll the payment status of their order.
 */
export async function getOrderStatus(req: Request, res: Response): Promise<void> {
  const { orderCode } = req.params;

  const code = Number(orderCode);
  if (!Number.isFinite(code)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã đơn hàng không hợp lệ.');
  }

  const order = await Order.findOne({ orderCode: code }).select(
    'orderCode status items quantity totalAmount paymentLink createdAt paidAt'
  );

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }

  const expiresAt = new Date(
    order.createdAt.getTime() + config.orderTtlMinutes * 60 * 1000
  );

  res.status(200).json({
    success: true,
    data: {
      orderCode: order.orderCode,
      status: order.status,
      items: order.items,
      quantity: order.quantity,
      totalAmount: order.totalAmount,
      paymentLink: order.paymentLink,
      expiresAt: expiresAt.toISOString(),
      paidAt: order.paidAt?.toISOString() || null,
    },
  });
}

/**
 * POST /api/orders/:orderCode/dev-confirm
 *
 * DEV ONLY — Simulates PayOS webhook to confirm payment.
 * Moves order PENDING → PAID, activates tickets, triggers fulfillment.
 * Only available when NODE_ENV !== 'production'.
 */
export async function devConfirmOrder(req: Request, res: Response): Promise<void> {
  if (config.nodeEnv === 'production') {
    throw new AppError(403, 'FORBIDDEN', 'This endpoint is only available in development.');
  }

  const { orderCode } = req.params;
  const code = Number(orderCode);
  if (!Number.isFinite(code)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã đơn hàng không hợp lệ.');
  }

  // Step 1: Transition order PENDING → PAID
  const order = await Order.findOneAndUpdate(
    { orderCode: code, status: 'PENDING' },
    { status: 'PAID', paidAt: new Date() },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findOne({ orderCode: code });
    if (!existing) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }
    throw new AppError(400, 'INVALID_STATUS', `Đơn hàng đang ở trạng thái "${existing.status}", không phải PENDING.`);
  }

  // Step 2: Activate all HOLDING tickets
  const updateResult = await Ticket.updateMany(
    { orderId: order._id, status: 'HOLDING' },
    { status: 'ACTIVE' }
  );

  console.log(`🧪 [DEV] Order ${code} → PAID | ${updateResult.modifiedCount} tickets activated`);

  // Step 3: Trigger fulfillment (QR + email) async
  fulfillOrder(order._id).catch((err) => {
    console.error(`❌ Fulfillment failed for order ${code}:`, err);
  });

  res.status(200).json({
    success: true,
    data: {
      message: `[DEV] Order ${code} confirmed as PAID.`,
      orderCode: order.orderCode,
      status: 'PAID',
      ticketsActivated: updateResult.modifiedCount,
    },
  });
}
