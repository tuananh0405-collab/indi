'use client';

import { useState } from 'react';

interface BuyerInfo {
  buyerName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string;
}

interface TicketAddress {
  address: string;
  district: string;
  city: string;
}

interface BuyerInfoFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
  ticketAddresses: TicketAddress[];
  onTicketAddressChange: (index: number, addr: TicketAddress) => void;
  selectedTickets: { ticketTypeId: number; quantity: number; label: string; price: number }[];
}

const inputClasses =
  'w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all duration-200 text-sm';

export default function BuyerInfoForm({
  buyerInfo,
  onChange,
  ticketAddresses,
  onTicketAddressChange,
  selectedTickets,
}: BuyerInfoFormProps) {
  const [customerExpanded, setCustomerExpanded] = useState(true);
  const [ticketSections, setTicketSections] = useState<Record<string, boolean>>({});

  const update = (field: keyof BuyerInfo, value: string) => {
    onChange({ ...buyerInfo, [field]: value });
  };

  const toggleTicketSection = (key: string) => {
    setTicketSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Build flattened list of ticket entries
  const ticketEntries: { label: string; index: number; ticketNumber: number }[] = [];
  let globalIdx = 0;
  for (const t of selectedTickets) {
    for (let i = 0; i < t.quantity; i++) {
      ticketEntries.push({ label: t.label, index: globalIdx, ticketNumber: i + 1 });
      globalIdx++;
    }
  }

  return (
    <div className="space-y-4">
      {/* Customer Details */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setCustomerExpanded(!customerExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-900 text-sm">Chi tiết khách hàng</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${customerExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {customerExpanded && (
          <div className="px-5 pb-5 space-y-4 animate-in fade-in duration-200">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="buyerEmail" className="block text-xs font-medium text-gray-600">
                Email<span className="text-red-500">*</span>
              </label>
              <input
                id="buyerEmail"
                type="email"
                value={buyerInfo.buyerEmail}
                onChange={(e) => update('buyerEmail', e.target.value)}
                placeholder="Nhập email của bạn"
                className={inputClasses}
                autoComplete="email"
              />
            </div>

            {/* First Name / Last Name side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="buyerName" className="block text-xs font-medium text-gray-600">
                  Tên<span className="text-red-500">*</span>
                </label>
                <input
                  id="buyerName"
                  type="text"
                  value={buyerInfo.buyerName}
                  onChange={(e) => update('buyerName', e.target.value)}
                  placeholder="Nhập tên của bạn"
                  className={inputClasses}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="buyerLastName" className="block text-xs font-medium text-gray-600">
                  Họ<span className="text-red-500">*</span>
                </label>
                <input
                  id="buyerLastName"
                  type="text"
                  value={buyerInfo.buyerLastName}
                  onChange={(e) => update('buyerLastName', e.target.value)}
                  placeholder="Nhập họ của bạn"
                  className={inputClasses}
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="buyerPhone" className="block text-xs font-medium text-gray-600">
                Số điện thoại liên lạc<span className="text-red-500">*</span>
              </label>
              <input
                id="buyerPhone"
                type="tel"
                value={buyerInfo.buyerPhone}
                onChange={(e) => update('buyerPhone', e.target.value)}
                placeholder="Nhập số điện thoại của bạn"
                className={inputClasses}
                autoComplete="tel"
              />
            </div>
          </div>
        )}
      </div>

      {/* Per-ticket address sections */}
      {ticketEntries.map((entry) => {
        const key = `ticket-${entry.index}`;
        const isExpanded = ticketSections[key] ?? false;
        const addr = ticketAddresses[entry.index] || { address: '', district: '', city: '' };

        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleTicketSection(key)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-900 text-sm">
                Thông tin vé {entry.label} {String(entry.ticketNumber).padStart(2, '0')}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">
                    Địa chỉ<span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={addr.address}
                    onChange={(e) =>
                      onTicketAddressChange(entry.index, { ...addr, address: e.target.value })
                    }
                    placeholder="Nhập địa chỉ của bạn"
                    rows={3}
                    className={`${inputClasses} resize-none`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Quận / Huyện<span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addr.district}
                      onChange={(e) =>
                        onTicketAddressChange(entry.index, { ...addr, district: e.target.value })
                      }
                      className={inputClasses}
                    >
                      <option value="">Chọn quận/huyện</option>
                      <option value="Quận Ba Đình">Quận Ba Đình</option>
                      <option value="Quận Hoàn Kiếm">Quận Hoàn Kiếm</option>
                      <option value="Quận Đống Đa">Quận Đống Đa</option>
                      <option value="Quận Cầu Giấy">Quận Cầu Giấy</option>
                      <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
                      <option value="Quận Hai Bà Trưng">Quận Hai Bà Trưng</option>
                      <option value="Quận Hoàng Mai">Quận Hoàng Mai</option>
                      <option value="Quận Long Biên">Quận Long Biên</option>
                      <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
                      <option value="Quận Bắc Từ Liêm">Quận Bắc Từ Liêm</option>
                      <option value="Quận Tây Hồ">Quận Tây Hồ</option>
                      <option value="Quận Hà Đông">Quận Hà Đông</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Thành phố<span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addr.city}
                      onChange={(e) =>
                        onTicketAddressChange(entry.index, { ...addr, city: e.target.value })
                      }
                      className={inputClasses}
                    >
                      <option value="">Chọn thành phố</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                      <option value="Hải Phòng">Hải Phòng</option>
                      <option value="Cần Thơ">Cần Thơ</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
