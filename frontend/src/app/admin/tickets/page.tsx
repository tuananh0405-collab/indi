'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import {
  type Ticket,
  type Pagination,
  type TicketListResponse,
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
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ─── Filter State ─────────────────────────────────────────────
interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  ticketType: string;
  status: string;
}

const INITIAL_FILTERS: Filters = {
  search: '',
  startDate: '',
  endDate: '',
  ticketType: '',
  status: '',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 10, total: 0, totalPages: 0,
  });
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(INITIAL_FILTERS);

  // Edit dialog
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Resend email
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Toggle status
  const [togglingId, setTogglingId] = useState<number | null>(null);

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

  // ── Toggle Status ───────────────────────────────────────────
  async function handleToggleStatus(ticket: Ticket) {
    if (ticket.status !== 'ACTIVE' && ticket.status !== 'INACTIVE') return;
    const action = ticket.status === 'ACTIVE' ? 'vô hiệu hóa' : 'kích hoạt lại';
    if (!confirm(`Bạn muốn ${action} vé này?`)) return;

    try {
      setTogglingId(ticket.id);
      await api.patch(`/admin/tickets/${ticket.id}/toggle-status`);
      fetchTickets(pagination.page);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      alert('Thay đổi trạng thái thất bại.');
    } finally {
      setTogglingId(null);
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

  // ── Helpers ─────────────────────────────────────────────────
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function formatCurrency(amount: number) { return amount.toLocaleString('vi-VN'); }

  const hasActiveFilters = appliedFilters.search || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.ticketType || appliedFilters.status;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quản lý vé</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tra cứu, chỉnh sửa và quản lý trạng thái vé</p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email, SĐT, UUID, mã đơn..."
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
            Tìm
          </button>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
          />
          <select
            value={filters.ticketType}
            onChange={(e) => setFilters((f) => ({ ...f, ticketType: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[130px]"
          >
            <option value="">Loại vé</option>
            <option value="EARLY_BIRD">Early Bird</option>
            <option value="STANDARD">Standard</option>
            <option value="VIP">VIP</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[130px]"
          >
            <option value="">Trạng thái</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="HOLDING">Holding</option>
            <option value="EXPIRED">Expired</option>
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
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[60px]">STT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Mã đơn</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Họ tên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">SĐT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Loại vé</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Giá</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ngày tạo</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-[130px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    Không tìm thấy vé nào.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket, index) => {
                  const stt = (pagination.page - 1) * pagination.limit + index + 1;
                  const canToggle = ticket.status === 'ACTIVE' || ticket.status === 'INACTIVE';

                  return (
                    <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{String(stt).padStart(3, '0')}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{ticket.orderCode}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{ticket.buyerName}</td>
                      <td className="px-4 py-3 text-gray-700">{ticket.buyerPhone}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={ticket.buyerEmail}>
                        {ticket.buyerEmail}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_TYPE_COLORS[ticket.ticketType] || 'bg-gray-100 text-gray-700'}`}>
                          {ticket.ticketTypeLabel || TICKET_TYPE_LABELS[ticket.ticketType] || ticket.ticketType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {formatCurrency(ticket.price)}đ
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
                          {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(ticket.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* Toggle Status */}
                          {canToggle && (
                            <button
                              onClick={() => handleToggleStatus(ticket)}
                              disabled={togglingId === ticket.id}
                              className={`p-1.5 rounded-lg transition-colors ${
                                ticket.status === 'ACTIVE'
                                  ? 'text-green-500 hover:text-red-500 hover:bg-red-50'
                                  : 'text-red-500 hover:text-green-500 hover:bg-green-50'
                              } disabled:opacity-50`}
                              title={ticket.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                            >
                              {togglingId === ticket.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : ticket.status === 'ACTIVE' ? (
                                <ToggleRight className="w-4 h-4" />
                              ) : (
                                <ToggleLeft className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {/* Edit */}
                          <button
                            onClick={() => openEditDialog(ticket)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {/* Resend Email */}
                          <button
                            onClick={() => handleResendEmail(ticket.id)}
                            disabled={resendingId === ticket.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="Gửi lại email"
                          >
                            {resendingId === ticket.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
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
            <p className="text-sm text-gray-500">{pagination.total} vé tổng cộng</p>
            <div className="flex items-center gap-2">
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
              <span className="text-sm text-gray-700 ml-4">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex items-center gap-1 ml-2">
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

      {/* Edit Modal */}
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
    </div>
  );
}
