'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import {
  type Ticket,
  type Pagination,
  type TicketListResponse,
  type DashboardResponse,
  type TicketTypeInfo,
  TICKET_TYPE_LABELS,
  TICKET_TYPE_COLORS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
} from '@/lib/types';
import {
  Search,
  Pencil,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Loader2,
  FileSpreadsheet,
  Plus,
  Minus,
} from 'lucide-react';

// ─── Filter State ─────────────────────────────────────────────
interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  ticketType: string;
  status: string;
  paymentMethod: string;
}

const INITIAL_FILTERS: Filters = {
  search: '',
  startDate: '',
  endDate: '',
  ticketType: '',
  status: '',
  paymentMethod: '',
};

export default function DashboardPage() {
  // Stats
  const [stats, setStats] = useState<DashboardResponse['data'] | null>(null);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 10, total: 0, totalPages: 0,
  });
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(INITIAL_FILTERS);
  const [exporting, setExporting] = useState(false);

  // Selected rows
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Detail panel
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);

  // Edit dialog
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Resend email
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Cancel order
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  // Create order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ buyerName: '', buyerPhone: '', buyerEmail: '', notes: '' });
  const [createQuantities, setCreateQuantities] = useState<Record<number, number>>({});
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Fetch Stats ───────────────────────────────────────────
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get<DashboardResponse>('/admin/dashboard');
        setStats(res.data.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      }
    }
    fetchStats();
  }, []);

  // ── Fetch Tickets ───────────────────────────────────────────
  const fetchTickets = useCallback(async (page = 1) => {
    try {
      setTicketsLoading(true);
      const params: Record<string, string | number> = { page, limit: pagination.limit };
      if (appliedFilters.search) params.search = appliedFilters.search;
      if (appliedFilters.status) params.status = appliedFilters.status;
      if (appliedFilters.ticketType) params.ticketType = appliedFilters.ticketType;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

      const res = await api.get<TicketListResponse>('/admin/tickets', { params });
      setTickets(res.data.data.tickets);
      setPagination(res.data.data.pagination);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  }, [appliedFilters, pagination.limit]);

  useEffect(() => {
    fetchTickets(1);
  }, [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────
  function handleSearch() { setAppliedFilters({ ...filters }); }
  function handleClearFilters() { setFilters(INITIAL_FILTERS); setAppliedFilters(INITIAL_FILTERS); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleSearch(); }

  /** Auto-apply a filter change (for dropdowns and date pickers) */
  function applyFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setAppliedFilters((f) => ({ ...f, [key]: value }));
  }

  // ── Selection ──────────────────────────────────────────────
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)));
    }
  }

  // ── Edit Ticket ─────────────────────────────────────────────
  function openEditDialog(ticket: Ticket) {
    setEditingTicket(ticket);
    setEditForm({
      buyerName: ticket.buyerName,
      buyerEmail: ticket.buyerEmail,
      buyerPhone: ticket.buyerPhone,
      notes: ticket.notes || '',
    });
  }

  async function handleEditSave() {
    if (!editingTicket) return;
    try {
      setEditLoading(true);
      await api.patch(`/admin/tickets/${editingTicket.id}`, editForm);
      setEditingTicket(null);
      setDetailTicket(null);
      fetchTickets(pagination.page);
    } catch (err) {
      console.error('Failed to update ticket:', err);
      alert('Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Resend Email ────────────────────────────────────────────
  async function handleResendEmail(ticketId: number) {
    if (!confirm('Gửi lại email cho vé này?')) return;
    try {
      setResendingId(ticketId);
      await api.post(`/admin/tickets/${ticketId}/resend-email`);
      alert('Email đã được gửi lại thành công!');
    } catch (err) {
      console.error('Failed to resend email:', err);
      alert('Gửi email thất bại.');
    } finally {
      setResendingId(null);
    }
  }

  // ── Cancel Order ──────────────────────────────────────────
  async function handleCancelOrder(orderCode: number) {
    if (!confirm(`Bạn có chắc chắn muốn hủy toàn bộ đơn hàng #${orderCode} và thu hồi tất cả các vé?\n\nHành động này không thể hoàn tác.`)) return;
    try {
      setCancelingId(orderCode);
      const res = await api.post(`/admin/orders/${orderCode}/cancel`);
      alert(res.data.data.message || 'Đã hủy đơn hàng thành công!');
      setDetailTicket(null);
      // Refresh stats and tickets
      const statsRes = await api.get('/admin/dashboard');
      setStats(statsRes.data.data);
      fetchTickets(1);
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      alert(err.response?.data?.message || 'Hủy đơn hàng thất bại.');
    } finally {
      setCancelingId(null);
    }
  }

  // ── Export ──────────────────────────────────────────────────
  async function handleExport() {
    try {
      setExporting(true);
      const res = await api.get('/admin/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
      alert('Xuất file thất bại.');
    } finally {
      setExporting(false);
    }
  }

  // ── Create Order ─────────────────────────────────────────────
  function openCreateModal() {
    setCreateForm({ buyerName: '', buyerPhone: '', buyerEmail: '', notes: '' });
    setCreateQuantities({});
    setCreateError('');
    setShowCreateModal(true);
  }

  function updateQuantity(typeId: number, delta: number) {
    setCreateQuantities((prev) => {
      const current = prev[typeId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [typeId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [typeId]: next };
    });
  }

  async function handleCreateOrder(sendEmail: boolean) {
    setCreateError('');

    if (!createForm.buyerName.trim()) { setCreateError('Vui lòng nhập họ và tên.'); return; }
    if (!createForm.buyerPhone.trim()) { setCreateError('Vui lòng nhập số điện thoại.'); return; }
    if (!createForm.buyerEmail.trim() || !createForm.buyerEmail.includes('@')) { setCreateError('Vui lòng nhập email hợp lệ.'); return; }

    const items = Object.entries(createQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ ticketTypeId: Number(id), quantity: qty }));

    if (items.length === 0) { setCreateError('Vui lòng chọn ít nhất 1 loại vé.'); return; }

    try {
      setCreateLoading(true);
      const res = await api.post('/admin/orders', {
        buyerName: createForm.buyerName.trim(),
        buyerPhone: createForm.buyerPhone.trim(),
        buyerEmail: createForm.buyerEmail.trim(),
        notes: createForm.notes.trim(),
        items,
        sendEmail,
      });
      alert(res.data.data.message || 'Tạo đơn hàng thành công!');
      setShowCreateModal(false);
      // Refresh stats and tickets
      const statsRes = await api.get<DashboardResponse>('/admin/dashboard');
      setStats(statsRes.data.data);
      fetchTickets(1);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Tạo đơn hàng thất bại.';
      setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────
  function parseDateStr(dateStr: string) {
    if (!dateStr) return new Date();
    const str = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z');
    return new Date(str);
  }

  function formatDate(dateStr: string) {
    return parseDateStr(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(dateStr: string) {
    const d = parseDateStr(dateStr);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }
  function formatCurrency(amount: number) {
    return amount.toLocaleString('vi-VN');
  }

  const hasActiveFilters = appliedFilters.search || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.ticketType || appliedFilters.status || appliedFilters.paymentMethod;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Quản lý vé</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="hidden sm:flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export Excel
          </button>
          <button
            onClick={openCreateModal}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a4e] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo mới vé
          </button>
        </div>
      </div>

      {/* KPI Cards — Tổng số vé + Vé còn lại */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm text-gray-500">Tổng số vé</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats ? formatCurrency(stats.sold) : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm text-gray-500">Vé còn lại</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats ? formatCurrency(stats.available) : '—'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 bg-[#1a1a2e] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a4e] transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Tìm kiếm
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => applyFilter('startDate', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => applyFilter('endDate', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
        />
        <select
          value={filters.ticketType}
          onChange={(e) => applyFilter('ticketType', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[130px]"
        >
          <option value="">Loại vé</option>
          <option value="EARLY_BIRD">Early Bird</option>
          <option value="STANDARD">Standard</option>
          <option value="VIP">VIP</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => applyFilter('status', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[140px]"
        >
          <option value="">Trạng thái vé</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="HOLDING">Holding</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          value={filters.paymentMethod}
          onChange={(e) => applyFilter('paymentMethod', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[160px]"
        >
          <option value="">Hình thức thanh toán</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="cash">Tiền mặt</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Xóa bộ lọc"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={tickets.length > 0 && selectedIds.size === tickets.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase w-[50px]">STT</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">ID đơn hàng</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">ID vé</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Họ tên</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Số điện thoại</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Email</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Thời gian đặt</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 text-xs uppercase">Số lượng vé</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Loại vé</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 text-xs uppercase">Thành tiền</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Hình thức TT</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Trạng thái vé</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Người cập nhật</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Thời gian update</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Ghi chú</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase">Mã KM</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 text-xs uppercase w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 18 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-12 text-center text-gray-400">
                    Không tìm thấy vé nào.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket, index) => {
                  const stt = (pagination.page - 1) * pagination.limit + index + 1;
                  const isSelected = selectedIds.has(ticket.id);
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setDetailTicket(ticket)}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ticket.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{String(stt).padStart(4, '0')}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-blue-600 font-medium">{ticket.orderCode}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-blue-600 font-medium">{ticket.uuid?.slice(0, 8) || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium whitespace-nowrap">{ticket.buyerName}</td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{ticket.buyerPhone}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate" title={ticket.buyerEmail}>
                        {ticket.buyerEmail}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(ticket.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">1</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TICKET_TYPE_COLORS[ticket.ticketType] || 'bg-gray-100 text-gray-700'}`}>
                          {ticket.ticketTypeLabel || TICKET_TYPE_LABELS[ticket.ticketType] || ticket.ticketType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-900 whitespace-nowrap">
                        {formatCurrency(ticket.price)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          Chuyển khoản
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
                          {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{ticket.updatedBy || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(ticket.updatedAt)}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[120px] truncate" title={ticket.notes}>{ticket.notes || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">{'—'}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => openEditDialog(ticket)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleResendEmail(ticket.id)}
                            disabled={resendingId === ticket.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="Gửi lại email"
                          >
                            {resendingId === ticket.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!ticketsLoading && tickets.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {selectedIds.size} of {pagination.total} row(s) selected.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Rows per page</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    setPagination((p) => ({ ...p, limit: parseInt(e.target.value) }));
                    fetchTickets(1);
                  }}
                  className="px-2 py-1 border border-gray-200 rounded text-sm"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchTickets(1)} disabled={pagination.page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={() => fetchTickets(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => fetchTickets(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => fetchTickets(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Panel (Chi tiết đơn hàng) ────────────── */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailTicket(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Chi tiết đơn hàng</h3>
              <button onClick={() => setDetailTicket(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
                <span className="text-gray-500 uppercase text-xs font-medium">ID đơn hàng</span>
                <span className="text-gray-900 font-medium">{detailTicket.orderCode}</span>

                <span className="text-gray-500 uppercase text-xs font-medium">ID vé</span>
                <span className="text-gray-900 font-medium">{detailTicket.uuid?.slice(0, 10) || '—'}</span>

                <span className="text-gray-500 uppercase text-xs font-medium">Họ tên</span>
                <span className="text-gray-900">{detailTicket.buyerName}</span>

                <span className="text-gray-500 uppercase text-xs font-medium">Thời gian đặt</span>
                <span className="text-gray-900">{formatDateTime(detailTicket.createdAt)}</span>

                <span className="text-gray-500 uppercase text-xs font-medium">Email</span>
                <span className="text-gray-900">{detailTicket.buyerEmail}</span>
              </div>

              {/* Placeholder area for QR/ticket image */}
              <div className="bg-gray-50 rounded-xl h-32 flex items-center justify-center text-gray-300 text-sm border border-gray-100">
                {/* Ticket preview area */}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { openEditDialog(detailTicket); setDetailTicket(null); }}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
              >
                Chỉnh sửa thông tin
              </button>
              <button
                onClick={() => handleResendEmail(detailTicket.id)}
                disabled={resendingId === detailTicket.id}
                className="flex-1 py-2.5 px-4 bg-[#1a1a2e] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a4e] transition-colors disabled:opacity-50 text-center"
              >
                {resendingId === detailTicket.id ? 'Đang gửi...' : 'Gửi Mail'}
              </button>
            </div>

            {/* Cancel Order Button */}
            {detailTicket.status !== 'CANCELLED' && detailTicket.status !== 'INACTIVE' && (
              <div className="mt-3">
                <button
                  onClick={() => handleCancelOrder(detailTicket.orderCode)}
                  disabled={cancelingId === detailTicket.orderCode}
                  className="w-full py-2.5 px-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors text-center flex items-center justify-center gap-2"
                >
                  {cancelingId === detailTicket.orderCode ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Hủy đơn hàng này
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Edit Modal ──────────────────────────────────── */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingTicket(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chỉnh sửa thông tin vé</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                <input
                  type="text"
                  value={editForm.buyerName}
                  onChange={(e) => setEditForm((f) => ({ ...f, buyerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.buyerEmail}
                  onChange={(e) => setEditForm((f) => ({ ...f, buyerEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.buyerPhone}
                  onChange={(e) => setEditForm((f) => ({ ...f, buyerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingTicket(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a4e] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Order Modal (Thêm vé mới) ─────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white h-full w-full max-w-md shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900">Thêm vé mới</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleCreateOrder(true)}
                  disabled={createLoading}
                  className="px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Tạo và gửi mail
                </button>
                <button
                  onClick={() => handleCreateOrder(false)}
                  disabled={createLoading}
                  className="px-3 py-1.5 text-sm text-white bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a4e] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Tạo đơn hàng mới
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Error */}
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {createError}
                </div>
              )}

              {/* Buyer Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-0.5">*</span>Họ và tên :
                  </label>
                  <input
                    type="text"
                    placeholder="input"
                    value={createForm.buyerName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, buyerName: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-0.5">*</span>SĐT :
                  </label>
                  <input
                    type="text"
                    placeholder="input"
                    value={createForm.buyerPhone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, buyerPhone: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-0.5">*</span>Mail :
                  </label>
                  <input
                    type="email"
                    placeholder="input"
                    value={createForm.buyerEmail}
                    onChange={(e) => setCreateForm((f) => ({ ...f, buyerEmail: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-0.5">*</span>Ghi chú :
                  </label>
                  <input
                    type="text"
                    placeholder="Input"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
                  />
                </div>
              </div>

              {/* Ticket Type Selection */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-4">
                  Chọn loại vé
                </h4>
                <div className="space-y-4">
                  {stats?.ticketTypes?.map((tt) => {
                    const qty = createQuantities[tt.id] || 0;
                    const remaining = (tt.capacity ?? 0) - tt.sold;
                    const isSelected = qty > 0;

                    return (
                      <div
                        key={tt.id}
                        className={`border rounded-xl p-4 transition-all ${
                          isSelected
                            ? 'border-[#1a1a2e] ring-1 ring-[#1a1a2e]/20'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Radio indicator */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#1a1a2e]' : 'border-gray-300'
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-[#1a1a2e] rounded-full" />}
                          </div>

                          {/* Ticket image placeholder */}
                          <div className={`w-14 h-10 rounded-lg shrink-0 ${
                            tt.label.includes('VIP') ? 'bg-gradient-to-br from-amber-300 to-amber-500' :
                            tt.label.includes('Early') ? 'bg-gradient-to-br from-blue-300 to-blue-500' :
                            'bg-gradient-to-br from-gray-300 to-gray-500'
                          }`} />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{tt.label}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(tt.price)}đ</p>
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateQuantity(tt.id, -1)}
                              disabled={qty <= 0}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium text-gray-900">
                              {String(qty).padStart(2, '0')}
                            </span>
                            <button
                              onClick={() => updateQuantity(tt.id, 1)}
                              disabled={qty >= remaining}
                              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Remaining count */}
                        <p className="text-xs text-gray-400 mt-2 ml-9">
                          Số vé còn lại: {formatCurrency(remaining)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">
                  Thông tin thêm
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-center">
                  {Object.keys(createQuantities).length > 0 ? (
                    <div className="space-y-1">
                      {Object.entries(createQuantities).map(([id, qty]) => {
                        const tt = stats?.ticketTypes?.find((t) => t.id === Number(id));
                        return tt ? (
                          <p key={id}>{tt.label}: {qty} × {formatCurrency(tt.price)}đ = {formatCurrency(qty * tt.price)}đ</p>
                        ) : null;
                      })}
                      <p className="font-semibold text-gray-900 pt-1 border-t border-gray-200 mt-2">
                        Tổng: {formatCurrency(
                          Object.entries(createQuantities).reduce((sum, [id, qty]) => {
                            const tt = stats?.ticketTypes?.find((t) => t.id === Number(id));
                            return sum + (tt ? qty * tt.price : 0);
                          }, 0)
                        )}đ
                      </p>
                    </div>
                  ) : (
                    'Chưa chọn loại vé'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
