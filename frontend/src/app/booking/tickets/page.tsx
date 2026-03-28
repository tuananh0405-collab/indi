'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import TicketSelector from '../ticket-selector';
import BuyerInfoForm from '../buyer-info-form';

// ─── Payment Data (from PayOS) ────────────────────────────────
interface PaymentData {
  orderCode: number;
  totalAmount: number;
  qrCode: string;
  bin: string;
  accountNumber: string;
  accountName: string;
  description: string;
  paymentLink: string;
}

// ─── Types ────────────────────────────────────────────────────
interface TicketType {
  id: number;
  name: string;
  label: string;
  price: number;
  capacity: number | null;
  sold: number;
  remaining: number | null;
  active: boolean;
  sortOrder: number;
}

interface SelectedTicket {
  ticketTypeId: number;
  quantity: number;
  label: string;
  price: number;
}

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

// ─── Steps ────────────────────────────────────────────────────
const STEPS = [
  { id: 1, number: '01', label: 'Chọn loại vé' },
  { id: 2, number: '02', label: 'Thông tin chung' },
  { id: 3, number: '03', label: 'Thanh toán' },
  { id: 4, number: '04', label: 'Xác nhận' },
];

// ─── Countdown Timer Hook ─────────────────────────────────────
function useCountdown(startMinutes: number, active: boolean, onExpire?: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(startMinutes * 60);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, onExpire]);

  const reset = useCallback(() => {
    setSecondsLeft(startMinutes * 60);
  }, [startMinutes]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return {
    time: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    reset
  };
}

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<SelectedTicket[]>([]);
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    buyerName: '',
    buyerLastName: '',
    buyerEmail: '',
    buyerPhone: '',
  });
  const [ticketAddresses, setTicketAddresses] = useState<TicketAddress[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  // Payment QR state
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentPhase, setPaymentPhase] = useState<'selecting' | 'qr' | 'paid'>('selecting');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);

  const handleTimeout = useCallback(() => {
    setTimerActive(false);
    setShowTimeoutModal(true);
  }, []);

  const { time: countdown, reset: resetTimer } = useCountdown(10, timerActive, handleTimeout);

  const handleRestartFlow = useCallback(() => {
    setShowTimeoutModal(false);
    setSelectedTickets([]);
    setBuyerInfo({ buyerName: '', buyerLastName: '', buyerEmail: '', buyerPhone: '' });
    setPromoCode('');
    setPromoInput('');
    setPromoDiscount(0);
    setPromoApplied(false);
    setPaymentData(null);
    setPaymentPhase('selecting');
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStep(1);
    resetTimer();
  }, [resetTimer]);

  // ── Fetch ticket types ─────────────────────────────────────
  useEffect(() => {
    async function fetchTicketTypes() {
      try {
        const res = await api.get('/ticket-types');
        setTicketTypes(res.data.data.ticketTypes);
      } catch {
        setError('Không thể tải danh sách vé. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    }
    fetchTicketTypes();
  }, []);

  // ── Computed values ────────────────────────────────────────
  const totalQuantity = selectedTickets.reduce((sum, t) => sum + t.quantity, 0);
  const subtotal = selectedTickets.reduce((sum, t) => sum + t.quantity * t.price, 0);
  const totalAmount = subtotal - promoDiscount;

  // Keep ticketAddresses in sync with total quantity
  useEffect(() => {
    setTicketAddresses((prev) => {
      const arr = [...prev];
      while (arr.length < totalQuantity) {
        arr.push({ address: '', district: '', city: '' });
      }
      return arr.slice(0, totalQuantity);
    });
  }, [totalQuantity]);

  // ── Promo code handler ────────────────────────────────────
  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setPromoLoading(true);
    setPromoError(null);

    try {
      const res = await api.post('/promo/validate', { code, subtotal });
      setPromoDiscount(res.data.data.discountAmount);
      setPromoCode(code);
      setPromoApplied(true);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Mã giảm giá không hợp lệ.';
      setPromoError(msg);
      setPromoDiscount(0);
      setPromoCode('');
      setPromoApplied(false);
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, subtotal]);

  const handleRemovePromo = useCallback(() => {
    setPromoCode('');
    setPromoInput('');
    setPromoDiscount(0);
    setPromoApplied(false);
    setPromoError(null);
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const handleTicketChange = useCallback(
    (ticketTypeId: number, quantity: number, label: string, price: number) => {
      setSelectedTickets((prev) => {
        const existing = prev.filter((t) => t.ticketTypeId !== ticketTypeId);
        if (quantity > 0) {
          return [...existing, { ticketTypeId, quantity, label, price }];
        }
        return existing;
      });
      setError(null);
    },
    []
  );

  const handleClearAll = useCallback(() => {
    setSelectedTickets([]);
  }, []);

  const handleNext = useCallback(() => {
    if (step === 1) {
      if (totalQuantity === 0) {
        setError('Vui lòng chọn ít nhất 1 vé.');
        return;
      }
      if (totalQuantity > 5) {
        setError('Tối đa 5 vé mỗi đơn hàng.');
        return;
      }
      setError(null);
      setStep(2);
      setTimerActive(true);
    } else if (step === 2) {
      if (!buyerInfo.buyerName.trim()) {
        setError('Vui lòng nhập tên.');
        return;
      }
      if (!buyerInfo.buyerEmail.trim() || !buyerInfo.buyerEmail.includes('@')) {
        setError('Vui lòng nhập email hợp lệ.');
        return;
      }
      if (!buyerInfo.buyerPhone.trim()) {
        setError('Vui lòng nhập số điện thoại.');
        return;
      }
      setError(null);
      setStep(3);
    }
  }, [step, totalQuantity, buyerInfo]);

  const handleBack = useCallback(() => {
    if (paymentPhase === 'qr') {
      // Go back from QR to payment method selection
      setPaymentPhase('selecting');
      setPaymentData(null);
      // Stop polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setError(null);
      return;
    }
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  }, [step, paymentPhase]);

  // ── Polling for payment status ────────────────────────────
  useEffect(() => {
    if (paymentPhase !== 'qr' || !paymentData) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/orders/${paymentData.orderCode}/status`);
        if (res.data.data.status === 'PAID') {
          setPaymentPhase('paid');
          setOrderCreatedAt(res.data.data.paidAt || new Date().toISOString());
          setStep(4);
          setTimerActive(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [paymentPhase, paymentData]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const fullName = `${buyerInfo.buyerLastName} ${buyerInfo.buyerName}`.trim();
      const res = await api.post('/orders', {
        buyerName: fullName,
        buyerEmail: buyerInfo.buyerEmail.trim(),
        buyerPhone: buyerInfo.buyerPhone.trim(),
        items: selectedTickets.map((t) => ({
          ticketTypeId: t.ticketTypeId,
          quantity: t.quantity,
        })),
        ...(promoCode ? { promoCode } : {}),
      });

      const data = res.data.data;

      // Free order → go straight to Step 4
      if (data.status === 'PAID') {
        setPaymentPhase('paid');
        setPaymentData(null);
        setOrderCreatedAt(new Date().toISOString());
        setStep(4);
        setTimerActive(false);
        return;
      }

      // Paid order → store QR data and show inline QR
      setPaymentData({
        orderCode: data.orderCode,
        totalAmount: data.totalAmount,
        qrCode: data.qrCode,
        bin: data.bin,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        description: data.description,
        paymentLink: data.paymentLink,
      });
      setPaymentPhase('qr');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [buyerInfo, selectedTickets, submitting, promoCode]);

  const handleTicketAddressChange = useCallback((index: number, addr: TicketAddress) => {
    setTicketAddresses((prev) => {
      const next = [...prev];
      next[index] = addr;
      return next;
    });
  }, []);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  // ── Payment methods for step 3 ─────────────────────────────
  const paymentMethods = [
    { label: 'Chuyển khoản ngân hàng', desc: 'Thanh toán qua chuyển khoản' },
    { label: 'Thanh toán qua PayOS', desc: 'Thanh toán trực tuyến' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Stepper + Timer */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between">
            {/* Step Indicator */}
            <div className="flex items-start gap-0 flex-1 justify-center">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-start">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        step === s.id
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : step > s.id
                          ? 'border-gray-900 bg-white text-gray-900'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {s.number}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium text-center max-w-[80px] leading-tight ${
                        step >= s.id ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex items-center h-12 mx-2">
                      <div
                        className={`w-16 sm:w-20 border-t-2 border-dashed ${
                          step > s.id ? 'border-gray-900' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Countdown Timer */}
            {step > 1 && (
              <div className="flex-shrink-0 ml-6">
                <div className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                  Thời gian còn lại: <span className="font-bold text-gray-900">{countdown}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6">
          {step === 1 ? (
            /* ── Step 1: Ticket Selection ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
              {/* Left: Order Details */}
              <OrderSidebar
                selectedTickets={selectedTickets}
                totalQuantity={totalQuantity}
                subtotal={subtotal}
                promoDiscount={promoDiscount}
                step={step}
              />

              {/* Right: Ticket Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Chọn loại vé</h2>
                  {selectedTickets.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {ticketTypes
                    .filter((t) => t.active)
                    .map((tt) => (
                      <TicketSelector
                        key={tt.id}
                        ticketType={tt}
                        selected={selectedTickets.find((s) => s.ticketTypeId === tt.id)?.quantity || 0}
                        onChange={(qty) => handleTicketChange(tt.id, qty, tt.label, tt.price)}
                        disabled={tt.remaining !== null && tt.remaining <= 0}
                      />
                    ))}
                </div>
              </div>
            </div>
          ) : step === 2 ? (
            /* ── Step 2: Buyer Info ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
              <OrderSidebar selectedTickets={selectedTickets} totalQuantity={totalQuantity} subtotal={subtotal} promoDiscount={promoDiscount} step={step} />
              <BuyerInfoForm
                buyerInfo={buyerInfo}
                onChange={setBuyerInfo}
                ticketAddresses={ticketAddresses}
                onTicketAddressChange={handleTicketAddressChange}
                selectedTickets={selectedTickets}
              />
            </div>
          ) : step === 3 ? (
            /* ── Step 3: Payment ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
              <OrderSidebar selectedTickets={selectedTickets} totalQuantity={totalQuantity} subtotal={subtotal} promoDiscount={promoDiscount} step={step} />

              {paymentPhase === 'qr' && paymentData ? (
                /* ── QR Payment View ── */
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold text-gray-900">Thông tin thanh toán</h3>

                  {/* Instruction */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
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
                    {/* QR Code Image */}
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                      <div className="w-56 h-56 bg-white border border-gray-200 rounded-xl p-2 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://img.vietqr.io/image/${paymentData.bin}-${paymentData.accountNumber}-compact2.png?amount=${paymentData.totalAmount}&addInfo=${encodeURIComponent(paymentData.description)}&accountName=${encodeURIComponent(paymentData.accountName)}`}
                          alt="VietQR Payment Code"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Fallback: if VietQR image fails, show the raw qrCode data URL
                            if (paymentData.qrCode) {
                              (e.target as HTMLImageElement).src = paymentData.qrCode;
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>Powered by</span>
                        <span className="font-semibold text-gray-600">VietQR</span>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="flex-1 space-y-4">
                      {/* Total */}
                      <div className="bg-gray-900 text-white rounded-xl p-4 text-center">
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                          Tổng tiền cần thanh toán
                        </div>
                        <div className="text-2xl font-bold tracking-tight">
                          {paymentData.totalAmount.toLocaleString('vi-VN')} VNĐ
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3 text-sm">
                        <PaymentDetailRow label="Số tài khoản" value={paymentData.accountNumber} copyable />
                        <PaymentDetailRow label="Thụ hưởng" value={paymentData.accountName} />
                        <PaymentDetailRow label="Số tiền" value={`${paymentData.totalAmount.toLocaleString('vi-VN')} VNĐ`} copyable />
                        <PaymentDetailRow label="Nội dung" value={paymentData.description} copyable />
                        <PaymentDetailRow label="ID" value={`#${paymentData.orderCode}`} />
                      </div>

                      {/* Warning */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-800">
                          <span className="font-semibold">Lưu ý:</span> Nhập chính xác số tiền <span className="font-bold">{paymentData.totalAmount.toLocaleString('vi-VN')}</span> khi chuyển khoản
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
                </div>
              ) : (
                /* ── Payment Method + Promo Selection ── */
                <div className="space-y-6">
                  {/* Payment Method Selection */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Hình thức chuyển khoản</h3>
                    <div className="space-y-2">
                      {paymentMethods.length > 0
                        ? paymentMethods.map((pm, i) => (
                            <label
                              key={i}
                              className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                                selectedPaymentMethod === i
                                  ? 'border-gray-900 bg-gray-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-gray-900">{pm.label}</div>
                                <div className="text-xs text-gray-500">{pm.desc}</div>
                              </div>
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={selectedPaymentMethod === i}
                                onChange={() => setSelectedPaymentMethod(i)}
                                className="w-4 h-4 text-gray-900 accent-gray-900"
                              />
                            </label>
                          ))
                        : (
                            <div className="p-4 border border-gray-200 rounded-xl text-sm text-gray-500">
                              Thanh toán qua PayOS
                            </div>
                          )}
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Nhập mã giảm giá</h3>
                    {promoApplied ? (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                        <span className="text-green-700 text-sm font-medium">🏷️ {promoCode}</span>
                        <span className="text-green-600 text-sm">
                          −{promoDiscount.toLocaleString('vi-VN')}đ
                        </span>
                        <button
                          onClick={handleRemovePromo}
                          className="ml-auto text-gray-400 hover:text-red-500 text-xs transition-colors"
                        >
                          ✕ Xóa
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value.toUpperCase());
                            setPromoError(null);
                          }}
                          placeholder="Nhập mã giảm giá"
                          className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all duration-200 text-sm uppercase"
                        />
                        <button
                          onClick={handleApplyPromo}
                          disabled={!promoInput.trim() || promoLoading}
                          className="px-5 py-3 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {promoLoading ? '...' : 'Áp dụng'}
                        </button>
                      </div>
                    )}
                    {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                  </div>

                  {/* Payment Note */}
                  <div className="bg-gray-100 rounded-xl p-4">
                    <p className="text-sm text-gray-600 text-center">
                      Hoàn thành đơn thanh toán của bạn nhé
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Step 4: Success ── */
            <div className="flex flex-col items-center justify-center py-12 px-4">
              {/* Success Icon */}
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200">
                <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                Đơn hàng xong rồi, chúc bạn vui vé với sự kiện nhé!
              </h2>
              <p className="text-sm text-gray-500 text-center mb-8">
                Vé điện tử sẽ được gửi đến email của bạn trong vài phút.
              </p>

              {/* Order Card */}
              <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    Đơn hàng #{paymentData?.orderCode || ''}
                  </span>
                  <span className="text-xs text-gray-500">
                    {orderCreatedAt
                      ? new Date(orderCreatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                      : ''}
                  </span>
                </div>
                <div className="border-t border-gray-100 px-6 py-4 space-y-3">
                  {selectedTickets.map((t) => (
                    <div key={t.ticketTypeId} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t.label} × {t.quantity}</span>
                      <span className="font-medium text-gray-900">
                        {(t.price * t.quantity).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))}
                  {promoDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Giảm giá</span>
                      <span className="font-medium text-green-600">−{promoDiscount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Tổng cộng</span>
                    <span className="font-bold text-lg text-gray-900">{totalAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white z-40">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            {step === 4 ? (
              /* Step 4 Success */
              <>
                <button className="flex items-center gap-2 px-5 py-3 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Hỗ trợ
                </button>
                <button
                  onClick={() => { window.location.href = '/'; }}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200"
                >
                  Quay về trang chủ
                </button>
              </>
            ) : (
              <>
                {/* Secondary Action - Back / Support */}
                {step === 1 ? (
                  <button className="flex items-center gap-2 px-5 py-3 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Hỗ trợ
                  </button>
                ) : (
                  <button
                    onClick={handleBack}
                    className="flex-[0.5] py-3 px-6 rounded-xl font-medium text-[13px] text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all duration-200"
                  >
                    {paymentPhase === 'qr'
                      ? 'Huỷ'
                      : step === 2
                      ? 'Chọn lại loại vé'
                      : step === 3
                      ? 'Điền lại thông tin chung'
                      : 'Quay lại'}
                  </button>
                )}

                {/* Primary Action Button */}
                {step === 1 ? (
                  <button
                    onClick={handleNext}
                    disabled={totalQuantity === 0}
                    className="flex-1 py-3 px-6 rounded-xl font-semibold text-[13px] bg-[#0a0a0b] text-white hover:bg-black transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Điền thông tin cá nhân
                  </button>
                ) : step === 2 ? (
                  <button
                    onClick={handleNext}
                    className="flex-[2] py-3 px-6 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200"
                  >
                    Thanh toán
                  </button>
                ) : step === 3 && paymentPhase !== 'qr' ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-[2] py-3 px-6 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      'Xác nhận đơn hàng'
                    )}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Timeout Modal ────────────────────────────────────── */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#2a2a2c] w-full max-w-[420px] rounded-[24px] p-8 flex flex-col items-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Illustration Placeholder */}
            <div className="w-[140px] h-[140px] mb-2 flex items-center justify-center opacity-90">
              {/* Replace with actual SVG/Image if uploaded */}
              <span className="text-[100px] drop-shadow-lg leading-none" role="img" aria-label="timeout">⏳</span>
            </div>
            
            <h2 className="font-serif text-[42px] font-medium text-white mb-3 text-center tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              Ôi tiếc quá
            </h2>
            
            <p className="text-gray-400 text-[15px] font-medium text-center mb-10 leading-relaxed px-4">
              Thời gian giữ vé hết rồi, bạn thử làm lại từ đầu nhé!
            </p>
            
            <button
              onClick={handleRestartFlow}
              className="w-full py-4 px-6 bg-[#C0392B] hover:bg-[#A93226] text-white rounded-[14px] text-[16px] font-semibold transition-all shadow-lg active:scale-[0.98] mb-4"
            >
              Quay về hàng chờ
            </button>
            <button
             onClick={() => { window.location.href = '/'; }}
              className="w-full py-4 px-6 bg-transparent border-[1.5px] border-gray-600 hover:border-gray-500 hover:bg-white/5 text-gray-300 rounded-[14px] text-[16px] font-semibold transition-all active:scale-[0.98]"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Order Sidebar Component ─────────────────────────────────
function OrderSidebar({
  selectedTickets,
  totalQuantity,
  subtotal,
  promoDiscount,
  step,
}: {
  selectedTickets: SelectedTicket[];
  totalQuantity: number;
  subtotal: number;
  promoDiscount: number;
  step: number;
}) {
  const totalAmount = subtotal - promoDiscount;

  const isDetailed = step === 2;
  const showListAndFooter = step !== 1;

  return (
    <div className={`flex flex-col h-full rounded-xl p-6 ${step === 1 ? 'bg-[#fafafa]' : (isDetailed ? 'bg-white shadow-sm border border-gray-100/50 sm:border-gray-100' : 'bg-transparent pb-0')}`}>
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Chi tiết đơn hàng ({totalQuantity})
      </h2>

      {/* Ticket Image Placeholder */}
      <div className="relative w-full aspect-[2/1] mb-6">
        <div className="absolute inset-0 rounded-xl bg-[#ff9b9b] border-[3px] border-dashed border-[#ff4d4d]">
          {/* Ticket cutout circles */}
          <div className="absolute left-[30%] top-0 w-6 h-6 bg-white rounded-full -translate-y-1/2 -translate-x-1/2" />
          <div className="absolute left-[30%] bottom-0 w-6 h-6 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
      </div>

      {/* Event Title */}
      <h3 className="font-bold text-gray-900 text-sm mb-1">&lt;&lt;title?&gt;&gt;</h3>
      <p className="text-[11px] text-gray-500 mb-6 uppercase tracking-wider">&lt;&lt;metadata&gt;&gt;</p>

      {/* Selected Tickets List */}
      {showListAndFooter && selectedTickets.length > 0 && (
        <div className={isDetailed ? "space-y-4 mb-8" : "space-y-3 mb-8"}>
          {selectedTickets.map((t) => {
            const isVip = t.label.toLowerCase().includes('vip');

            if (isDetailed) {
              const bgColor = isVip ? 'bg-[#f0fdf4]' : 'bg-[#f4f4f5]';
              const iconBg = isVip ? 'bg-[#eab308]' : 'bg-[#9ca3af]';
              return (
                <div key={t.ticketTypeId} className={`flex flex-col rounded-xl overflow-hidden ${bgColor}`}>
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-12 h-8 rounded shrink-0 relative ${iconBg}`}>
                      {/* Ticket notch cutouts */}
                      <div className={`absolute top-1/2 -left-1.5 w-3 h-3 rounded-full -translate-y-1/2 ${bgColor}`} />
                      <div className={`absolute top-1/2 -right-1.5 w-3 h-3 rounded-full -translate-y-1/2 ${bgColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">{t.label}</div>
                      <div className="text-[11px] text-gray-500 line-clamp-1">&lt;&lt;DESCRIPTION&gt;&gt;</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <div className="font-bold text-xs text-gray-900 mb-0.5">
                        {t.price.toLocaleString('vi-VN')}đ
                      </div>
                      <div className="text-[10px] text-gray-700 flex items-center gap-1.5">
                        Số lượng: <span className="font-semibold">{String(t.quantity).padStart(2, '0')}</span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-white shrink-0 ${
                            isVip ? 'bg-[#22c55e]' : 'bg-[#9ca3af]'
                          }`}
                        >
                          {isVip ? '✓' : 'i'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expandable benefits in sidebar */}
                  <SidebarTicketBenefits label={t.label} />
                </div>
              );
            }

            return (
              <div key={t.ticketTypeId} className="flex flex-col">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex-shrink-0 ${
                      isVip ? 'bg-amber-400' : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-500">
                      {t.price.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 flex items-center gap-2">
                    Số lượng: <span className="font-semibold">{String(t.quantity).padStart(2, '0')}</span>
                    {t.quantity > 0 && (
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white ${
                          isVip ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                      >
                        {isVip ? '✓' : 'i'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!isDetailed && selectedTickets.map((t) => (
             <SidebarTicketBenefits key={`benefits-${t.ticketTypeId}`} label={t.label} simple />
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {showListAndFooter && (
      <div className="mt-auto pt-6 border-t border-gray-100 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">Tổng</span>
          <span className="text-gray-900">{subtotal.toLocaleString('vi-VN')}đ</span>
        </div>
        {promoDiscount > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Giảm giá (Voucher)</span>
            <span className="text-gray-900">-{promoDiscount.toLocaleString('vi-VN')}đ</span>
          </div>
        )}
        <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-2">
          <span className="text-base font-bold text-gray-900">Thành tiền</span>
          <span className="text-lg font-bold text-gray-900">{totalAmount.toLocaleString('vi-VN')}đ</span>
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Sidebar Ticket Benefits ─────────────────────────────────
function SidebarTicketBenefits({ label, simple }: { label: string; simple?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (simple) {
    return (
      <div className="ml-13 mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
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
          <p className="mt-1 text-xs text-gray-500 pl-4">
            Quyền lợi cho vé {label} sẽ được hiển thị tại đây.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`border-t border-black/5`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] text-gray-600 hover:text-gray-800 transition-colors"
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
        <div className="px-4 pb-3 text-[10px] text-gray-500">
          Quyền lợi cho vé {label} sẽ được hiển thị tại đây.
        </div>
      )}
    </div>
  );
}

// ─── Payment Detail Row (with optional copy) ─────────────────
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
