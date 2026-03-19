'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { XCircle, ArrowRight, Loader2 } from 'lucide-react';

function CancelContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get('orderCode');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-lg w-full mx-4 text-center">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Thanh toán đã bị huỷ
        </h1>
        <p className="text-gray-500 mb-6">
          Đơn hàng của bạn chưa được thanh toán. Vé sẽ được giữ trong 10 phút trước khi tự động huỷ.
        </p>

        {/* Order Code */}
        {orderCode && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Mã đơn hàng</span>
              <span className="text-sm font-mono font-semibold text-gray-900">
                #{orderCode}
              </span>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a2e] text-white rounded-xl text-sm font-medium hover:bg-[#2a2a4e] transition-colors"
          >
            Về trang chủ
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
