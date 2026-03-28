'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { TOKEN_KEY } from '@/lib/axios';
import {
  BarChart3,
  Tag,
  Ticket,
  ScanLine,
  ShoppingBag,
  History,
  Package,
  Settings,
  HelpCircle,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

// ─── Sidebar Navigation Items ─────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  items?: NavItem[];
  href?: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Thống kê',
    icon: BarChart3,
    href: '/admin/statistics',
  },
  {
    label: 'Mã giảm giá',
    icon: Tag,
    href: '/admin/promos',
  },
  {
    label: 'Vé tham dự',
    icon: Ticket,
    items: [
      { label: 'Quản lý vé', href: '/admin/dashboard', icon: Ticket },
      { label: 'Check In', href: '/admin/checkin', icon: ScanLine },
    ],
  },
  {
    label: 'Quản lý Merch',
    icon: ShoppingBag,
    items: [
      { label: 'Lịch sử giao dịch', href: '/admin/merch/transactions', icon: History },
      { label: 'Quản lý đơn hàng', href: '/admin/merch/orders', icon: Package },
      { label: 'Settings', href: '/admin/merch/settings', icon: Settings },
    ],
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
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Auto-expand groups with active routes
  useEffect(() => {
    const expanded: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      if (group.items) {
        const isActive = group.items.some(
          (item) => pathname === item.href || pathname.startsWith(item.href + '/')
        );
        if (isActive) expanded[group.label] = true;
      }
    }
    setOpenGroups((prev) => ({ ...prev, ...expanded }));
  }, [pathname]);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('admin_info');
    window.location.replace('/login');
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#1a1a2e] rounded-full animate-spin" />
      </div>
    );
  }

  // Shared sidebar content
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1a1a2e] rounded-xl flex items-center justify-center">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Indi-Indi</p>
          <p className="text-[11px] text-gray-400 leading-tight">Enterprise</p>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 px-3 mt-1 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isGroupActive = group.href
            ? pathname === group.href || pathname.startsWith(group.href + '/')
            : group.items?.some(
                (item) => pathname === item.href || pathname.startsWith(item.href + '/')
              );
          const isOpen = openGroups[group.label] || false;
          const Icon = group.icon;

          // Simple link
          if (group.href) {
            return (
              <Link
                key={group.label}
                href={group.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isGroupActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{group.label}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Link>
            );
          }

          // Collapsible group
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isGroupActive
                    ? 'text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <ul className="ml-5 pl-3 border-l border-gray-100 space-y-0.5 py-1">
                  {group.items!.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'text-gray-900 font-medium bg-gray-50'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Items */}
      <div className="px-3 pb-2">
        <ul className="space-y-0.5">
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

      {/* User Info */}
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
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ─── Desktop Sidebar ────────────────────────────── */}
      <aside className="hidden md:flex w-[220px] bg-white border-r border-gray-100 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ─── Mobile Sidebar Overlay ─────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[260px] h-full bg-white flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ─── Main Content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
              <Ticket className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Indi-Indi</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
