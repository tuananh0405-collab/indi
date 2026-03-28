'use client';

import { useState } from 'react';

interface TicketType {
  id: number;
  name: string;
  label: string;
  price: number;
  capacity: number | null;
  sold: number;
  remaining: number | null;
  active: boolean;
}

interface TicketSelectorProps {
  ticketType: TicketType;
  selected: number;
  onChange: (quantity: number) => void;
  disabled: boolean;
}

const TICKET_BENEFITS: Record<string, string[]> = {
  EARLY_BIRD: ['Giá ưu đãi đặc biệt', 'Vào cửa sớm 30 phút', 'Quà tặng kỷ niệm'],
  STANDARD: ['Vào cửa tiêu chuẩn', 'Khu vực chỗ ngồi chung'],
  VIP: ['Khu vực VIP riêng biệt', 'Đồ uống miễn phí', 'Quà tặng đặc biệt', 'Meet & Greet'],
};

export default function TicketSelector({ ticketType, selected, onChange, disabled }: TicketSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const benefits = TICKET_BENEFITS[ticketType.name] || [];
  
  const isSoldOut = ticketType.remaining !== null && ticketType.remaining <= 0;
  const maxQty = Math.min(5, ticketType.remaining ?? 5);

  const isVip = ticketType.label.toLowerCase().includes('vip');
  const bgColor = isVip ? 'bg-[#fff5d0]' : 'bg-[#ebebeb]'; /* amber-50ish / gray-100ish */
  const iconBg = isVip ? 'bg-[#f59e0b]' : 'bg-[#9ca3af]'; /* amber-500 / gray-400 */

  return (
    <div className={`rounded-lg overflow-hidden relative ${bgColor} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Sold Out Overlay */}
      {isSoldOut && (
        <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
          <span className="bg-red-600 text-white font-bold px-6 py-2 rounded-full text-sm tracking-wider uppercase">
            Hết vé
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex items-center gap-3 p-4">
        {/* Ticket Icon */}
        <div className={`w-[72px] h-10 rounded-sm shrink-0 relative ${iconBg}`}>
          <div className={`absolute top-1/2 -left-2 w-4 h-4 rounded-full -translate-y-1/2 ${bgColor}`} />
          <div className={`absolute top-1/2 -right-2 w-4 h-4 rounded-full -translate-y-1/2 ${bgColor}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13px] text-gray-900 leading-tight mb-0.5">{ticketType.label}</div>
          <div className="text-[11px] text-gray-600">
            {ticketType.price > 0 ? `${ticketType.price.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center bg-[#e5e7eb] rounded-md px-1 py-1 gap-1 shrink-0">
          <button
            onClick={() => onChange(Math.max(0, selected - 1))}
            disabled={selected === 0}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-black hover:bg-white/50 rounded transition-colors disabled:opacity-30 font-medium"
            aria-label="Giảm số lượng"
          >
            −
          </button>
          <span className="text-[13px] font-semibold text-gray-900 w-6 text-center tabular-nums">
            {String(selected).padStart(2, '0')}
          </span>
          <button
            onClick={() => onChange(Math.min(maxQty, selected + 1))}
            disabled={selected >= maxQty}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-black hover:bg-white/50 rounded transition-colors disabled:opacity-30 font-medium"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
      </div>

      {/* Expandable Benefits */}
      <div className={`border-t border-black/5`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Xem quyền lợi của vé
        </button>

        {expanded && (
          <div className="px-4 pb-3 text-[10px] text-gray-500 leading-relaxed">
            {benefits.length > 0 ? (
              <p>
                {benefits.map((b, i) => (
                  <span key={i}>
                    {i > 0 && ' • '}
                    {b}
                  </span>
                ))}
              </p>
            ) : (
              <p>Quyền lợi cho vé này sẽ được hiển thị tại đây.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
