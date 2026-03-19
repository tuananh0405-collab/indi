'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { TOKEN_KEY } from '@/lib/axios';
import {
  LayoutDashboard,
  Ticket,
  ScanLine,
  Settings,
  HelpCircle,
  LogOut,
  User,
} from 'lucide-react';

// ─── Sidebar Navigation Items ─────────────────────────────────
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Quản lý vé',
    href: '/admin/tickets',
    icon: Ticket,
  },
  {
    label: 'Check in',
    href: '/admin/checkin',
    icon: ScanLine,
  },
];

const BOTTOM_ITEMS = [
  { label: 'Cài đặt', href: '#', icon: Settings },
  { label: 'Trợ giúp', href: '#', icon: HelpCircle },
];

interface AdminInfo {
  email: string;
  name: string;
  picture?: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Check token synchronously on first render to avoid flash
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  const checkAuth = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.replace('/login');
      return;
    }
    try {
      const info = localStorage.getItem('admin_info');
      if (info) setAdminInfo(JSON.parse(info));
    } catch { /* ignore */ }
    setIsAuthed(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('admin_info');
    window.location.replace('/login');
  }

  // Show nothing until auth is resolved (prevents flash)
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#1a1a2e] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ─── Sidebar ──────────────────────────────────────── */}
      <aside className="w-[200px] bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1a1a2e] rounded-xl flex items-center justify-center">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Indi-Indi</p>
            <p className="text-[11px] text-gray-400 leading-tight">Enterprise</p>
          </div>
        </div>

        <nav className="flex-1 px-3 mt-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1a1a2e] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-2">
          <ul className="space-y-1">
            {BOTTOM_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-3 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2">
            {adminInfo?.picture ? (
              <img
                src={adminInfo.picture}
                alt={adminInfo.name}
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {adminInfo?.name || 'User'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {adminInfo?.email || 'user@example.com'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
