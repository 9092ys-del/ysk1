import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, X, AlertCircle } from 'lucide-react';
import { STORE_CONFIG } from '../config/storeConfig';
import {
  fetchCustomerCoupon,
  formatKoreanDate,
  formatKoreanDateTime,
  getEffectiveCouponStatus,
  issueCustomerCoupon,
  type BeverageOption,
  type CouponRecord,
} from '../lib/coupons';
import { BarcodeCanvas } from './BarcodeCanvas';

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupon: CouponRecord | null;
  onCouponChange: (coupon: CouponRecord) => void;
}

export function CouponModal({ isOpen, onClose, coupon, onCouponChange }: CouponModalProps) {
  const [selectedOption, setSelectedOption] = useState<BeverageOption>('ICE');
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !coupon) return;
    let active = true;

    const refresh = async () => {
      try {
        const latest = await fetchCustomerCoupon(coupon.id);
        if (active && latest) {
          onCouponChange(latest);
        }
      } catch {
        // Keep current view on transient poll error
      }
    };

    refresh();

    if (getEffectiveCouponStatus(coupon) === 'issued') {
      const interval = window.setInterval(refresh, 5000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }

    return () => {
      active = false;
    };
  }, [isOpen, coupon?.id, coupon?.status]);

  if (!isOpen) return null;

  const effectiveStatus = coupon ? getEffectiveCouponStatus(coupon) : null;

  const handleIssue = async () => {
    setErrorMessage(null);
    setIsIssuing(true);
    try {
      const created = await issueCustomerCoupon(selectedOption);
      onCouponChange(created);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '쿠폰 발급 중 오류가 발생했습니다.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!coupon) return;
    setErrorMessage(null);
    setIsRefreshing(true);
    try {
      const latest = await fetchCustomerCoupon(coupon.id);
      if (latest) {
        onCouponChange(latest);
      } else {
        setErrorMessage('서버에서 쿠폰 정보를 확인할 수 없습니다.');
      }
    } catch {
      setErrorMessage('네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2A22]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coupon-modal-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#FAF8F3] p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#1E2A22]/10 pb-4">
          <div>
            <p className="text-xs font-medium text-[#D96B27]">아이콘카페 신메뉴 혜택</p>
            <h2 id="coupon-modal-title" className="mt-1 text-xl font-semibold text-[#1E2A22]">
              {coupon ? '나의 신메뉴 쿠폰' : '신메뉴 쿠폰 발급'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="쿠폰 창 닫기"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#55645A] transition-colors hover:bg-[#1E2A22]/5 hover:text-[#1E2A22]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#B95519]/25 bg-[#D96B27]/10 p-3.5 text-sm text-[#1E2A22]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B95519]" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!coupon ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-[#1E2A22]/10 bg-[#EEF2EC] p-4">
              <p className="text-sm font-semibold text-[#1E2A22]">{STORE_CONFIG.promotion.benefitLabel}</p>
              <p className="mt-1 text-sm text-[#55645A] leading-relaxed">
                {STORE_CONFIG.promotion.targetAudience}이 {STORE_CONFIG.promotion.condition} 제공되는 전용 바코드 쿠폰입니다.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-[#1E2A22]">원하시는 아메리카노 온도 (참고용)</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'ICE', label: 'ICE' },
                    { value: 'HOT', label: 'HOT' },
                    { value: 'UNDECIDED', label: '매장 선택' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedOption(opt.value)}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedOption === opt.value
                        ? 'border-[#4A6B57] bg-[#4A6B57] text-white'
                        : 'border-[#1E2A22]/15 bg-white text-[#1E2A22] hover:bg-[#F3F0E8]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#55645A]">{STORE_CONFIG.promotion.americanoOptionNote}</p>
            </div>

            <div className="space-y-1.5 border-t border-[#1E2A22]/10 pt-4 text-xs text-[#55645A]">
              <p>• {STORE_CONFIG.promotion.validityNote}</p>
              <p>• {STORE_CONFIG.promotion.stackingNote}</p>
              <p>• 매장 직원이 바코드를 확인·사용 처리한 뒤에는 재사용할 수 없습니다.</p>
            </div>

            <button
              type="button"
              onClick={handleIssue}
              disabled={isIssuing}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#4A6B57] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#365242] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{isIssuing ? '고유 쿠폰 생성 중...' : '바코드 쿠폰 발급받기'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <BarcodeCanvas value={coupon.id} status={effectiveStatus!} />

            <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#55645A]">혜택</span>
                <span className="text-sm font-semibold text-[#1E2A22]">{coupon.benefitLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#55645A]">사용 조건</span>
                <span className="text-right text-sm text-[#1E2A22]">{STORE_CONFIG.promotion.condition}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#55645A]">선호 옵션</span>
                <span className="text-sm text-[#1E2A22]">
                  {coupon.selectedOption === 'UNDECIDED' ? '매장에서 선택' : coupon.selectedOption}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[#1E2A22]/10 pt-3">
                <span className="text-xs font-medium text-[#55645A]">발급일</span>
                <span className="text-sm text-[#1E2A22] tabular-nums">{formatKoreanDate(coupon.issuedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#55645A]">유효기간</span>
                <span className="text-sm font-medium text-[#D96B27] tabular-nums">
                  {formatKoreanDate(coupon.expiresAt)} 까지
                </span>
              </div>
              {effectiveStatus === 'redeemed' && coupon.redeemedAt && (
                <div className="flex items-center justify-between gap-2 border-t border-[#1E2A22]/10 pt-3 text-[#4A6B57]">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    사용 완료 일시
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatKoreanDateTime(coupon.redeemedAt)}</span>
                </div>
              )}
              {effectiveStatus === 'cancelled' && coupon.cancelledReason && (
                <div className="border-t border-[#1E2A22]/10 pt-3 text-xs text-[#991B1B]">
                  취소 사유: {coupon.cancelledReason}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E2A22]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#1E2A22] transition-colors hover:bg-[#F3F0E8] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>상태 확인</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] flex-1 rounded-xl bg-[#4A6B57] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#365242]"
              >
                확인
              </button>
            </div>

            <p className="text-center text-xs text-[#55645A]">
              매장 결제 시 직원에게 위 바코드를 제시해 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
