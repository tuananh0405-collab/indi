'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { CheckCircle, Loader2, Ticket, ArrowRight } from 'lucide-react';

interface OrderData {
  orderCode: number;
  status: string;
  items: { ticketType: string; quantity: number; price: number }[];
  quantity: number;
  totalAmount: number;
  paidAt: string | null;
}

function formatCurrency(amount: number) {
  return amount.toLocaleString('vi-VN');
}

const TICKET_TYPE_LABELS: Record<string, string> = {
  EARLY_BIRD: 'Early Bird',
  STANDARD: 'Standard',
  VIP: 'VIP',
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get('orderCode');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderCode) {
      setError('Không tìm thấy mã đơn hàng.');
      setLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

    async function fetchOrder() {
      try {
        const res = await fetch(`${apiUrl}/orders/${orderCode}/status`);
        const data = await res.json();
        if (data.success) {
          setOrder(data.data);
        } else {
          setError(data.error?.message || 'Không thể tải thông tin đơn hàng.');
        }
      } catch {
        setError('Không thể kết nối đến server.');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Đang xác nhận thanh toán...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a1a2e] text-white rounded-lg text-sm font-medium hover:bg-[#2a2a4e] transition-colors"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-lg w-full mx-4">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Thanh toán thành công! 🎉
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Cảm ơn bạn đã đặt vé. Vé sẽ được gửi đến email của bạn.
        </p>

        {/* Order Details */}
        {order && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Mã đơn hàng</span>
                <span className="text-sm font-mono font-semibold text-gray-900">
                  #{order.orderCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Trạng thái</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {order.status === 'PAID' ? 'Đã thanh toán' : order.status}
                </span>
              </div>

              {/* Ticket items */}
              {order.items?.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5" />
                    {TICKET_TYPE_LABELS[item.ticketType] || item.ticketType} × {item.quantity}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatCurrency(item.price * item.quantity)} ₫
                  </span>
                </div>
              ))}

              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Tổng cộng</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(order.totalAmount)} ₫
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-400 mb-4">
                Vé điện tử sẽ được gửi đến email của bạn trong vài phút.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a2e] text-white rounded-xl text-sm font-medium hover:bg-[#2a2a4e] transition-colors"
              >
                Về trang chủ
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
