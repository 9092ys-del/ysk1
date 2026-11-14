import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Ban, CheckCircle2, Clock, Ticket } from 'lucide-react';
import type { CouponStatus } from '../lib/coupons';

interface BarcodeCanvasProps {
  value: string;
  status: CouponStatus;
}

export function BarcodeCanvas({ value, status }: BarcodeCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        lineColor: '#111827',
        background: '#FFFFFF',
        width: 2.1,
        height: 76,
        displayValue: false,
        margin: 12,
      });
    } catch (err) {
      console.error('Barcode render error:', err);
    }
  }, [value]);

  const isUsable = status === 'issued';

  return (
    <div className="relative rounded-xl border border-[#1E2A22]/10 bg-white p-4 text-center">
      <div className="mb-2 flex items-center justify-between text-xs text-[#55645A]">
        <span className="font-medium">CODE 128 전용 쿠폰</span>
        <span className="inline-flex items-center gap-1 font-semibold text-[#1E2A22]">
          {status === 'issued' && (
            <>
              <Ticket className="h-3.5 w-3.5 text-[#4A6B57]" aria-hidden="true" />
              <span>사용 가능</span>
            </>
          )}
          {status === 'redeemed' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#55645A]" aria-hidden="true" />
              <span>사용 완료</span>
            </>
          )}
          {status === 'expired' && (
            <>
              <Clock className="h-3.5 w-3.5 text-[#B95519]" aria-hidden="true" />
              <span className="text-[#B95519]">만료됨</span>
            </>
          )}
          {status === 'cancelled' && (
            <>
              <Ban className="h-3.5 w-3.5 text-[#991B1B]" aria-hidden="true" />
              <span className="text-[#991B1B]">취소됨</span>
            </>
          )}
        </span>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-white py-2">
        <svg
          ref={svgRef}
          role="img"
          aria-label={`쿠폰 바코드 ${value}`}
          className={`mx-auto max-w-full transition-opacity duration-200 ${isUsable ? 'opacity-100' : 'opacity-25'}`}
        />

        {!isUsable && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <div className="rounded-lg border border-[#1E2A22]/20 bg-[#FAF8F3] px-4 py-2 text-sm font-semibold text-[#1E2A22]">
              {status === 'redeemed' && '매장 사용 완료'}
              {status === 'expired' && '유효기간 만료'}
              {status === 'cancelled' && '취소된 쿠폰'}
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 font-mono text-base font-semibold tracking-[0.14em] text-[#1E2A22] tabular-nums select-all">
        {value}
      </p>
    </div>
  );
}
