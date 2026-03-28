'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { type DashboardResponse } from '@/lib/types';

export default function StatisticsPage() {
  const [stats, setStats] = useState<DashboardResponse['data'] | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get<DashboardResponse>('/admin/dashboard');
        setStats(res.data.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
  }, []);

  function formatCurrency(amount: number) {
    return amount.toLocaleString('vi-VN');
  }

  // Simple donut chart using CSS conic-gradient
  const totalTickets = stats ? stats.sold + stats.available : 1;
  const soldPct = stats ? Math.round((stats.sold / totalTickets) * 100) : 0;
  const checkedInPct = stats ? Math.round((stats.checkedIn / totalTickets) * 100) : 0;
  const availablePct = 100 - soldPct - checkedInPct;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
          📊 Xuất báo cáo
        </button>
      </div>

      {/* ─── Thống kê vé ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Thống kê vé</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Tổng doanh thu Merch</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  VND {stats ? formatCurrency(stats.totalRevenue) : '0'}
                </p>
              </div>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600">
                <option>Theo ngày</option>
                <option>Theo tuần</option>
                <option>Theo tháng</option>
              </select>
            </div>

            {/* Simple Chart Placeholder */}
            <div className="h-[180px] flex items-end gap-1 pt-4">
              {[20, 35, 25, 55, 40, 70, 50].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gray-900 rounded-t-sm transition-all duration-300 hover:bg-gray-700"
                    style={{ height: `${h * 2}px` }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {['24/03', '25/03', '26/03', '27/03', '28/03', '29/03', '30/03'][i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">{'<>'} Doanh thu (Đơn vị: Nghìn VND)</p>
          </div>

          {/* Donut Chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Tình trạng vé</p>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600">
                <option>Tất cả loại vé</option>
                <option>Early Bird</option>
                <option>Standard</option>
                <option>VIP</option>
              </select>
            </div>

            <div className="flex items-center justify-center gap-8">
              {/* Donut */}
              <div className="relative w-[160px] h-[160px]">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: `conic-gradient(
                      #d1d5db 0% ${availablePct}%,
                      #1a1a2e ${availablePct}% ${availablePct + soldPct}%,
                      #9ca3af ${availablePct + soldPct}% 100%
                    )`,
                  }}
                />
                <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-400">Số vé</p>
                  <p className="text-2xl font-bold text-gray-900">{stats ? formatCurrency(stats.sold + stats.available) : '0'}</p>
                </div>
              </div>
              {/* Legend */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-sm text-gray-600">Còn lại</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#1a1a2e]" />
                  <span className="text-sm text-gray-600">Đã sử dụng</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-600">Có đặt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Thống kê Merch ─────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Thống kê Merch</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Tổng doanh thu Merch</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">VND 0</p>
              </div>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600">
                <option>Theo ngày</option>
              </select>
            </div>
            <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">
              Chưa có dữ liệu
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Tình trạng vé</p>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600">
                <option>Tất cả loại vé</option>
              </select>
            </div>
            <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">
              Chưa có dữ liệu
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bottom Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Hoạt động gần đây</h3>
          <div className="flex items-center justify-center h-[120px] text-gray-300 text-sm">
            Chưa có hoạt động
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Cảnh báo</h3>
          <div className="flex items-center justify-center h-[120px] text-gray-300 text-sm">
            Không có cảnh báo
          </div>
        </div>
      </div>
    </div>
  );
}
