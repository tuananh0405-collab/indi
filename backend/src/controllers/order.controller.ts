import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import { db, sqlite, orders, orderItems, tickets, ticketTypes, events, promoCodes } from '../db';
import config from '../config';
import { AppError } from '../utils/AppError';
import { generateOrderCode } from '../utils/orderCode';
import payos from '../services/payos.service';
import { fulfillOrder } from '../services/fulfillment.service';

// ─── Helper: Validate items ──────────────────────────────────
interface OrderItemInput {
  ticketTypeId: number;
  quantity: number;
}

function validateItems(items: unknown): OrderItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Danh sách vé (items) là bắt buộc và không được rỗng.');
  }

  const validated: OrderItemInput[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Mỗi item phải là một object { ticketTypeId, quantity }.');
    }

    const { ticketTypeId, quantity } = item as Record<string, unknown>;

    if (!ticketTypeId || !Number.isInteger(Number(ticketTypeId))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ticketTypeId phải là số nguyên hợp lệ.');
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', `Số lượng vé phải là số nguyên ≥ 1.`);
    }

    validated.push({ ticketTypeId: Number(ticketTypeId), quantity: qty });
  }

  return validated;
}

/**
 * POST /api/orders
 *
 * Creates a new booking:
 * 1. Validate items and look up prices from ticket_types table
 * 2. Atomically reserve per-type capacity in a transaction
 * 3. Create Order + OrderItems + Tickets
 * 4. Generate PayOS payment link
 * 5. Return order info + payment link
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { buyerName, buyerEmail, buyerPhone, items, promoCode } = req.body;

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

  const validatedItems = validateItems(items);

  // ── Look up ticket types and compute totals ───────────────
  const itemsWithPrice = validatedItems.map((item) => {
    const tt = db.select().from(ticketTypes)
      .where(and(eq(ticketTypes.id, item.ticketTypeId), eq(ticketTypes.active, true)))
      .get();

    if (!tt) {
      throw new AppError(400, 'VALIDATION_ERROR', `Loại vé ID ${item.ticketTypeId} không tồn tại hoặc đã ngừng bán.`);
    }

    return { ...item, price: tt.price, ticketTypeName: tt.name };
  });

  const totalQuantity = itemsWithPrice.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = itemsWithPrice.reduce((sum, i) => sum + i.quantity * i.price, 0);

  if (totalQuantity < 1 || totalQuantity > 5) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tổng số lượng vé phải từ 1 đến 5.');
  }

  // ── Promo code validation ──────────────────────────────────
  let discountAmount = 0;
  let appliedPromoCode = '';

  if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
    const code = promoCode.trim().toUpperCase();
    const promo = db.select().from(promoCodes)
      .where(and(eq(promoCodes.code, code), eq(promoCodes.active, true)))
      .get();

    if (!promo) {
      throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }

    // Check date range (use epoch comparison to handle format differences)
    const nowMs = Date.now();
    if (promo.validFrom) {
      const fromMs = new Date(promo.validFrom.replace(' ', 'T') + (promo.validFrom.includes('Z') ? '' : 'Z')).getTime();
      if (nowMs < fromMs) {
        throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá chưa có hiệu lực.');
      }
    }
    if (promo.validUntil) {
      const untilMs = new Date(promo.validUntil.replace(' ', 'T') + (promo.validUntil.includes('Z') ? '' : 'Z')).getTime();
      if (nowMs > untilMs) {
        throw new AppError(400, 'INVALID_PROMO', 'Mã giảm giá đã hết hạn.');
      }
    }

    // Check usage limit
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new AppError(400, 'PROMO_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng.');
    }

    // Check min order amount
    if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
      throw new AppError(400, 'INVALID_PROMO', `Đơn hàng tối thiểu ${promo.minOrderAmount.toLocaleString()}đ để sử dụng mã này.`);
    }

    // Calculate discount
    if (promo.discountType === 'percent') {
      discountAmount = Math.floor(subtotal * promo.discountValue / 100);
    } else {
      discountAmount = Math.min(promo.discountValue, subtotal); // Can't discount more than subtotal
    }

    appliedPromoCode = code;
  }

  const totalAmount = subtotal - discountAmount;

  // ── Everything inside a SQLite transaction (with retry for order code collisions) ──
  const normalizedEmail = buyerEmail.trim().toLowerCase();
  const MAX_RETRIES = 3;
  let result: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const orderCode = generateOrderCode();
    try {
      result = sqlite.transaction(() => {
        // Step 1: Reserve per-type capacity atomically
        for (const item of itemsWithPrice) {
          const tt = db.select().from(ticketTypes).where(eq(ticketTypes.id, item.ticketTypeId)).get();
          if (!tt || !tt.active) {
            throw new AppError(400, 'VALIDATION_ERROR', `Loại vé ID ${item.ticketTypeId} không còn hoạt động.`);
          }
          if (tt.capacity !== null && (tt.capacity - tt.sold) < item.quantity) {
            const remaining = tt.capacity - tt.sold;
            throw new AppError(
              409,
              'CAPACITY_EXCEEDED',
              remaining > 0
                ? `Không đủ vé "${tt.label}". Chỉ còn lại ${remaining} vé.`
                : `Vé "${tt.label}" đã bán hết!`
            );
          }
          db.update(ticketTypes)
            .set({ sold: tt.sold + item.quantity })
            .where(eq(ticketTypes.id, item.ticketTypeId))
            .run();
        }

        // Also check global event capacity
        const event = db.select().from(events).where(eq(events.id, 1)).get();
        if (event) {
          const totalSold = db
            .select({ total: sql<number>`SUM(sold)` })
            .from(ticketTypes)
            .where(eq(ticketTypes.eventId, event.id))
            .get();
          const globalSold = totalSold?.total ?? 0;
          if (globalSold > event.capacity) {
            throw new AppError(409, 'CAPACITY_EXCEEDED', 'Tổng số vé đã vượt quá sức chứa sự kiện!');
          }
        }

        // Step 2: Increment promo usage (inside transaction)
        if (appliedPromoCode) {
          db.update(promoCodes)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(promoCodes.code, appliedPromoCode))
            .run();
        }

        // Step 3: Create Order
        const order = db.insert(orders).values({
          orderCode,
          eventId: 1,
          buyerName: buyerName.trim(),
          buyerEmail: normalizedEmail,
          buyerPhone: buyerPhone.trim(),
          totalQuantity,
          totalAmount,
          discountAmount,
          promoCode: appliedPromoCode,
          status: 'PENDING',
        }).returning().get();

        // Step 4: Create OrderItems
        for (const item of itemsWithPrice) {
          db.insert(orderItems).values({
            orderId: order.id,
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            unitPrice: item.price,
          }).run();
        }

        // Step 5: Create Tickets — one per unit
        for (const item of itemsWithPrice) {
          for (let i = 0; i < item.quantity; i++) {
            db.insert(tickets).values({
              uuid: uuidv4(),
              orderId: order.id,
              orderCode,
              ticketTypeId: item.ticketTypeId,
              buyerName: buyerName.trim(),
              buyerEmail: normalizedEmail,
              buyerPhone: buyerPhone.trim(),
              price: item.price,
              status: 'HOLDING',
            }).run();
          }
        }

        return order;
      })();
      break; // Success — exit retry loop
    } catch (err: any) {
      // Retry only on UNIQUE constraint violation for order_code
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < MAX_RETRIES) {
        console.warn(`⚠️  Order code collision (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
        continue;
      }
      throw err; // Re-throw all other errors
    }
  }

  // Step 5: Payment
  const expiresAt = new Date(Date.now() + config.orderTtlMinutes * 60 * 1000);

  // If order is FREE (100% discount), skip PayOS and auto-confirm
  if (result.totalAmount <= 0) {
    sqlite.transaction(() => {
      db.update(orders)
        .set({ status: 'PAID', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(orders.id, result.id))
        .run();

      sqlite.prepare(`
        UPDATE tickets SET status = 'ACTIVE', updated_at = datetime('now')
        WHERE order_id = ? AND status = 'HOLDING'
      `).run(result.id);
    })();

    console.log(`🎉 Free order ${result.orderCode} auto-confirmed (promo: ${appliedPromoCode})`);

    // Trigger fulfillment async
    fulfillOrder(result.id).catch((err) => {
      console.error(`❌ Fulfillment failed for free order ${result.orderCode}:`, err);
    });

    res.status(201).json({
      success: true,
      data: {
        orderCode: result.orderCode,
        totalQuantity: result.totalQuantity,
        totalAmount: 0,
        discountAmount,
        promoCode: appliedPromoCode,
        status: 'PAID',
        paymentLink: null,
        message: 'Đơn hàng miễn phí! Vé đã được kích hoạt.',
      },
    });
    return;
  }

  // Paid order → create PayOS payment link
  try {
    const paymentLinkResponse = await payos.createPaymentLink({
      orderCode: result.orderCode,
      amount: result.totalAmount,
      description: `INDI ${result.orderCode}`,
      expiredAt: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp (seconds)
      returnUrl: `${config.frontendUrl}/payment/success?orderCode=${result.orderCode}`,
      cancelUrl: `${config.frontendUrl}/payment/cancel?orderCode=${result.orderCode}`,
    });

    db.update(orders)
      .set({
        paymentLink: paymentLinkResponse.checkoutUrl,
        paymentLinkId: paymentLinkResponse.paymentLinkId,
      })
      .where(eq(orders.id, result.id))
      .run();

    res.status(201).json({
      success: true,
      data: {
        orderCode: result.orderCode,
        totalQuantity: result.totalQuantity,
        totalAmount: result.totalAmount,
        discountAmount,
        promoCode: appliedPromoCode,
        status: result.status,
        paymentLink: paymentLinkResponse.checkoutUrl,
        expiresAt: expiresAt.toISOString(),
        // QR payment data for inline rendering
        qrCode: (paymentLinkResponse as any).qrCode || '',
        bin: (paymentLinkResponse as any).bin || '',
        accountNumber: (paymentLinkResponse as any).accountNumber || '',
        accountName: (paymentLinkResponse as any).accountName || '',
        description: `INDI ${result.orderCode}`,
      },
    });
  } catch (err) {
    // Rollback: release capacity and clean up
    sqlite.transaction(() => {
      for (const item of itemsWithPrice) {
        sqlite.prepare('UPDATE ticket_types SET sold = sold - ? WHERE id = ?')
          .run(item.quantity, item.ticketTypeId);
      }
      if (appliedPromoCode) {
        sqlite.prepare('UPDATE promo_codes SET used_count = MAX(0, used_count - 1) WHERE code = ?')
          .run(appliedPromoCode);
      }
      db.delete(tickets).where(eq(tickets.orderId, result.id)).run();
      db.delete(orderItems).where(eq(orderItems.orderId, result.id)).run();
      db.delete(orders).where(eq(orders.id, result.id)).run();
    })();

    throw err;
  }
}

/**
 * GET /api/orders/:orderCode/status
 */
export async function getOrderStatus(req: Request, res: Response): Promise<void> {
  const { orderCode } = req.params;

  const code = Number(orderCode);
  if (!Number.isFinite(code)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã đơn hàng không hợp lệ.');
  }

  const order = db.select().from(orders).where(eq(orders.orderCode, code)).get();

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }

  // Get order items with ticket type info
  const items = db.select({
    ticketTypeId: orderItems.ticketTypeId,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    ticketTypeName: ticketTypes.label,
  })
    .from(orderItems)
    .innerJoin(ticketTypes, eq(orderItems.ticketTypeId, ticketTypes.id))
    .where(eq(orderItems.orderId, order.id))
    .all();

  const expiresAt = new Date(
    new Date(order.createdAt).getTime() + config.orderTtlMinutes * 60 * 1000
  );

  res.status(200).json({
    success: true,
    data: {
      orderCode: order.orderCode,
      status: order.status,
      items,
      totalQuantity: order.totalQuantity,
      totalAmount: order.totalAmount,
      paymentLink: order.paymentLink,
      expiresAt: expiresAt.toISOString(),
      paidAt: order.paidAt || null,
    },
  });
}

