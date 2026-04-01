'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/axios';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────
interface OrderStatusData {
  orderCode: number;
  status: string;
  items: { ticketTypeName: string; quantity: number; unitPrice: number }[];
  totalQuantity: number;
  totalAmount: number;
  discountAmount: number;
  paymentLink: string;
  paymentBin: string;
  paymentAccountNumber: string;
  paymentAccountName: string;
  description: string;
  expiresAt: string;
  paidAt: string | null;
}

// ─── Countdown Hook ───────────────────────────────────────────
function useExpiryCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    function calc() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      return diff;
    }

    if (calc() <= 0) return;

    const interval = setInterval(() => {
      if (calc() <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return {
    time: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    expired: secondsLeft <= 0 && expiresAt !== null,
    secondsLeft,
  };
}

// ─── Main Page Component ──────────────────────────────────────
export default function PaymentPage() {
  const params = useParams();
  const orderCode = params.orderCode as string;

  const [order, setOrder] = useState<OrderStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch order data ────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${orderCode}/status`);
      const data = res.data.data as OrderStatusData;
      setOrder(data);
      setError(null);
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Không thể tải thông tin đơn hàng.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderCode]);

  // ── Initial fetch ───────────────────────────────────────────
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── Polling for payment status ──────────────────────────────
  useEffect(() => {
    if (!order || order.status !== 'PENDING') return;

    pollingRef.current = setInterval(async () => {
      const data = await fetchOrder();
      if (data && data.status !== 'PENDING') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [order?.status, fetchOrder]);

  const countdown = useExpiryCountdown(order?.expiresAt ?? null);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Đang tải thông tin thanh toán...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Không tìm thấy đơn hàng</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'Đường dẫn thanh toán không hợp lệ.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  // ── PAID ────────────────────────────────────────────────────
  if (order.status === 'PAID') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-lg w-full">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Thanh toán thành công!
          </h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            Vé điện tử sẽ được gửi đến email của bạn trong vài phút.
          </p>

          {/* Order Card */}
          <div className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="font-bold text-gray-900">
                Đơn hàng #{order.orderCode}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Đã thanh toán
              </span>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{item.ticketTypeName} × {item.quantity}</span>
                  <span className="font-medium text-gray-900">
                    {(item.unitPrice * item.quantity).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              ))}
              {order.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Giảm giá</span>
                  <span className="font-medium text-green-600">−{order.discountAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Tổng cộng</span>
                <span className="font-bold text-lg text-gray-900">{order.totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>

          <Link
            href="/"
            className="block w-full py-3 px-6 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 text-center"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  // ── EXPIRED / CANCELLED ─────────────────────────────────────
  if (order.status === 'EXPIRED' || order.status === 'CANCELLED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {order.status === 'EXPIRED' ? 'Đơn hàng đã hết hạn' : 'Đơn hàng đã bị huỷ'}
          </h2>
          <p className="text-sm text-gray-500 mb-2">
            Mã đơn hàng: <span className="font-mono font-semibold">#{order.orderCode}</span>
          </p>
          <p className="text-sm text-gray-500 mb-8">
            {order.status === 'EXPIRED'
              ? 'Thời gian thanh toán đã hết. Vui lòng đặt vé lại.'
              : 'Đơn hàng này đã bị huỷ.'}
          </p>
          <Link
            href="/booking/tickets"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Đặt vé mới
          </Link>
        </div>
      </div>
    );
  }

  // ── PENDING — Show QR Payment ───────────────────────────────
  const hasBankData = order.paymentBin && order.paymentAccountNumber;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[800px] px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-base font-bold text-gray-900">
              Thanh toán đơn hàng #{order.orderCode}
            </h1>
          </div>
          {/* Timer */}
          <div className="flex items-center gap-2">
            <div className={`border rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              countdown.secondsLeft < 120 ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-300 text-gray-700'
            }`}>
              ⏱ {countdown.time}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Copy Link Banner */}
          <CopyLinkBanner />

          <div className="p-6 sm:p-8">
            {/* Instruction */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 mb-6">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
              </div>
              <p className="text-sm text-gray-700">
                Mở App Ngân hàng bất kỳ để <span className="font-bold">quét mã VietQR</span> hoặc <span className="font-bold">chuyển khoản</span> chính xác số tiền bên dưới
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* QR Code */}
              {hasBankData && (
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <div className="w-56 h-56 bg-white border border-gray-200 rounded-xl p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://img.vietqr.io/image/${order.paymentBin}-${order.paymentAccountNumber}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(order.description)}&accountName=${encodeURIComponent(order.paymentAccountName)}`}
                      alt="VietQR Payment Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>Powered by</span>
                    <span className="font-semibold text-gray-600">VietQR</span>
                  </div>
                </div>
              )}

              {/* Bank Details */}
              <div className="flex-1 space-y-4">
                {/* Total */}
                <div className="bg-gray-900 text-white rounded-xl p-4 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                    Tổng tiền cần thanh toán
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {order.totalAmount.toLocaleString('vi-VN')} VNĐ
                  </div>
                </div>

                {/* Details */}
                {hasBankData && (
                  <div className="space-y-3 text-sm">
                    <PaymentDetailRow label="Số tài khoản" value={order.paymentAccountNumber} copyable />
                    <PaymentDetailRow label="Thụ hưởng" value={order.paymentAccountName} />
                    <PaymentDetailRow label="Số tiền" value={`${order.totalAmount.toLocaleString('vi-VN')} VNĐ`} copyable />
                    <PaymentDetailRow label="Nội dung" value={order.description} copyable />
                    <PaymentDetailRow label="ID" value={`#${order.orderCode}`} />
                  </div>
                )}

                {/* Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">Lưu ý:</span> Nhập chính xác số tiền <span className="font-bold">{order.totalAmount.toLocaleString('vi-VN')}</span> khi chuyển khoản
                  </p>
                </div>

                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <p className="text-xs text-gray-500">
                    Đang chờ thanh toán... Trạng thái sẽ tự động cập nhật
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items Summary */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Chi tiết đơn hàng</h3>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.ticketTypeName} × {item.quantity}</span>
                    <span className="font-medium text-gray-900">
                      {(item.unitPrice * item.quantity).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ))}
                {order.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Giảm giá</span>
                    <span className="font-medium text-green-600">−{order.discountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">Tổng cộng</span>
                  <span className="font-bold text-gray-900">{order.totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Copy Link Banner ─────────────────────────────────────────
function CopyLinkBanner() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-blue-700 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="truncate">Bạn có thể sao chép đường dẫn này để thanh toán trên thiết bị khác</span>
      </div>
      <button
        onClick={handleCopy}
        className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {copied ? '✓ Đã sao chép' : 'Sao chép link'}
      </button>
    </div>
  );
}

// ─── Payment Detail Row ───────────────────────────────────────
function PaymentDetailRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 text-right">{value}</span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-[11px] font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            {copied ? '✓ Đã sao' : 'Sao chép'}
          </button>
        )}
      </div>
    </div>
  );
}
