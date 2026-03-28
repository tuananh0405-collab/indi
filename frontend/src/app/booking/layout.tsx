import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đặt vé — INDI INDI',
  description: 'Đặt vé tham gia sự kiện INDI INDI — Luồng Nghiệp Vụ',
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="/booking" className="flex items-center gap-3 group">
              <img src="/logo.svg" alt="INDI Logo" className="h-8 w-auto" />
            </a>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Giỏ hàng
              </button>
              <div className="w-8 h-8 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
