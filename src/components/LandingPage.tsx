import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Coffee,
  MapPin,
  Menu,
  Phone,
  Ticket,
  Car,
  X,
} from 'lucide-react';
import { BASIC_MENU_ITEMS, STORE_CONFIG, type MenuItem } from '../config/storeConfig';
import {
  fetchCustomerCoupon,
  getEffectiveCouponStatus,
  getSavedCustomerCouponId,
  trackPromotionEvent,
  type CouponRecord,
} from '../lib/coupons';
import { CouponModal } from './CouponModal';

interface LandingPageProps {
  onNavigateStaff: () => void;
}

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  fallbackLabel: string;
}

function SafeImage({ src, alt, className = '', priority = false, fallbackLabel }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EEF2EC] px-4 text-center text-[#55645A] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Coffee className="mb-2 h-6 w-6 text-[#4A6B57]" aria-hidden="true" />
        <span className="text-xs font-medium">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage({ onNavigateStaff }: LandingPageProps) {
  const [menuFilter, setMenuFilter] = useState<'all' | 'coffee' | 'beverage'>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [customerCoupon, setCustomerCoupon] = useState<CouponRecord | null>(null);
  const menuTrackedRef = useRef(false);
  const menuSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    trackPromotionEvent('pageView');

    const savedId = getSavedCustomerCouponId();
    if (savedId) {
      fetchCustomerCoupon(savedId)
        .then((found) => {
          if (found) setCustomerCoupon(found);
        })
        .catch(() => {
          // Ignore transient lookup error on initial mount
        });
    }
  }, []);

  useEffect(() => {
    const el = menuSectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !menuTrackedRef.current) {
          menuTrackedRef.current = true;
          trackPromotionEvent('menuView');
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const filteredMenu: MenuItem[] =
    menuFilter === 'all'
      ? BASIC_MENU_ITEMS
      : BASIC_MENU_ITEMS.filter((item) => item.category === menuFilter);

  const handleOpenCoupon = () => {
    trackPromotionEvent('couponClick');
    setMobileMenuOpen(false);
    setCouponModalOpen(true);
  };

  const hasCoupon = Boolean(customerCoupon);
  const couponStatus = customerCoupon ? getEffectiveCouponStatus(customerCoupon) : null;

  const formatPrice = (price: number | null) =>
    price !== null ? `${price.toLocaleString('ko-KR')}원` : '가격 매장 확인 중';

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1E2A22]">
      {/* Sticky Top Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-40 border-b border-[#1E2A22]/10 bg-[#FAF8F3]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <a
            href="#hero"
            className="font-display text-xl font-semibold tracking-tight text-[#1E2A22] whitespace-nowrap shrink-0"
          >
            {STORE_CONFIG.brandName}
          </a>

          <nav
            aria-label="주요 메뉴 이동"
            className="hidden items-center gap-6 text-sm font-medium text-[#55645A] md:flex"
          >
            <a href="#hero" className="transition-colors hover:text-[#1E2A22] whitespace-nowrap shrink-0">
              신메뉴
            </a>
            <a href="#story" className="transition-colors hover:text-[#1E2A22] whitespace-nowrap shrink-0">
              원재료 스토리
            </a>
            <a href="#coupon-event" className="transition-colors hover:text-[#1E2A22] whitespace-nowrap shrink-0">
              쿠폰 혜택
            </a>
            <a href="#menu" className="transition-colors hover:text-[#1E2A22] whitespace-nowrap shrink-0">
              기본 메뉴
            </a>
            <a href="#store-info" className="transition-colors hover:text-[#1E2A22] whitespace-nowrap shrink-0">
              매장 안내
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenCoupon}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#4A6B57] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#365242] whitespace-nowrap shrink-0 sm:text-sm"
            >
              {hasCoupon ? '내 쿠폰 보기' : '신메뉴 쿠폰 받기'}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? '모바일 메뉴 닫기' : '모바일 메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#1E2A22] hover:bg-[#1E2A22]/5 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#1E2A22]/10 bg-[#FAF8F3] px-4 py-3 md:hidden">
            <nav aria-label="모바일 메뉴" className="flex flex-col space-y-1 text-sm font-medium text-[#1E2A22]">
              {[
                { href: '#hero', label: '신메뉴 소개' },
                { href: '#story', label: '원재료 스토리' },
                { href: '#coupon-event', label: '쿠폰 이벤트' },
                { href: '#menu', label: '기본 메뉴 8종' },
                { href: '#store-info', label: '매장 안내' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 hover:bg-[#EEF2EC]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* 1. Hero Section */}
        <section id="hero" className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-center lg:col-span-5">
              <p className="text-sm font-medium text-[#D96B27]">
                {STORE_CONFIG.brandName} 시즌 신메뉴 · {STORE_CONFIG.newMenu.auxCopy}
              </p>

              <h1 className="mt-3 text-4xl font-semibold leading-[1.2] tracking-tight text-[#1E2A22] [text-wrap:balance] sm:text-5xl">
                {STORE_CONFIG.newMenu.mainCopy}
              </h1>

              <p className="mt-4 text-lg font-semibold text-[#365242]">
                {STORE_CONFIG.newMenu.name}
              </p>

              <p className="mt-3 max-w-xl text-base leading-relaxed text-[#55645A]">
                {STORE_CONFIG.newMenu.subCopy}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleOpenCoupon}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#4A6B57] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#365242] whitespace-nowrap"
                >
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                  <span>{hasCoupon ? '발급된 쿠폰 바코드 보기' : '신메뉴 쿠폰 받기'}</span>
                </button>

                <a
                  href="#menu"
                  className="inline-flex min-h-[48px] items-center gap-1.5 px-2 py-3 text-sm font-semibold text-[#1E2A22] transition-colors hover:text-[#4A6B57] whitespace-nowrap"
                >
                  <span>기본 메뉴 보기</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              <div className="mt-8 border-t border-[#1E2A22]/10 pt-5 text-xs text-[#55645A]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>제주 구좌 유기농 당근 사용</span>
                  <span aria-hidden="true">·</span>
                  <span>당근과 과일 본연의 단맛</span>
                  <span aria-hidden="true">·</span>
                  <span>첫 방문 구매 시 아메리카노 1잔 무료</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-2xl border border-[#1E2A22]/10 bg-[#EEF2EC] sm:min-h-[380px]">
                <SafeImage
                  src={STORE_CONFIG.newMenu.heroImageUrl}
                  alt="제주 구좌 유기농 당근케이크가 세라믹 접시에 담긴 모습"
                  priority
                  fallbackLabel={STORE_CONFIG.newMenu.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. 신메뉴 특징 및 원재료 스토리 */}
        <section id="story" className="border-y border-[#1E2A22]/10 bg-[#EEF2EC]/70 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-6">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[#1E2A22]/10 bg-white">
                  <SafeImage
                    src={STORE_CONFIG.newMenu.storyImageUrl}
                    alt="제주 구좌 유기농 당근과 촉촉한 당근케이크 단면 클로즈업"
                    fallbackLabel="원재료 스토리 이미지"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div className="space-y-6 lg:col-span-6">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-[#D96B27]">원재료 이야기</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1E2A22] [text-wrap:balance] sm:text-3xl">
                    자연에서 온 재료로 채운 산뜻한 한 조각
                  </h2>
                </div>

                <div className="space-y-5 divide-y divide-[#1E2A22]/10">
                  <div className="pt-1">
                    <h3 className="text-base font-semibold text-[#1E2A22]">01. 제주 구좌 유기농 당근</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#55645A]">
                      {STORE_CONFIG.newMenu.originNote}
                    </p>
                  </div>

                  <div className="pt-5">
                    <h3 className="text-base font-semibold text-[#1E2A22]">02. 당근과 과일 본연의 단맛</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#55645A]">
                      {STORE_CONFIG.newMenu.sweetnessNote}
                    </p>
                  </div>

                  <div className="pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-[#1E2A22]">03. 매장 가격 안내</h3>
                      <span className="text-sm font-medium text-[#365242] tabular-nums">
                        {formatPrice(STORE_CONFIG.newMenu.priceKrw)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#55645A]">
                      원재료와 최종 매장 판매가는 매장 운영 기준 확인 후 업데이트됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 신메뉴 쿠폰 이벤트 */}
        <section id="coupon-event" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-[#1E2A22]/10 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="p-6 sm:p-10 lg:col-span-7">
                <p className="text-xs font-semibold text-[#D96B27]">{STORE_CONFIG.promotion.title}</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1E2A22] [text-wrap:balance] sm:text-3xl">
                  당근케이크와 함께 즐기는 아메리카노 1잔 무료 혜택
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#55645A] sm:text-base">
                  {STORE_CONFIG.promotion.targetAudience}이 매장 방문 시 신메뉴{' '}
                  <strong className="font-semibold text-[#1E2A22]">{STORE_CONFIG.newMenu.name}</strong>를 구매하시면
                  아메리카노 1잔을 무료로 제공해 드립니다.
                </p>

                <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-[#1E2A22]/10 pt-6 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-[#55645A]">적용 대상 및 조건</dt>
                    <dd className="mt-1 font-medium text-[#1E2A22]">
                      {STORE_CONFIG.promotion.targetAudience} · 당근케이크 구매 시
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[#55645A]">제공 혜택</dt>
                    <dd className="mt-1 font-semibold text-[#4A6B57]">{STORE_CONFIG.promotion.benefitLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[#55645A]">유효기간 안내</dt>
                    <dd className="mt-1 text-[#1E2A22]">{STORE_CONFIG.promotion.validityNote}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[#55645A]">사용 방식</dt>
                    <dd className="mt-1 text-[#1E2A22]">고유 바코드 발급 · 직원 확인 후 1회 사용</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col justify-center border-t border-[#1E2A22]/10 bg-[#EEF2EC] p-6 sm:p-10 lg:col-span-5 lg:border-l lg:border-t-0">
                {hasCoupon && customerCoupon ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-[#55645A]">발급된 쿠폰 코드</p>
                      <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-[#1E2A22] tabular-nums">
                        {customerCoupon.id}
                      </p>
                      <p className="mt-1 text-xs text-[#4A6B57]">
                        현재 상태:{' '}
                        {couponStatus === 'issued'
                          ? '사용 가능 (바코드 제시)'
                          : couponStatus === 'redeemed'
                            ? '매장 사용 완료'
                            : couponStatus === 'expired'
                              ? '유효기간 만료'
                              : '취소됨'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenCoupon}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#4A6B57] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#365242]"
                    >
                      <Ticket className="h-4 w-4" aria-hidden="true" />
                      <span>바코드 쿠폰 크게 보기</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-[#1E2A22]">
                      별도 회원가입 없이 1회용 바코드 쿠폰이 즉시 발급됩니다.
                    </p>
                    <p className="text-xs leading-relaxed text-[#55645A]">
                      {STORE_CONFIG.promotion.americanoOptionNote}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCoupon}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#D96B27] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#B95519]"
                    >
                      <Ticket className="h-4 w-4" aria-hidden="true" />
                      <span>신메뉴 쿠폰 받기</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4. 아이콘카페 기본 메뉴 8종 */}
        <section id="menu" ref={menuSectionRef} className="border-t border-[#1E2A22]/15 bg-[#1E2A22] py-14 text-[#FAF8F3] sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#A8CBB3]">아이콘카페 기본 메뉴</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#FAF8F3] sm:text-3xl">
                  당근케이크와 어울리는 시그니처 음료 8종
                </h2>
                <p className="mt-2 text-sm text-[#C8D3CB]">
                  실제 매장 판매 구성 및 가격은 매장 최종 확인 후 반영됩니다.
                </p>
              </div>

              {/* Interactive filter tabs */}
              <div
                role="tablist"
                aria-label="메뉴 카테고리 필터"
                className="inline-flex self-start rounded-xl border border-white/15 bg-[#16201A] p-1"
              >
                {(
                  [
                    { key: 'all', label: '전체 8' },
                    { key: 'coffee', label: '커피 4' },
                    { key: 'beverage', label: '논커피 · 에이드 4' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={menuFilter === tab.key}
                    onClick={() => setMenuFilter(tab.key)}
                    className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:text-sm ${
                      menuFilter === tab.key
                        ? 'bg-[#4A6B57] text-white'
                        : 'text-[#C8D3CB] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredMenu.map((item) => (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#25342B] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#16201A]">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      fallbackLabel={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold tracking-wide text-[#FAF8F3]">{item.name}</h3>
                        <span className="text-xs font-medium text-[#A8CBB3] whitespace-nowrap">
                          {item.options.join(' · ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#A5B5AA]">{item.englishName}</p>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#D7E0D9]">{item.description}</p>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3 text-xs font-medium text-[#C8D3CB] tabular-nums">
                      {formatPrice(item.priceKrw)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. 매장 정보 및 방문 안내 */}
        <section id="store-info" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#4A6B57]">매장 방문 안내</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1E2A22] sm:text-3xl">
              {STORE_CONFIG.brandName} 오시는 길
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#55645A]">
              계원예술대 매장 위치와 네이버 지도를 통해 방문 경로를 확인하실 수 있으며, 세부 운영 정보는 확인 후 업데이트됩니다.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A22]">
                <MapPin className="h-4 w-4 text-[#4A6B57]" aria-hidden="true" />
                <span>매장 주소</span>
              </div>
              <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#1E2A22]">
                {STORE_CONFIG.storeInfo.address ?? '매장 주소 확인 후 안내 예정'}
              </p>
              {STORE_CONFIG.storeInfo.mapUrl && (
                <a
                  href={STORE_CONFIG.storeInfo.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#4A6B57] hover:underline"
                >
                  <span>네이버 지도에서 보기</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>

            <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A22]">
                <Clock className="h-4 w-4 text-[#4A6B57]" aria-hidden="true" />
                <span>영업시간</span>
              </div>
              {STORE_CONFIG.storeInfo.businessHours ? (
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#1E2A22] tabular-nums">
                  {STORE_CONFIG.storeInfo.businessHours}
                </p>
              ) : (
                <p className="mt-2.5 text-sm leading-relaxed text-[#55645A]">
                  영업시간 확인 후 안내 예정
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A22]">
                <Phone className="h-4 w-4 text-[#4A6B57]" aria-hidden="true" />
                <span>문의 연락처</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#55645A] tabular-nums">
                {STORE_CONFIG.storeInfo.phone ?? '연락처 확인 후 안내 예정'}
              </p>
            </div>

            <div className="rounded-xl border border-[#1E2A22]/10 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A22]">
                <Car className="h-4 w-4 text-[#4A6B57]" aria-hidden="true" />
                <span>주차 및 방문 안내</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#55645A]">
                {STORE_CONFIG.storeInfo.parkingGuide ?? '주차 및 방문 안내 확인 후 업데이트 예정'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Quiet Footer */}
      <footer className="border-t border-[#1E2A22]/10 bg-[#FAF8F3] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 text-xs text-[#55645A] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-[#1E2A22]">{STORE_CONFIG.brandName}</span>
            <span aria-hidden="true">·</span>
            <span>제주 구좌 유기농 당근케이크 신메뉴 프로모션</span>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleOpenCoupon}
              className="font-medium text-[#55645A] transition-colors hover:text-[#1E2A22]"
            >
              쿠폰 확인
            </button>
            <button
              type="button"
              onClick={onNavigateStaff}
              className="font-medium text-[#55645A] transition-colors hover:text-[#1E2A22]"
            >
              직원용 쿠폰 관리
            </button>
          </div>
        </div>
      </footer>

      <CouponModal
        isOpen={couponModalOpen}
        onClose={() => setCouponModalOpen(false)}
        coupon={customerCoupon}
        onCouponChange={setCustomerCoupon}
      />
    </div>
  );
}
