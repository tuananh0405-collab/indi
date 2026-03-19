'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import {
  type Ticket,
  type Pagination,
  type DashboardResponse,
  type TicketListResponse,
  TICKET_TYPE_LABELS,
  TICKET_TYPE_COLORS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
} from '@/lib/types';
import {
  FileSpreadsheet,
  Search,
  Pencil,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Loader2,
} from 'lucide-react';

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
  const [stats, setStats] = useState<DashboardResponse['data'] | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(INITIAL_FILTERS);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get<DashboardResponse>('/admin/dashboard');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

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

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchTickets(1); }, [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch() { setAppliedFilters({ ...filters }); }
  function handleClearFilters() { setFilters(INITIAL_FILTERS); setAppliedFilters(INITIAL_FILTERS); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleSearch(); }

  function openEditDialog(ticket: Ticket) {
    setEditingTicket(ticket);
    setEditForm({ buyerName: ticket.buyerName, buyerEmail: ticket.buyerEmail, buyerPhone: ticket.buyerPhone, notes: ticket.notes || '' });
  }

  async function handleEditSave() {
    if (!editingTicket) return;
    try {
      setEditLoading(true);
      await api.patch(`/admin/tickets/${editingTicket._id}`, editForm);
      setEditingTicket(null);
      fetchTickets(pagination.page);
    } catch (err) {
      console.error('Failed to update ticket:', err);
      alert('Cập nhật thất bại.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleResendEmail(ticketId: string) {
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
      console.error('Export failed:', err);
      alert('Xuất file thất bại.');
    } finally {
      setExporting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatCurrency(amount: number) {
    return amount.toLocaleString('vi-VN');
  }

  const hasActiveFilters = appliedFilters.search || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.ticketType || appliedFilters.status;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Quản lý vé</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">Tổng doanh thu</p>
          {statsLoading ? <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-gray-900">VND {formatCurrency(stats?.totalRevenue ?? 0)}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">Tổng số vé</p>
          {statsLoading ? <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.sold ?? 0)}</p>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} onKeyDown={handleKeyDown} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]" />
          </div>
          <button onClick={handleSearch} className="px-5 py-2.5 bg-[#1a1a2e] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a4e] transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" /> Tìm kiếm
          </button>
        </div>
        <div className="flex gap-3 items-center">
          <input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20" />
          <input type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20" />
          <select value={filters.ticketType} onChange={(e) => setFilters((f) => ({ ...f, ticketType: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[140px]">
            <option value="">Loại vé</option>
            <option value="EARLY_BIRD">Early Bird</option>
            <option value="STANDARD">Standard</option>
            <option value="VIP">VIP</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 min-w-[140px]">
            <option value="">Trạng thái vé</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="HOLDING">Holding</option>
            <option value="EXPIRED">Expired</option>
          </select>
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Xóa bộ lọc">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[60px]">STT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">ID đơn hàng</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">ID vé</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Họ tên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Số điện thoại</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Thời gian đặt</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Loại vé</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Thành tiền</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ghi chú</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-[100px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">Không tìm thấy vé nào.</td></tr>
              ) : (
                tickets.map((ticket, index) => {
                  const stt = (pagination.page - 1) * pagination.limit + index + 1;
                  return (
                    <tr key={ticket._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{String(stt).padStart(4, '0')}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{ticket.orderCode}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700" title={ticket.uuid}>{ticket.uuid.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{ticket.buyerName}</td>
                      <td className="px-4 py-3 text-gray-700">{ticket.buyerPhone}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={ticket.buyerEmail}>{ticket.buyerEmail}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(ticket.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_TYPE_COLORS[ticket.ticketType] || 'bg-gray-100 text-gray-700'}`}>
                          {TICKET_TYPE_LABELS[ticket.ticketType] || ticket.ticketType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(ticket.price)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-500'}`}>
                          {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate" title={ticket.notes}>{ticket.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditDialog(ticket)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 transition-colors" title="Chỉnh sửa"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleResendEmail(ticket._id)} disabled={resendingId === ticket._id} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50" title="Gửi lại email">
                            {resendingId === ticket._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
              <span className="text-sm text-gray-500">Rows per page</span>
              <select value={pagination.limit} onChange={(e) => { setPagination((p) => ({ ...p, limit: parseInt(e.target.value) })); fetchTickets(1); }} className="px-2 py-1 border border-gray-200 rounded text-sm">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <span className="text-sm text-gray-700 ml-4">Page {pagination.page} of {pagination.totalPages || 1}</span>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => fetchTickets(1)} disabled={pagination.page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
                <button onClick={() => fetchTickets(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => fetchTickets(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => fetchTickets(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronsRight className="w-4 h-4" /></button>
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
                <input type="text" value={editForm.buyerName} onChange={(e) => setEditForm((f) => ({ ...f, buyerName: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.buyerEmail} onChange={(e) => setEditForm((f) => ({ ...f, buyerEmail: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input type="text" value={editForm.buyerPhone} onChange={(e) => setEditForm((f) => ({ ...f, buyerPhone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingTicket(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
              <button onClick={handleEditSave} disabled={editLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a4e] transition-colors disabled:opacity-50 flex items-center gap-2">
                {editLoading && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
