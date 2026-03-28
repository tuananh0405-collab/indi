import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { eq, and, like, or, sql, desc, gte, lte, inArray, ne, count as drizzleCount } from 'drizzle-orm';
import { db, sqlite, tickets, ticketTypes, orders, orderItems, events, promoCodes } from '../db';
import { AppError } from '../utils/AppError';
import { generateOrderCode } from '../utils/orderCode';
import { resendTicketEmail, fulfillOrder } from '../services/fulfillment.service';

// ═══════════════════════════════════════════════════════════════
// US-10, 11: List & Search Tickets (with date range filter)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/tickets
 * Query: ?search=...&status=ACTIVE&ticketType=VIP&startDate=2026-01-01&endDate=2026-12-31&page=1&limit=20
 */
export async function listTickets(req: Request, res: Response): Promise<void> {
  const {
    search,
    status,
    ticketType,
    startDate,
    endDate,
    page = '1',
    limit = '20',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Build WHERE conditions dynamically using raw SQL for flexibility
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (status && typeof status === 'string') {
    conditions.push('t.status = ?');
    params.push(status.toUpperCase());
  }

  if (ticketType && typeof ticketType === 'string') {
    conditions.push('tt.name = ?');
    params.push(ticketType.toUpperCase());
  }

  if (startDate && typeof startDate === 'string') {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      conditions.push('t.created_at >= ?');
      params.push(start.toISOString());
    }
  }

  if (endDate && typeof endDate === 'string') {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      conditions.push('t.created_at <= ?');
      params.push(end.toISOString());
    }
  }

  if (search && typeof search === 'string') {
    const term = `%${search.trim()}%`;
    const maybeOrderCode = Number(search.trim());

    if (Number.isFinite(maybeOrderCode)) {
      conditions.push('(t.buyer_email LIKE ? OR t.buyer_name LIKE ? OR t.buyer_phone LIKE ? OR t.uuid LIKE ? OR t.order_code = ?)');
      params.push(term, term, term, term, maybeOrderCode);
    } else {
      conditions.push('(t.buyer_email LIKE ? OR t.buyer_name LIKE ? OR t.buyer_phone LIKE ? OR t.uuid LIKE ?)');
      params.push(term, term, term, term);
    }
  }

  const whereClause = conditions.join(' AND ');

  // Count total
  const countResult = sqlite.prepare(`
    SELECT COUNT(*) as total
    FROM tickets t
    INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
    WHERE ${whereClause}
  `).get(...params) as { total: number };

  const total = countResult?.total ?? 0;

  // Fetch page
  const ticketRows = sqlite.prepare(`
    SELECT
      t.id, t.uuid, t.order_id, t.order_code, t.buyer_name, t.buyer_email,
      t.buyer_phone, t.price, t.status, t.checked_in, t.checked_in_at,
      t.checked_in_by, t.email_sent, t.email_sent_at, t.notes, t.updated_by,
      t.created_at, t.updated_at,
      tt.name as ticket_type, tt.label as ticket_type_label
    FROM tickets t
    INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
    WHERE ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as any[];

  // Map to camelCase for frontend compatibility
  const mappedTickets = ticketRows.map((t) => ({
    _id: t.id,
    id: t.id,
    uuid: t.uuid,
    orderId: t.order_id,
    orderCode: t.order_code,
    buyerName: t.buyer_name,
    buyerEmail: t.buyer_email,
    buyerPhone: t.buyer_phone,
    ticketType: t.ticket_type,
    ticketTypeLabel: t.ticket_type_label,
    price: t.price,
    status: t.status,
    checkedIn: !!t.checked_in,
    checkedInAt: t.checked_in_at,
    checkedInBy: t.checked_in_by,
    emailSent: !!t.email_sent,
    emailSentAt: t.email_sent_at,
    notes: t.notes,
    updatedBy: t.updated_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  res.status(200).json({
    success: true,
    data: {
      tickets: mappedTickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-13: Update Buyer Info + Notes
// ═══════════════════════════════════════════════════════════════

export async function updateTicket(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { buyerName, buyerEmail, buyerPhone, notes } = req.body;

  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ID vé không hợp lệ.');
  }

  const updateFields: Record<string, string> = {};
  if (buyerName && typeof buyerName === 'string') updateFields.buyerName = buyerName.trim();
  if (buyerEmail && typeof buyerEmail === 'string') updateFields.buyerEmail = buyerEmail.trim().toLowerCase();
  if (buyerPhone && typeof buyerPhone === 'string') updateFields.buyerPhone = buyerPhone.trim();
  if (notes !== undefined && typeof notes === 'string') updateFields.notes = notes.trim();

  if (Object.keys(updateFields).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Ít nhất một trường cần được cập nhật.');
  }

  if (req.admin?.email) {
    updateFields.updatedBy = req.admin.email;
  }

  const updated = db.update(tickets)
    .set({ ...updateFields, updatedAt: new Date().toISOString() })
    .where(eq(tickets.id, ticketId))
    .returning()
    .get();

  if (!updated) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  }

  res.status(200).json({
    success: true,
    data: { ticket: updated },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-12: Toggle Active/Inactive
// ═══════════════════════════════════════════════════════════════

export async function toggleTicketStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const ticketId = Number(id);

  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  }

  if (ticket.status !== 'ACTIVE' && ticket.status !== 'INACTIVE') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      `Không thể chuyển đổi trạng thái vé đang ở trạng thái "${ticket.status}".`
    );
  }

  const newStatus = ticket.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const adminEmail = req.admin?.email || '';

  const updated = db.update(tickets)
    .set({ status: newStatus, updatedBy: adminEmail, updatedAt: new Date().toISOString() })
    .where(eq(tickets.id, ticketId))
    .returning()
    .get();

  res.status(200).json({
    success: true,
    data: {
      ticket: updated,
      message: newStatus === 'ACTIVE'
        ? 'Vé đã được kích hoạt lại.'
        : 'Vé đã bị vô hiệu hóa.',
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-14: Resend Ticket Email
// ═══════════════════════════════════════════════════════════════

export async function resendEmail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const ticketId = Number(id);

  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  }

  if (ticket.status !== 'ACTIVE' && ticket.status !== 'INACTIVE') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      'Chỉ có thể gửi lại email cho vé đang ACTIVE hoặc INACTIVE.'
    );
  }

  await resendTicketEmail(ticket.id);

  res.status(200).json({
    success: true,
    data: {
      message: 'Email đã được gửi lại thành công.',
      sentTo: ticket.buyerEmail,
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-18: Dashboard Stats
// ═══════════════════════════════════════════════════════════════

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  // Get event capacity
  const event = db.select().from(events).where(eq(events.id, 1)).get();
  const capacity = event?.capacity ?? 400;

  // Get per-type sold counts
  const typeStats = db.select({
    id: ticketTypes.id,
    label: ticketTypes.label,
    price: ticketTypes.price,
    capacity: ticketTypes.capacity,
    sold: ticketTypes.sold,
  }).from(ticketTypes).where(eq(ticketTypes.eventId, 1)).all();

  const totalSold = typeStats.reduce((sum, t) => sum + t.sold, 0);

  // Ticket status counts via Drizzle
  const statusRows = db.select({
    status: tickets.status,
    count: sql<number>`COUNT(*)`,
  }).from(tickets)
    .where(inArray(tickets.status, ['ACTIVE', 'INACTIVE', 'HOLDING']))
    .groupBy(tickets.status)
    .all();

  const statusMap: Record<string, number> = {};
  for (const row of statusRows) {
    statusMap[row.status] = row.count;
  }

  // Check-in count
  const checkedInResult = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(tickets).where(eq(tickets.checkedIn, true)).get();

  // Pending orders count
  const pendingResult = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(orders).where(eq(orders.status, 'PENDING')).get();

  // Revenue: sum price of ACTIVE + INACTIVE tickets
  const revenueResult = db.select({
    total: sql<number>`COALESCE(SUM(${tickets.price}), 0)`,
  }).from(tickets).where(inArray(tickets.status, ['ACTIVE', 'INACTIVE'])).get();

  res.status(200).json({
    success: true,
    data: {
      capacity,
      sold: totalSold,
      available: capacity - totalSold,
      pending: pendingResult?.count ?? 0,
      checkedIn: checkedInResult?.count ?? 0,
      totalRevenue: revenueResult?.total ?? 0,
      activeTickets: statusMap['ACTIVE'] || 0,
      inactiveTickets: statusMap['INACTIVE'] || 0,
      holdingTickets: statusMap['HOLDING'] || 0,
      ticketTypes: typeStats,
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-19: Export Excel (.xlsx)
// ═══════════════════════════════════════════════════════════════

export async function exportExcel(req: Request, res: Response): Promise<void> {
  const { status } = req.query;

  let whereClause = '1=1';
  const params: unknown[] = [];

  if (status && typeof status === 'string') {
    whereClause = 't.status = ?';
    params.push(status.toUpperCase());
  }

  const ticketRows = sqlite.prepare(`
    SELECT
      t.id, t.uuid, t.order_code, t.buyer_name, t.buyer_email,
      t.buyer_phone, t.price, t.status, t.checked_in, t.checked_in_at,
      t.notes, t.updated_by, t.created_at, t.updated_at,
      tt.label as ticket_type_label
    FROM tickets t
    INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
    WHERE ${whereClause}
    ORDER BY t.created_at ASC
  `).all(...params) as any[];

  // ── Build Excel workbook ──────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INDI Ticketing System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tickets', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'Order Code', key: 'orderCode', width: 16 },
    { header: 'Loại vé', key: 'ticketType', width: 14 },
    { header: 'Giá vé', key: 'price', width: 14 },
    { header: 'Họ tên', key: 'buyerName', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Số điện thoại', key: 'phone', width: 16 },
    { header: 'Trạng thái', key: 'status', width: 12 },
    { header: 'Checked In', key: 'checkedIn', width: 12 },
    { header: 'Checked In At', key: 'checkedInAt', width: 22 },
    { header: 'Ghi chú', key: 'notes', width: 30 },
    { header: 'Người cập nhật', key: 'updatedBy', width: 25 },
    { header: 'Ngày tạo', key: 'createdAt', width: 22 },
    { header: 'Ngày cập nhật', key: 'updatedAt', width: 22 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A1A2E' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  ticketRows.forEach((t: any, i: number) => {
    sheet.addRow({
      stt: i + 1,
      uuid: t.uuid,
      orderCode: t.order_code,
      ticketType: t.ticket_type_label,
      price: t.price,
      buyerName: t.buyer_name,
      email: t.buyer_email,
      phone: t.buyer_phone,
      status: t.status,
      checkedIn: t.checked_in ? 'Yes' : 'No',
      checkedInAt: t.checked_in_at
        ? new Date(t.checked_in_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '',
      notes: t.notes || '',
      updatedBy: t.updated_by || '',
      createdAt: new Date(t.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      updatedAt: new Date(t.updated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    });
  });

  sheet.getColumn('price').numFmt = '#,##0';

  // ── Send response ─────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=tickets_export_${today}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
}

// ═══════════════════════════════════════════════════════════════
// Admin: Create Order (no PayOS — direct PAID + ACTIVE)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/admin/orders
 * Body: { buyerName, buyerEmail, buyerPhone, notes, items: [{ ticketTypeId, quantity }], sendEmail }
 */
export async function adminCreateOrder(req: Request, res: Response): Promise<void> {
  const { buyerName, buyerEmail, buyerPhone, notes, items, sendEmail } = req.body;

  // ── Validation ──────────────────────────────────────────
  if (!buyerName || typeof buyerName !== 'string' || !buyerName.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Họ tên người mua là bắt buộc.');
  }
  if (!buyerPhone || typeof buyerPhone !== 'string' || !buyerPhone.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Số điện thoại là bắt buộc.');
  }
  if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.includes('@')) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email là bắt buộc.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng chọn ít nhất 1 loại vé.');
  }

  // ── Validate & look up ticket types ──────────────────────
  const validatedItems = items.map((item: any) => {
    const ticketTypeId = Number(item.ticketTypeId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(ticketTypeId) || !Number.isInteger(quantity) || quantity < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ticketTypeId và quantity phải là số nguyên hợp lệ.');
    }
    return { ticketTypeId, quantity };
  });

  const itemsWithPrice = validatedItems.map((item) => {
    const tt = db.select().from(ticketTypes)
      .where(and(eq(ticketTypes.id, item.ticketTypeId), eq(ticketTypes.active, true)))
      .get();
    if (!tt) {
      throw new AppError(400, 'VALIDATION_ERROR', `Loại vé ID ${item.ticketTypeId} không tồn tại hoặc đã ngừng bán.`);
    }
    return { ...item, price: tt.price, ticketTypeName: tt.name, label: tt.label };
  });

  const totalQuantity = itemsWithPrice.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = itemsWithPrice.reduce((sum, i) => sum + i.quantity * i.price, 0);

  // ── Atomic transaction: check capacity, create order & tickets ──
  const orderCode = generateOrderCode();
  const now = new Date().toISOString();

  const result = sqlite.transaction(() => {
    // Check capacity & reserve
    for (const item of itemsWithPrice) {
      const tt = db.select().from(ticketTypes).where(eq(ticketTypes.id, item.ticketTypeId)).get();
      if (!tt) throw new AppError(400, 'VALIDATION_ERROR', `Loại vé không tồn tại.`);
      if (tt.capacity !== null) {
        const remaining = tt.capacity - tt.sold;
        if (remaining < item.quantity) {
          throw new AppError(409, 'SOLD_OUT', `Loại vé "${item.label}" chỉ còn ${remaining} vé.`);
        }
      }
      // Reserve capacity
      db.update(ticketTypes)
        .set({ sold: tt.sold + item.quantity })
        .where(eq(ticketTypes.id, item.ticketTypeId))
        .run();
    }

    // Create order (PAID immediately — admin bypass)
    const order = db.insert(orders).values({
      orderCode,
      eventId: 1,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim().toLowerCase(),
      buyerPhone: buyerPhone.trim(),
      totalQuantity,
      totalAmount,
      status: 'PAID',
      paidAt: now,
      createdBy: 'ADMIN',
    }).returning().get();

    // Create order items + tickets
    for (const item of itemsWithPrice) {
      db.insert(orderItems).values({
        orderId: order.id,
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        unitPrice: item.price,
      }).run();

      for (let i = 0; i < item.quantity; i++) {
        db.insert(tickets).values({
          uuid: uuidv4(),
          orderId: order.id,
          orderCode,
          ticketTypeId: item.ticketTypeId,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim().toLowerCase(),
          buyerPhone: buyerPhone.trim(),
          price: item.price,
          status: 'ACTIVE',
          notes: notes?.trim() || '',
          updatedBy: 'ADMIN',
        }).run();
      }
    }

    return { orderId: order.id, orderCode, totalQuantity, totalAmount };
  })();

  console.log(`🎫 Admin created order ${result.orderCode} — ${result.totalQuantity} tickets, ${result.totalAmount}đ`);

  // ── Optional: send email fulfillment ──────────────────────
  if (sendEmail) {
    fulfillOrder(result.orderId).catch((err) => {
      console.error(`❌ Fulfillment failed for admin order ${result.orderCode}:`, err);
    });
  }

  res.status(201).json({
    success: true,
    data: {
      orderCode: result.orderCode,
      totalQuantity: result.totalQuantity,
      totalAmount: result.totalAmount,
      status: 'PAID',
      message: sendEmail ? 'Đơn hàng đã được tạo và email đã được gửi.' : 'Đơn hàng đã được tạo thành công.',
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Admin: Cancel Order (Set order to CANCELLED, tickets to CANCELLED, rollback capacity)
// ═══════════════════════════════════════════════════════════════

export async function adminCancelOrder(req: Request, res: Response): Promise<void> {
  const { orderCode } = req.params;
  const code = Number(orderCode);

  if (!Number.isFinite(code)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Mã đơn hàng không hợp lệ.');
  }

  const order = db.select().from(orders).where(eq(orders.orderCode, code)).get();

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }

  if (order.status === 'CANCELLED') {
    throw new AppError(400, 'INVALID_STATUS', 'Đơn hàng này đã bị hủy trước đó.');
  }

  const adminEmail = req.admin?.email || 'ADMIN';
  const now = new Date().toISOString();

  // Atomic transaction
  sqlite.transaction(() => {
    // 1. Update order status
    db.update(orders)
      .set({ status: 'CANCELLED', updatedBy: adminEmail, updatedAt: now })
      .where(eq(orders.id, order.id))
      .run();

    // 2. Update all associated tickets to CANCELLED
    db.update(tickets)
      .set({ status: 'CANCELLED', updatedBy: adminEmail, updatedAt: now })
      .where(and(eq(tickets.orderId, order.id), ne(tickets.status, 'CANCELLED')))
      .run();

    // 3. Rollback sold capacity from ticket_types
    const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).all();
    for (const item of items) {
      const tt = db.select().from(ticketTypes).where(eq(ticketTypes.id, item.ticketTypeId)).get();
      if (tt) {
        db.update(ticketTypes)
          .set({ sold: Math.max(0, tt.sold - item.quantity) })
          .where(eq(ticketTypes.id, item.ticketTypeId))
          .run();
      }
    }
    
    // 4. Optionally rollback promo usages (if applied)
    if (order.promoCode) {
      const promo = db.select().from(promoCodes).where(eq(promoCodes.code, order.promoCode)).get();
      if (promo) {
        db.update(promoCodes)
          .set({ usedCount: Math.max(0, promo.usedCount - 1) })
          .where(eq(promoCodes.code, order.promoCode))
          .run();
      }
    }
  })();

  res.status(200).json({
    success: true,
    data: {
      message: 'Đơn hàng đã được hủy thành công và số lượng vé đã được hoàn lại.',
    },
  });
}
