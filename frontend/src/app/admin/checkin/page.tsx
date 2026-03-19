'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import api from '@/lib/axios';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ScanLine,
  Keyboard,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
type ScanState = 'scanning' | 'loading' | 'success' | 'warning' | 'error';

interface CheckinResult {
  state: ScanState;
  title: string;
  subtitle: string;
  buyerName?: string;
  ticketType?: string;
  checkedInAt?: string;
}

const TICKET_TYPE_LABELS: Record<string, string> = {
  EARLY_BIRD: 'Early Bird 🎫',
  STANDARD: 'Standard 🎟️',
  VIP: 'VIP ⭐',
};

const SCANNER_ELEMENT_ID = 'qr-reader';

export default function CheckinPage() {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [manualUuid, setManualUuid] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // ══════════════════════════════════════════════════════════════
  // Process a scanned/entered UUID → call POST /api/checkin
  // ══════════════════════════════════════════════════════════════
  const processCheckin = useCallback(async (uuid: string) => {
    // Debounce guard: prevent double-fires from rapid scanning
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const trimmed = uuid.trim();
    if (!trimmed) {
      isProcessingRef.current = false;
      return;
    }

    setScanState('loading');
    setResult({ state: 'loading', title: 'Đang xác thực...', subtitle: 'Vui lòng chờ' });

    // Pause scanner immediately to prevent duplicate scans
    await stopScanner();

    try {
      const res = await api.post('/checkin', { uuid: trimmed });
      const data = res.data.data;

      const successResult: CheckinResult = {
        state: 'success',
        title: 'HỢP LỆ — MỜI VÀO ✅',
        subtitle: `Vé ${TICKET_TYPE_LABELS[data.ticketType] || data.ticketType || ''}`,
        buyerName: data.buyerName,
        ticketType: data.ticketType,
        checkedInAt: data.checkedInAt,
      };

      setScanState('success');
      setResult(successResult);
      toast.success(`Check-in thành công: ${data.buyerName}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } };
      const status = axiosErr.response?.status;
      const code = axiosErr.response?.data?.error?.code;
      const message = axiosErr.response?.data?.error?.message || 'Lỗi không xác định.';

      if (status === 409 || code === 'ALREADY_CHECKED_IN') {
        // Already checked in — WARNING state
        const warningResult: CheckinResult = {
          state: 'warning',
          title: 'CẢNH BÁO: VÉ ĐÃ SỬ DỤNG ⚠️',
          subtitle: message,
        };
        setScanState('warning');
        setResult(warningResult);
        toast.warning('Vé này đã được check-in trước đó!');
      } else {
        // Not found, inactive, expired, or other error — ERROR state
        const errorResult: CheckinResult = {
          state: 'error',
          title: 'VÉ KHÔNG HỢP LỆ ❌',
          subtitle: message,
        };
        setScanState('error');
        setResult(errorResult);
        toast.error(message);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // Scanner Lifecycle
  // ══════════════════════════════════════════════════════════════
  const startScanner = useCallback(async () => {
    setCameraError(null);

    // Wait for the DOM element to be available
    await new Promise((resolve) => setTimeout(resolve, 100));

    const el = document.getElementById(SCANNER_ELEMENT_ID);
    if (!el) {
      setCameraError('Không tìm thấy phần tử camera.');
      return;
    }

    // Clean up any existing scanner instance first
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore errors during cleanup
      }
      scannerRef.current = null;
    }

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Prefer rear camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        // Success callback — fires when a QR code is decoded
        (decodedText) => {
          processCheckin(decodedText);
        },
        // Error callback — fires on each frame without a QR code (ignore)
        () => {}
      );

      setCameraActive(true);
    } catch (err) {
      console.error('Camera start failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError('Truy cập camera bị từ chối. Vui lòng cấp quyền camera trong cài đặt trình duyệt.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('Requested device not found')) {
        setCameraError('Không tìm thấy camera. Vui lòng sử dụng nhập mã thủ công.');
      } else {
        setCameraError(`Không thể khởi động camera: ${errMsg}`);
      }

      setCameraActive(false);
      setShowManualInput(true);
    }
  }, [processCheckin]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore errors during stop
      }
      setCameraActive(false);
    }
  }, []);

  // ── Initialize camera on mount ──────────────────────────────
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (scanState === 'scanning') {
        startScanner();
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      // Cleanup: stop scanner on unmount
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════════
  // Reset: clear result, restart camera
  // ══════════════════════════════════════════════════════════════
  function handleReset() {
    setScanState('scanning');
    setResult(null);
    setManualUuid('');
    isProcessingRef.current = false;
    startScanner();
  }

  // ── Manual lookup ───────────────────────────────────────────
  async function handleManualCheckin() {
    if (!manualUuid.trim() || manualLoading) return;
    setManualLoading(true);
    await processCheckin(manualUuid.trim());
    setManualLoading(false);
  }

  function handleManualKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleManualCheckin();
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  // ── Result Screen (success / warning / error) ───────────────
  if (result && scanState !== 'scanning' && scanState !== 'loading') {
    const stateConfig = {
      success: {
        bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
        iconBg: 'bg-white/20',
        icon: <CheckCircle2 className="w-16 h-16 text-white" />,
        textColor: 'text-white',
        subtitleColor: 'text-green-100',
        buttonBg: 'bg-white text-green-700 hover:bg-green-50',
      },
      warning: {
        bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
        iconBg: 'bg-white/20',
        icon: <AlertTriangle className="w-16 h-16 text-white" />,
        textColor: 'text-white',
        subtitleColor: 'text-amber-100',
        buttonBg: 'bg-white text-amber-700 hover:bg-amber-50',
      },
      error: {
        bg: 'bg-gradient-to-br from-red-500 to-rose-600',
        iconBg: 'bg-white/20',
        icon: <XCircle className="w-16 h-16 text-white" />,
        textColor: 'text-white',
        subtitleColor: 'text-red-100',
        buttonBg: 'bg-white text-red-700 hover:bg-red-50',
      },
    };

    const config = stateConfig[scanState as keyof typeof stateConfig] || stateConfig.error;

    return (
      <div className={`min-h-screen ${config.bg} flex flex-col items-center justify-center p-6`}>
        {/* Giant Icon */}
        <div className={`w-28 h-28 ${config.iconBg} rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-300`}>
          {config.icon}
        </div>

        {/* Title */}
        <h1 className={`text-3xl sm:text-4xl font-black ${config.textColor} text-center mb-3 tracking-tight`}>
          {result.title}
        </h1>

        {/* Attendee Name (success only) */}
        {result.buyerName && (
          <p className={`text-2xl sm:text-3xl font-bold ${config.textColor} text-center mb-2`}>
            {result.buyerName}
          </p>
        )}

        {/* Subtitle / Details */}
        <p className={`text-lg ${config.subtitleColor} text-center mb-10 max-w-md leading-relaxed`}>
          {result.subtitle}
        </p>

        {/* Reset Button — MASSIVE touch target */}
        <button
          onClick={handleReset}
          className={`${config.buttonBg} px-10 py-5 rounded-2xl text-lg font-bold shadow-xl transition-all active:scale-95 flex items-center gap-3 min-w-[280px] justify-center`}
        >
          <RotateCcw className="w-6 h-6" />
          Quét vé tiếp theo
        </button>
      </div>
    );
  }

  // ── Loading overlay ─────────────────────────────────────────
  if (scanState === 'loading') {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
        <p className="text-xl font-semibold text-white">Đang xác thực vé...</p>
        <p className="text-sm text-gray-400 mt-2">Vui lòng chờ</p>
      </div>
    );
  }

  // ── Main Scanner View ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1a1a2e] rounded-xl flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Check-in</h1>
            <p className="text-xs text-gray-400">Quét mã QR để check-in</p>
          </div>
        </div>
        <button
          onClick={() => setShowManualInput((v) => !v)}
          className={`p-2.5 rounded-xl transition-colors ${
            showManualInput
              ? 'bg-[#1a1a2e] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Nhập mã thủ công"
        >
          <Keyboard className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-5">
        {/* Scanner Container */}
        <div className="w-full max-w-sm mx-auto">
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
            {/* The html5-qrcode renders into this div */}
            <div
              id={SCANNER_ELEMENT_ID}
              className="w-full aspect-square"
              style={{ minHeight: '300px' }}
            />

            {/* Scanning overlay indicator */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[250px] h-[250px] border-2 border-white/30 rounded-xl relative">
                  {/* Corner accents */}
                  <div className="absolute -top-[2px] -left-[2px] w-8 h-8 border-t-[3px] border-l-[3px] border-green-400 rounded-tl-lg" />
                  <div className="absolute -top-[2px] -right-[2px] w-8 h-8 border-t-[3px] border-r-[3px] border-green-400 rounded-tr-lg" />
                  <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 border-b-[3px] border-l-[3px] border-green-400 rounded-bl-lg" />
                  <div className="absolute -bottom-[2px] -right-[2px] w-8 h-8 border-b-[3px] border-r-[3px] border-green-400 rounded-br-lg" />
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Camera error overlay */}
            {cameraError && (
              <div className="absolute inset-0 bg-[#1a1a2e] flex flex-col items-center justify-center p-6 text-center">
                <CameraOff className="w-12 h-12 text-gray-500 mb-4" />
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">{cameraError}</p>
                <button
                  onClick={() => {
                    setCameraError(null);
                    startScanner();
                  }}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Thử lại
                </button>
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="mt-4 text-center">
            {cameraActive ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Camera đang hoạt động — Đưa mã QR vào khung hình
              </div>
            ) : !cameraError ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span className="w-2 h-2 bg-gray-400 rounded-full" />
                Camera chưa khởi động
              </div>
            ) : null}
          </div>
        </div>

        {/* Manual Input Fallback */}
        {showManualInput && (
          <div className="w-full max-w-sm mx-auto bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nhập mã vé thủ công
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualUuid}
                onChange={(e) => setManualUuid(e.target.value)}
                onKeyDown={handleManualKeyDown}
                placeholder="Nhập UUID hoặc dán mã vé..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e]"
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleManualCheckin}
              disabled={manualLoading || !manualUuid.trim()}
              className="mt-3 w-full py-3 bg-[#1a1a2e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a2a4e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {manualLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Tra cứu & Check-in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
