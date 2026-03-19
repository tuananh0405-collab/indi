import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import Ticket from '../models/Ticket';
import Counter from '../models/Counter';
import Order from '../models/Order';
import { AppError } from '../utils/AppError';
import { resendTicketEmail } from '../services/fulfillment.service';

// ═══════════════════════════════════════════════════════════════
// US-10, 11: List & Search Tickets (with date range filter)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/tickets
 * Query: ?search=...&status=ACTIVE&ticketType=VIP&startDate=2026-01-01&endDate=2026-12-31&page=1&limit=20
 *
 * Searches by email, UUID, name, phone, or orderCode.
 * Filters by status, ticketType, and date range (createdAt).
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
  const skip = (pageNum - 1) * limitNum;

  // Build filter
  const filter: Record<string, unknown> = {};

  if (status && typeof status === 'string') {
    filter.status = status.toUpperCase();
  }

  if (ticketType && typeof ticketType === 'string') {
    filter.ticketType = ticketType.toUpperCase();
  }

  // Date range filter on createdAt
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};

    if (startDate && typeof startDate === 'string') {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        // Set to start of day
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }
    }

    if (endDate && typeof endDate === 'string') {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }
  }

  if (search && typeof search === 'string') {
    const term = search.trim();

    // If search looks like a number, also try orderCode
    const maybeOrderCode = Number(term);

    filter.$or = [
      { buyerEmail: { $regex: term, $options: 'i' } },
      { buyerName: { $regex: term, $options: 'i' } },
      { buyerPhone: { $regex: term, $options: 'i' } },
      { uuid: { $regex: term, $options: 'i' } },
      ...(Number.isFinite(maybeOrderCode) ? [{ orderCode: maybeOrderCode }] : []),
    ];
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      tickets,
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

/**
 * PATCH /api/admin/tickets/:id
 * Body: { buyerName?, buyerEmail?, buyerPhone?, notes? }
 *
 * Automatically sets `updatedBy` from the admin's JWT payload email.
 */
export async function updateTicket(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { buyerName, buyerEmail, buyerPhone, notes } = req.body;

  const updateFields: Record<string, string> = {};
  if (buyerName && typeof buyerName === 'string') updateFields.buyerName = buyerName.trim();
  if (buyerEmail && typeof buyerEmail === 'string') updateFields.buyerEmail = buyerEmail.trim().toLowerCase();
  if (buyerPhone && typeof buyerPhone === 'string') updateFields.buyerPhone = buyerPhone.trim();
  if (notes !== undefined && typeof notes === 'string') updateFields.notes = notes.trim();

  if (Object.keys(updateFields).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Ít nhất một trường cần được cập nhật.');
  }

  // Auto-set updatedBy from admin JWT
  if (req.admin?.email) {
    updateFields.updatedBy = req.admin.email;
  }

  const ticket = await Ticket.findByIdAndUpdate(id, updateFields, { new: true });

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  }

  res.status(200).json({
    success: true,
    data: { ticket },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-12: Toggle Active/Inactive
// ═══════════════════════════════════════════════════════════════

/**
 * PATCH /api/admin/tickets/:id/toggle-status
 */
export async function toggleTicketStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const ticket = await Ticket.findById(id);
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

  const updateFields: Record<string, unknown> = { status: newStatus };
  if (req.admin?.email) {
    updateFields.updatedBy = req.admin.email;
  }

  const updated = await Ticket.findByIdAndUpdate(id, updateFields, { new: true });

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

/**
 * POST /api/admin/tickets/:id/resend-email
 */
export async function resendEmail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const ticket = await Ticket.findById(id);
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

  await resendTicketEmail(ticket._id);

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

/**
 * GET /api/admin/dashboard
 */
export async function getDashboard(_req: Request, res: Response): Promise<void> {
  const [counter, statusAgg, checkedInCount, pendingOrders, revenueAgg] = await Promise.all([
    Counter.findById('ticket_capacity'),
    Ticket.aggregate([
      { $match: { status: { $in: ['ACTIVE', 'INACTIVE', 'HOLDING'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Ticket.countDocuments({ checkedIn: true }),
    Order.countDocuments({ status: 'PENDING' }),
    // Revenue: sum price of all paid/fulfilled tickets (ACTIVE + INACTIVE)
    Ticket.aggregate([
      { $match: { status: { $in: ['ACTIVE', 'INACTIVE'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$price' } } },
    ]),
  ]);

  // Parse aggregation results
  const statusMap: Record<string, number> = {};
  for (const item of statusAgg) {
    statusMap[item._id as string] = item.count as number;
  }

  const sold = counter ? counter.sold : 0;
  const capacity = counter ? counter.total : 400;
  const totalRevenue = revenueAgg.length > 0 ? (revenueAgg[0].totalRevenue as number) : 0;

  res.status(200).json({
    success: true,
    data: {
      capacity,
      sold,
      available: capacity - sold,
      pending: pendingOrders,
      checkedIn: checkedInCount,
      totalRevenue,
      activeTickets: statusMap['ACTIVE'] || 0,
      inactiveTickets: statusMap['INACTIVE'] || 0,
      holdingTickets: statusMap['HOLDING'] || 0,
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// US-19: Export Excel (.xlsx)
// ═══════════════════════════════════════════════════════════════

/**
 * Ticket type display labels for export
 */
const TICKET_TYPE_LABELS: Record<string, string> = {
  EARLY_BIRD: 'Early Bird',
  STANDARD: 'Standard',
  VIP: 'VIP',
};

/**
 * GET /api/admin/export
 * Query: ?status=ACTIVE (optional filter)
 *
 * Exports tickets as a real .xlsx Excel file using ExcelJS.
 */
export async function exportExcel(req: Request, res: Response): Promise<void> {
  const { status } = req.query;

  const filter: Record<string, unknown> = {};
  if (status && typeof status === 'string') {
    filter.status = status.toUpperCase();
  }

  const tickets = await Ticket.find(filter)
    .sort({ createdAt: 1 })
    .lean();

  // ── Build Excel workbook ──────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INDI Ticketing System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tickets', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Define columns
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
    { header: 'Mã khuyến mại', key: 'promoCode', width: 16 },
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
  tickets.forEach((t, i) => {
    sheet.addRow({
      stt: i + 1,
      uuid: t.uuid,
      orderCode: t.orderCode,
      ticketType: TICKET_TYPE_LABELS[t.ticketType] || t.ticketType,
      price: t.price,
      buyerName: t.buyerName,
      email: t.buyerEmail,
      phone: t.buyerPhone,
      status: t.status,
      checkedIn: t.checkedIn ? 'Yes' : 'No',
      checkedInAt: t.checkedInAt
        ? new Date(t.checkedInAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '',
      notes: t.notes || '',
      promoCode: t.promoCode || '',
      updatedBy: t.updatedBy || '',
      createdAt: new Date(t.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      updatedAt: new Date(t.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    });
  });

  // Format price column as VND currency
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
