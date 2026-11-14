import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  UserPlus,
} from 'lucide-react';
import { STORE_CONFIG } from '../config/storeConfig';
import {
  cancelCouponByStaff,
  CouponActionError,
  fetchPortalDashboardData,
  fetchStaffMembers,
  fetchStaffSession,
  formatKoreanDate,
  formatKoreanDateTime,
  getEffectiveCouponStatus,
  lookupCouponForStaff,
  normalizeCouponCode,
  redeemCouponByStaff,
  saveStaffMember,
  setStaffToken,
  staffLogin,
  updateStaffMember,
  type AnalyticsMetrics,
  type CouponEventRecord,
  type CouponRecord,
  type CouponStatus,
  type StaffMemberRecord,
  type StaffProfile,
  type StaffRole,
} from '../lib/coupons';

interface StaffPortalProps {
  onNavigateCustomer: () => void;
}

type PortalTab = 'scanner' | 'history' | 'staff';

const SCANNER_REGION_ID = 'iconcafe-barcode-scanner';

export function StaffPortal({ onNavigateCustomer }: StaffPortalProps) {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Portal tabs
  const [activeTab, setActiveTab] = useState<PortalTab>('scanner');

  // Scanner & verification state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [verifiedCoupon, setVerifiedCoupon] = useState<CouponRecord | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    showRequery?: boolean;
  } | null>(null);

  // Cancellation state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // History & analytics state
  const [couponsList, setCouponsList] = useState<CouponRecord[]>([]);
  const [eventsList, setEventsList] = useState<CouponEventRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsMetrics>({
    pageViews: 0,
    couponClicks: 0,
    menuViews: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CouponStatus>('all');

  // Admin staff directory state
  const [staffMembers, setStaffMembers] = useState<StaffMemberRecord[]>([]);
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('staff');
  const [newStaffPasscode, setNewStaffPasscode] = useState('');
  const [staffAdminMsg, setStaffAdminMsg] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current;
    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        await instance.clear();
      } catch {
        // Ignore cleanup failure
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    fetchStaffSession()
      .then((profile) => {
        setStaff(profile);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const loadDashboardData = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchPortalDashboardData();
      setCouponsList(data.coupons);
      setEventsList(data.events);
      setAnalytics(data.analytics);
    } catch (err) {
      if (err instanceof CouponActionError && err.code === 'UNAUTHORIZED') {
        setStaff(null);
        setStaffToken(null);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadStaffMembers = useCallback(async () => {
    if (staff?.role !== 'admin') return;
    try {
      const list = await fetchStaffMembers();
      setStaffMembers(list);
    } catch {
      // Non-admin or transient error
    }
  }, [staff?.role]);

  useEffect(() => {
    if (!staff) return;
    loadDashboardData();
    if (staff.role === 'admin') {
      loadStaffMembers();
    }
  }, [staff, loadDashboardData, loadStaffMembers]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const { staff: profile } = await staffLogin(loginId, loginPasscode);
      setStaff(profile);
      setLoginPasscode('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await stopCamera();
    setStaffToken(null);
    setStaff(null);
    setVerifiedCoupon(null);
    setFeedback(null);
  };

  const verifyCode = useCallback(async (rawCode: string) => {
    const normalized = normalizeCouponCode(rawCode);
    setManualCode(normalized);
    setFeedback(null);
    setCancelOpen(false);
    setCancelReason('');
    setLookupLoading(true);

    try {
      const coupon = await lookupCouponForStaff(normalized);
      setVerifiedCoupon(coupon);
      const effectiveStatus = getEffectiveCouponStatus(coupon);
      if (effectiveStatus === 'redeemed') {
        setFeedback({ type: 'error', message: '이미 사용된 쿠폰입니다.' });
      } else if (effectiveStatus === 'expired') {
        setFeedback({ type: 'error', message: '쿠폰 유효기간이 만료되었습니다.' });
      } else if (effectiveStatus === 'cancelled') {
        setFeedback({ type: 'error', message: '취소된 쿠폰입니다.' });
      }
    } catch (err) {
      setVerifiedCoupon(null);
      if (err instanceof CouponActionError) {
        if (err.code === 'UNAUTHORIZED') {
          setStaff(null);
          setStaffToken(null);
          return;
        }
        setFeedback({
          type: err.code === 'NETWORK' ? 'warning' : 'error',
          message: err.message,
          showRequery: err.code === 'NETWORK',
        });
      } else {
        setFeedback({ type: 'error', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      }
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    await stopCamera();
    setCameraActive(true);

    window.setTimeout(async () => {
      const container = document.getElementById(SCANNER_REGION_ID);
      if (!container) return;

      try {
        const html5Qr = new Html5Qrcode(SCANNER_REGION_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 120 } },
          async (decodedText) => {
            await stopCamera();
            await verifyCode(decodedText);
          },
          () => {
            // Ignore per-frame decode misses
          }
        );
      } catch {
        setCameraActive(false);
        scannerRef.current = null;
        setCameraError(
          '카메라 권한이 거부되었거나 카메라 장치를 시작할 수 없습니다. 아래 쿠폰 번호 직접 입력 기능을 이용해 주세요.'
        );
      }
    }, 50);
  };

  const handleManualLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await verifyCode(manualCode);
  };

  const handleConfirmRedeem = async () => {
    if (!verifiedCoupon || actionLoading) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const redeemed = await redeemCouponByStaff(verifiedCoupon.id);
      setVerifiedCoupon(redeemed);
      setFeedback({ type: 'success', message: '쿠폰 사용 처리가 정상적으로 완료되었습니다.' });
      loadDashboardData();
    } catch (err) {
      if (err instanceof CouponActionError) {
        if (err.code === 'UNAUTHORIZED') {
          setStaff(null);
          setStaffToken(null);
          return;
        }
        if (err.coupon) {
          setVerifiedCoupon(err.coupon);
        }
        setFeedback({
          type: err.code === 'NETWORK' ? 'warning' : 'error',
          message: err.message,
          showRequery: err.code === 'NETWORK',
        });
      } else {
        setFeedback({
          type: 'warning',
          message: '처리 결과를 확정하지 못했습니다. 반드시 쿠폰 상태를 다시 조회해 주세요.',
          showRequery: true,
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!verifiedCoupon || actionLoading) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const cancelled = await cancelCouponByStaff(verifiedCoupon.id, cancelReason);
      setVerifiedCoupon(cancelled);
      setCancelOpen(false);
      setCancelReason('');
      setFeedback({ type: 'success', message: '쿠폰이 취소 처리되었습니다.' });
      loadDashboardData();
    } catch (err) {
      if (err instanceof CouponActionError) {
        if (err.coupon) setVerifiedCoupon(err.coupon);
        setFeedback({ type: 'error', message: err.message });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveStaff = async (e: FormEvent) => {
    e.preventDefault();
    setStaffAdminMsg(null);
    try {
      await saveStaffMember({
        id: newStaffId,
        displayName: newStaffName,
        role: newStaffRole,
        passcode: newStaffPasscode,
        active: true,
      });
      setNewStaffId('');
      setNewStaffName('');
      setNewStaffPasscode('');
      setStaffAdminMsg('직원 계정이 저장되었습니다.');
      await loadStaffMembers();
    } catch (err) {
      setStaffAdminMsg(err instanceof Error ? err.message : '직원 등록에 실패했습니다.');
    }
  };

  const handleToggleStaffActive = async (member: StaffMemberRecord) => {
    setStaffAdminMsg(null);
    try {
      await updateStaffMember(member.id, { active: !member.active });
      await loadStaffMembers();
    } catch (err) {
      setStaffAdminMsg(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    }
  };

  const renderStatusLabel = (status: CouponStatus) => {
    if (status === 'issued') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4A6B57]">
          <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
          <span>발급됨</span>
        </span>
      );
    }
    if (status === 'redeemed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E2A22]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#4A6B57]" aria-hidden="true" />
          <span>사용 완료</span>
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B95519]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>만료됨</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#991B1B]">
        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
        <span>취소됨</span>
      </span>
    );
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] px-4 text-sm text-[#55645A]">
        직원 인증 상태를 확인하고 있습니다...
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-[#FAF8F3] px-4 py-8 text-[#1E2A22]">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={onNavigateCustomer}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#55645A] hover:text-[#1E2A22]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>고객 페이지로 돌아가기</span>
          </button>

          <div className="mt-6 rounded-2xl border border-[#1E2A22]/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4A6B57]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>매장 직원 전용</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold text-[#1E2A22]">
              {STORE_CONFIG.brandName} 쿠폰 관리 로그인
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#55645A]">
              고객 바코드 스캔 및 1회용 쿠폰 사용 처리를 위해 직원 계정으로 로그인해 주세요.
            </p>

            {loginError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#991B1B]/20 bg-[#991B1B]/5 p-3 text-sm text-[#991B1B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="staff-id" className="block text-xs font-medium text-[#1E2A22]">
                  직원 아이디
                </label>
                <input
                  id="staff-id"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="아이디 입력"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3.5 text-sm text-[#1E2A22] outline-none focus:border-[#4A6B57] focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="staff-passcode" className="block text-xs font-medium text-[#1E2A22]">
                  비밀번호
                </label>
                <input
                  id="staff-passcode"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPasscode}
                  onChange={(e) => setLoginPasscode(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3.5 text-sm text-[#1E2A22] outline-none focus:border-[#4A6B57] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="min-h-[48px] w-full rounded-xl bg-[#4A6B57] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#365242] disabled:opacity-60"
              >
                {loginLoading ? '로그인 확인 중...' : '직원 로그인'}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#55645A]">
          {STORE_CONFIG.brandName} · 직원 전용 검증 시스템
        </p>
      </div>
    );
  }

  const totalCoupons = couponsList.length;
  const redeemedCount = couponsList.filter((c) => getEffectiveCouponStatus(c) === 'redeemed').length;
  const issuedActiveCount = couponsList.filter((c) => getEffectiveCouponStatus(c) === 'issued').length;
  const conversionRate = totalCoupons > 0 ? Math.round((redeemedCount / totalCoupons) * 100) : 0;

  const filteredCoupons = couponsList.filter((c) => {
    const effective = getEffectiveCouponStatus(c);
    const matchesStatus = statusFilter === 'all' || effective === statusFilter;
    const term = normalizeCouponCode(searchTerm);
    const matchesSearch = !term || c.id.includes(term);
    return matchesStatus && matchesSearch;
  });

  const verifiedEffectiveStatus = verifiedCoupon ? getEffectiveCouponStatus(verifiedCoupon) : null;

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1E2A22]">
      <header className="sticky top-0 z-30 border-b border-[#1E2A22]/10 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateCustomer}
              aria-label="고객 페이지로 이동"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#1E2A22]/10 text-[#55645A] hover:bg-[#FAF8F3] hover:text-[#1E2A22]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-[#1E2A22]">
                {STORE_CONFIG.brandName} 쿠폰 관리
              </p>
              <p className="truncate text-xs text-[#55645A]">
                {staff.displayName} · {staff.role === 'admin' ? '관리자' : '매장 직원'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#1E2A22]/15 px-3 py-1.5 text-xs font-medium text-[#1E2A22] hover:bg-[#FAF8F3] whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Portal Navigation Tabs */}
        <div
          role="tablist"
          aria-label="관리자 기능 메뉴"
          className="flex flex-wrap gap-1.5 rounded-xl border border-[#1E2A22]/10 bg-white p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scanner'}
            onClick={() => setActiveTab('scanner')}
            className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
              activeTab === 'scanner'
                ? 'bg-[#4A6B57] text-white'
                : 'text-[#55645A] hover:bg-[#FAF8F3] hover:text-[#1E2A22]'
            }`}
          >
            바코드 스캔 · 사용 처리
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => {
              stopCamera();
              setActiveTab('history');
              loadDashboardData();
            }}
            className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
              activeTab === 'history'
                ? 'bg-[#4A6B57] text-white'
                : 'text-[#55645A] hover:bg-[#FAF8F3] hover:text-[#1E2A22]'
            }`}
          >
            발급 · 사용 내역
          </button>
          {staff.role === 'admin' && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'staff'}
              onClick={() => {
                stopCamera();
                setActiveTab('staff');
              }}
              className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
                activeTab === 'staff'
                  ? 'bg-[#4A6B57] text-white'
                  : 'text-[#55645A] hover:bg-[#FAF8F3] hover:text-[#1E2A22]'
              }`}
            >
              직원 계정 · 운영 안내
            </button>
          )}
        </div>

        {/* Tab 1: Scanner & Verification */}
        {activeTab === 'scanner' && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left column: Camera & Manual Code Input */}
            <div className="space-y-5 lg:col-span-6">
              <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#1E2A22]">카메라 바코드 스캔</h2>
                    <p className="mt-0.5 text-xs text-[#55645A]">
                      고객 휴대폰 화면의 CODE 128 바코드를 비춰주세요.
                    </p>
                  </div>

                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#4A6B57] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#365242] whitespace-nowrap shrink-0"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span>카메라 켜기</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#1E2A22]/20 bg-[#FAF8F3] px-3.5 py-2 text-xs font-semibold text-[#1E2A22] hover:bg-[#EEF2EC] whitespace-nowrap shrink-0"
                    >
                      <CameraOff className="h-4 w-4" aria-hidden="true" />
                      <span>카메라 중지</span>
                    </button>
                  )}
                </div>

                {cameraError && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#B95519]/25 bg-[#D96B27]/10 p-3 text-xs leading-relaxed text-[#1E2A22]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B95519]" aria-hidden="true" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="mt-4 overflow-hidden rounded-xl border border-[#1E2A22]/10 bg-[#FAF8F3]">
                  {cameraActive ? (
                    <div id={SCANNER_REGION_ID} className="min-h-[240px] w-full" />
                  ) : (
                    <div className="flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center">
                      <Camera className="h-7 w-7 text-[#55645A]" aria-hidden="true" />
                      <p className="mt-2 text-xs text-[#55645A]">
                        카메라 켜기 버튼을 누르면 바코드 스캐너가 활성화됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5">
                <h2 className="text-base font-semibold text-[#1E2A22]">쿠폰 코드 직접 입력</h2>
                <p className="mt-0.5 text-xs text-[#55645A]">
                  카메라 스캔이 어렵거나 권한이 없는 경우 바코드 아래 코드를 직접 입력하세요.
                </p>

                <form onSubmit={handleManualLookup} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="예: ICON-XXXXX-XXXXX"
                    aria-label="쿠폰 코드 입력"
                    className="min-h-[46px] flex-1 rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3.5 font-mono text-sm uppercase tracking-wider text-[#1E2A22] outline-none focus:border-[#4A6B57] focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading || !manualCode.trim()}
                    className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-[#1E2A22] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#365242] disabled:opacity-50 whitespace-nowrap"
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <span>{lookupLoading ? '조회 중...' : '쿠폰 조회'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right column: Coupon Verification & Atomic Redeem */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5 sm:p-6">
                <h2 className="text-base font-semibold text-[#1E2A22]">쿠폰 검증 및 사용 처리</h2>

                {feedback && (
                  <div
                    role="alert"
                    className={`mt-4 flex flex-col gap-2 rounded-xl border p-4 text-sm ${
                      feedback.type === 'success'
                        ? 'border-[#4A6B57]/30 bg-[#EEF2EC] text-[#1E2A22]'
                        : feedback.type === 'warning'
                          ? 'border-[#D96B27]/35 bg-[#D96B27]/10 text-[#1E2A22]'
                          : 'border-[#991B1B]/25 bg-[#991B1B]/5 text-[#991B1B]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {feedback.type === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4A6B57]" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="font-medium">{feedback.message}</span>
                    </div>
                    {feedback.showRequery && manualCode && (
                      <button
                        type="button"
                        onClick={() => verifyCode(manualCode)}
                        className="inline-flex items-center gap-1 self-start text-xs font-semibold underline"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>서버 상태 다시 확인하기</span>
                      </button>
                    )}
                  </div>
                )}

                {!verifiedCoupon ? (
                  <div className="mt-6 rounded-xl border border-dashed border-[#1E2A22]/15 bg-[#FAF8F3] px-5 py-12 text-center">
                    <Ticket className="mx-auto h-7 w-7 text-[#55645A]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-[#1E2A22]">조회된 쿠폰이 없습니다</p>
                    <p className="mt-1 text-xs text-[#55645A]">
                      바코드를 스캔하거나 쿠폰 코드를 입력하면 혜택과 사용 가능 여부가 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-xl border border-[#1E2A22]/10 bg-[#FAF8F3] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-semibold tracking-wider text-[#1E2A22] tabular-nums">
                          {verifiedCoupon.id}
                        </span>
                        {renderStatusLabel(verifiedEffectiveStatus!)}
                      </div>

                      <dl className="mt-4 space-y-2.5 border-t border-[#1E2A22]/10 pt-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-xs text-[#55645A]">혜택</dt>
                          <dd className="font-semibold text-[#1E2A22]">{verifiedCoupon.benefitLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-xs text-[#55645A]">사용 조건</dt>
                          <dd className="text-right text-xs text-[#1E2A22]">{STORE_CONFIG.promotion.condition}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-xs text-[#55645A]">고객 선호 옵션</dt>
                          <dd className="text-xs font-medium text-[#1E2A22]">
                            {verifiedCoupon.selectedOption === 'UNDECIDED'
                              ? '매장에서 선택'
                              : verifiedCoupon.selectedOption}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-xs text-[#55645A]">발급 일시</dt>
                          <dd className="text-xs text-[#1E2A22] tabular-nums">
                            {formatKoreanDateTime(verifiedCoupon.issuedAt)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-xs text-[#55645A]">유효기간</dt>
                          <dd className="text-xs text-[#1E2A22] tabular-nums">
                            {formatKoreanDate(verifiedCoupon.expiresAt)} 까지
                          </dd>
                        </div>
                        {verifiedCoupon.redeemedAt && (
                          <div className="flex justify-between gap-4 border-t border-[#1E2A22]/10 pt-2">
                            <dt className="text-xs text-[#55645A]">사용 처리</dt>
                            <dd className="text-right text-xs font-medium text-[#1E2A22] tabular-nums">
                              {formatKoreanDateTime(verifiedCoupon.redeemedAt)} ({verifiedCoupon.redeemedByName})
                            </dd>
                          </div>
                        )}
                        {verifiedCoupon.cancelledAt && (
                          <div className="flex justify-between gap-4 border-t border-[#1E2A22]/10 pt-2 text-[#991B1B]">
                            <dt className="text-xs">취소 정보</dt>
                            <dd className="text-right text-xs">
                              {formatKoreanDateTime(verifiedCoupon.cancelledAt)} · {verifiedCoupon.cancelledReason}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {verifiedEffectiveStatus === 'issued' && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleConfirmRedeem}
                          disabled={actionLoading}
                          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#4A6B57] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#365242] disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>{actionLoading ? '사용 처리 중...' : '쿠폰 사용 처리 확정'}</span>
                        </button>

                        {!cancelOpen ? (
                          <button
                            type="button"
                            onClick={() => setCancelOpen(true)}
                            className="w-full py-2 text-center text-xs font-medium text-[#55645A] hover:text-[#991B1B]"
                          >
                            정책상 쿠폰 취소 처리가 필요한 경우
                          </button>
                        ) : (
                          <form
                            onSubmit={handleConfirmCancel}
                            className="space-y-2.5 rounded-xl border border-[#991B1B]/20 bg-[#FAF8F3] p-3.5"
                          >
                            <label htmlFor="cancel-reason" className="block text-xs font-medium text-[#1E2A22]">
                              취소 사유 입력 (필수)
                            </label>
                            <input
                              id="cancel-reason"
                              type="text"
                              required
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="예: 고객 요청 또는 오발급 취소"
                              className="min-h-[40px] w-full rounded-lg border border-[#1E2A22]/15 bg-white px-3 text-xs text-[#1E2A22] outline-none focus:border-[#991B1B]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setCancelOpen(false)}
                                className="min-h-[36px] flex-1 rounded-lg border border-[#1E2A22]/15 bg-white text-xs font-medium text-[#55645A]"
                              >
                                닫기
                              </button>
                              <button
                                type="submit"
                                disabled={actionLoading || !cancelReason.trim()}
                                className="min-h-[36px] flex-1 rounded-lg bg-[#991B1B] text-xs font-semibold text-white disabled:opacity-50"
                              >
                                쿠폰 취소 확정
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: History & Analytics (P1) */}
        {activeTab === 'history' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-4">
                <p className="text-xs text-[#55645A]">총 발급 쿠폰</p>
                <p className="mt-1 text-2xl font-semibold text-[#1E2A22] tabular-nums">{totalCoupons}</p>
              </div>
              <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-4">
                <p className="text-xs text-[#55645A]">사용 완료</p>
                <p className="mt-1 text-2xl font-semibold text-[#4A6B57] tabular-nums">{redeemedCount}</p>
              </div>
              <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-4">
                <p className="text-xs text-[#55645A]">사용 가능</p>
                <p className="mt-1 text-2xl font-semibold text-[#D96B27] tabular-nums">{issuedActiveCount}</p>
              </div>
              <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-4">
                <p className="text-xs text-[#55645A]">사용 전환율</p>
                <p className="mt-1 text-2xl font-semibold text-[#1E2A22] tabular-nums">{conversionRate}%</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#1E2A22]/10 bg-[#EEF2EC] px-4 py-3 text-xs text-[#55645A]">
              <span className="font-semibold text-[#1E2A22]">프로모션 참여 지표</span>
              <span className="tabular-nums">페이지 방문 {analytics.pageViews}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">쿠폰 버튼 클릭 {analytics.couponClicks}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">기본 메뉴 조회 {analytics.menuViews}</span>
            </div>

            <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: 'all', label: '전체' },
                      { key: 'issued', label: '발급됨' },
                      { key: 'redeemed', label: '사용 완료' },
                      { key: 'expired', label: '만료됨' },
                      { key: 'cancelled', label: '취소됨' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setStatusFilter(f.key)}
                      className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        statusFilter === f.key
                          ? 'bg-[#1E2A22] text-white'
                          : 'bg-[#FAF8F3] text-[#55645A] hover:text-[#1E2A22]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="쿠폰 코드 검색"
                    aria-label="쿠폰 코드 검색"
                    className="min-h-[38px] w-full rounded-lg border border-[#1E2A22]/15 bg-[#FAF8F3] px-3 font-mono text-xs uppercase text-[#1E2A22] outline-none focus:border-[#4A6B57] sm:w-48"
                  />
                  <button
                    type="button"
                    onClick={loadDashboardData}
                    aria-label="목록 새로고침"
                    className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-[#1E2A22]/15 text-[#55645A] hover:bg-[#FAF8F3]"
                  >
                    <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {filteredCoupons.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#55645A]">
                  조건에 맞는 쿠폰 내역이 없습니다.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1E2A22]/10 text-xs font-medium text-[#55645A]">
                        <th className="py-3 pr-4">쿠폰 코드</th>
                        <th className="py-3 pr-4">상태</th>
                        <th className="py-3 pr-4">선호 옵션</th>
                        <th className="py-3 pr-4">발급 일시</th>
                        <th className="py-3 pr-4">사용/처리 정보</th>
                        <th className="py-3 text-right">확인</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2A22]/10">
                      {filteredCoupons.map((item) => {
                        const eff = getEffectiveCouponStatus(item);
                        return (
                          <tr key={item.id} className="hover:bg-[#FAF8F3]">
                            <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#1E2A22] tabular-nums">
                              {item.id}
                            </td>
                            <td className="py-3 pr-4">{renderStatusLabel(eff)}</td>
                            <td className="py-3 pr-4 text-xs text-[#55645A]">
                              {item.selectedOption === 'UNDECIDED' ? '매장 선택' : item.selectedOption}
                            </td>
                            <td className="py-3 pr-4 text-xs text-[#55645A] tabular-nums">
                              {formatKoreanDateTime(item.issuedAt)}
                            </td>
                            <td className="py-3 pr-4 text-xs text-[#55645A] tabular-nums">
                              {item.redeemedAt
                                ? `${formatKoreanDateTime(item.redeemedAt)} (${item.redeemedByName})`
                                : item.cancelledAt
                                  ? `취소: ${item.cancelledReason}`
                                  : `만료일: ${formatKoreanDate(item.expiresAt)}`}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('scanner');
                                  verifyCode(item.id);
                                }}
                                className="text-xs font-semibold text-[#4A6B57] hover:underline"
                              >
                                상세 조회
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {eventsList.length > 0 && (
              <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1E2A22]">최근 처리 이력</h3>
                <ul className="mt-3 divide-y divide-[#1E2A22]/10 text-xs">
                  {eventsList.slice(0, 15).map((ev) => (
                    <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-semibold text-[#1E2A22]">{ev.couponId}</span>
                        <span className="text-[#55645A]">{ev.actorName}</span>
                        {ev.note && <span className="text-[#55645A]">· {ev.note}</span>}
                      </div>
                      <span className="text-[#55645A] tabular-nums">{formatKoreanDateTime(ev.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Staff Management & Store Readiness (Admin only) */}
        {activeTab === 'staff' && staff.role === 'admin' && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5 lg:col-span-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#4A6B57]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[#1E2A22]">직원 계정 등록 · 수정</h2>
              </div>

              {staffAdminMsg && (
                <p className="mt-3 rounded-lg bg-[#EEF2EC] px-3 py-2 text-xs font-medium text-[#1E2A22]">
                  {staffAdminMsg}
                </p>
              )}

              <form onSubmit={handleSaveStaff} className="mt-4 space-y-3.5">
                <div>
                  <label htmlFor="new-staff-id" className="block text-xs font-medium text-[#1E2A22]">
                    직원 아이디
                  </label>
                  <input
                    id="new-staff-id"
                    type="text"
                    required
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    placeholder="영문/숫자 (예: staff02)"
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3 text-sm outline-none focus:border-[#4A6B57] focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="new-staff-name" className="block text-xs font-medium text-[#1E2A22]">
                    표시 이름
                  </label>
                  <input
                    id="new-staff-name"
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="예: 김민지 바리스타"
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3 text-sm outline-none focus:border-[#4A6B57] focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="new-staff-role" className="block text-xs font-medium text-[#1E2A22]">
                      권한
                    </label>
                    <select
                      id="new-staff-role"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3 text-sm outline-none focus:border-[#4A6B57] focus:bg-white"
                    >
                      <option value="staff">매장 직원</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="new-staff-pass" className="block text-xs font-medium text-[#1E2A22]">
                      비밀번호
                    </label>
                    <input
                      id="new-staff-pass"
                      type="password"
                      required
                      minLength={4}
                      value={newStaffPasscode}
                      onChange={(e) => setNewStaffPasscode(e.target.value)}
                      placeholder="4자 이상"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-[#1E2A22]/15 bg-[#FAF8F3] px-3 text-sm outline-none focus:border-[#4A6B57] focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] w-full rounded-xl bg-[#4A6B57] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365242]"
                >
                  직원 계정 저장
                </button>
              </form>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border border-[#1E2A22]/10 bg-white p-5">
                <h2 className="text-base font-semibold text-[#1E2A22]">등록된 직원 계정</h2>
                <div className="mt-4 divide-y divide-[#1E2A22]/10">
                  {staffMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1E2A22]">
                          {member.displayName}{' '}
                          <span className="font-mono text-xs font-normal text-[#55645A]">({member.id})</span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#55645A]">
                          {member.role === 'admin' ? '관리자' : '매장 직원'} ·{' '}
                          {member.active ? '활성 상태' : '비활성화됨'}
                        </p>
                      </div>

                      {member.id !== staff.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleStaffActive(member)}
                          className={`min-h-[34px] rounded-lg border px-3 py-1 text-xs font-medium ${
                            member.active
                              ? 'border-[#1E2A22]/15 text-[#55645A] hover:text-[#991B1B]'
                              : 'border-[#4A6B57] text-[#4A6B57]'
                          }`}
                        >
                          {member.active ? '비활성화' : '다시 활성화'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#1E2A22]/10 bg-[#EEF2EC] p-5">
                <h3 className="text-sm font-semibold text-[#1E2A22]">매장 확인 후 확정 필요 항목</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#55645A]">
                  아래 항목은 현재 설정 파일(storeConfig)에서 미확정 상태로 안전하게 분리되어 있으며, 실제 정보 전달 후 바로 반영할 수 있습니다.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-[#1E2A22]">
                  <li>• 상세 도로명·호수, 영업시간, 연락처 및 주차 안내</li>
                  <li>• 신메뉴 당근케이크 및 기본 메뉴 8종의 실제 판매가</li>
                  <li>• 아메리카노 무료 쿠폰 최종 유효기간 및 사이즈·중복할인 기준</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
