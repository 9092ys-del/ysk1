export type CouponStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';
export type BeverageOption = 'ICE' | 'HOT' | 'UNDECIDED';
export type StaffRole = 'staff' | 'admin';

export interface CouponRecord {
  id: string;
  couponType: 'NEW_CARROT_CAKE_AMERICANO';
  benefitLabel: string;
  status: CouponStatus;
  selectedOption: BeverageOption;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  redeemedByName: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  updatedAt: string;
}

export interface StaffProfile {
  id: string;
  displayName: string;
  role: StaffRole;
}

export interface StaffMemberRecord extends StaffProfile {
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponEventRecord {
  id: string;
  couponId: string;
  eventType: CouponStatus;
  actorId: string;
  actorName: string;
  note: string | null;
  createdAt: string;
}

export interface AnalyticsMetrics {
  pageViews: number;
  couponClicks: number;
  menuViews: number;
}

export type CouponErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_REDEEMED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'INVALID_CODE'
  | 'NETWORK'
  | 'UNAUTHORIZED';

export class CouponActionError extends Error {
  code: CouponErrorCode;
  coupon?: CouponRecord;

  constructor(code: CouponErrorCode, message: string, coupon?: CouponRecord) {
    super(message);
    this.name = 'CouponActionError';
    this.code = code;
    this.coupon = coupon;
  }
}

const CUSTOMER_COUPON_KEY = 'iconcafe_customer_coupon_id';
const STAFF_TOKEN_KEY = 'iconcafe_staff_session_token';

export function getSavedCustomerCouponId(): string | null {
  try {
    return window.localStorage.getItem(CUSTOMER_COUPON_KEY);
  } catch {
    return null;
  }
}

export function saveCustomerCouponId(id: string): void {
  try {
    window.localStorage.setItem(CUSTOMER_COUPON_KEY, id);
  } catch {
    // Ignore storage restriction
  }
}

export function getStaffToken(): string | null {
  try {
    return window.sessionStorage.getItem(STAFF_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStaffToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(STAFF_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCouponCodeFormat(code: string): boolean {
  return /^ICON-[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/.test(code);
}

export function getEffectiveCouponStatus(coupon: CouponRecord, nowMs: number = Date.now()): CouponStatus {
  if (coupon.status === 'issued' && Date.parse(coupon.expiresAt) < nowMs) {
    return 'expired';
  }
  return coupon.status;
}

export function formatKoreanDateTime(iso: string | null | undefined): string {
  if (!iso) return '확인 중';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatKoreanDate(iso: string | null | undefined): string {
  if (!iso) return '확인 중';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function trackPromotionEvent(event: 'pageView' | 'couponClick' | 'menuView'): void {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {
    // Non-blocking analytics call
  });
}

export async function issueCustomerCoupon(selectedOption: BeverageOption = 'UNDECIDED'): Promise<CouponRecord> {
  const res = await fetch('/api/coupons/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedOption }),
  });

  if (!res.ok) {
    throw new CouponActionError('NETWORK', '쿠폰 발급 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const data = (await res.json()) as { coupon: CouponRecord };
  saveCustomerCouponId(data.coupon.id);
  return data.coupon;
}

export async function fetchCustomerCoupon(code: string): Promise<CouponRecord | null> {
  const normalized = normalizeCouponCode(code);
  if (!isValidCouponCodeFormat(normalized)) return null;

  const res = await fetch(`/api/coupons/${encodeURIComponent(normalized)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new CouponActionError('NETWORK', '쿠폰 상태를 확인하지 못했습니다.');
  }
  const data = (await res.json()) as { coupon: CouponRecord };
  return data.coupon;
}

export async function staffLogin(staffId: string, passcode: string): Promise<{ token: string; staff: StaffProfile }> {
  const res = await fetch('/api/staff/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId, passcode }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    token?: string;
    staff?: StaffProfile;
    message?: string;
  };

  if (!res.ok || !payload.token || !payload.staff) {
    throw new Error(payload.message || '로그인에 실패했습니다.');
  }

  setStaffToken(payload.token);
  return { token: payload.token, staff: payload.staff };
}

export async function fetchStaffSession(): Promise<StaffProfile | null> {
  const token = getStaffToken();
  if (!token) return null;

  const res = await fetch('/api/staff/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    setStaffToken(null);
    return null;
  }

  const data = (await res.json()) as { staff: StaffProfile };
  return data.staff;
}

function getAuthHeaders(): Record<string, string> {
  const token = getStaffToken();
  if (!token) {
    throw new CouponActionError('UNAUTHORIZED', '직원 인증이 필요합니다.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function lookupCouponForStaff(rawCode: string): Promise<CouponRecord> {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCodeFormat(code)) {
    throw new CouponActionError('INVALID_CODE', '유효한 쿠폰을 확인할 수 없습니다.');
  }

  let res: Response;
  try {
    res = await fetch('/api/staff/coupons/verify', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    if (error instanceof CouponActionError) throw error;
    throw new CouponActionError('NETWORK', '서버 상태를 확인하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 조회해 주세요.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new CouponActionError('UNAUTHORIZED', '직원 인증이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const payload = (await res.json().catch(() => ({}))) as {
    coupon?: CouponRecord;
    message?: string;
  };

  if (!res.ok || !payload.coupon) {
    throw new CouponActionError('NOT_FOUND', payload.message || '유효한 쿠폰을 확인할 수 없습니다.');
  }

  return payload.coupon;
}

export async function redeemCouponByStaff(rawCode: string): Promise<CouponRecord> {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCodeFormat(code)) {
    throw new CouponActionError('INVALID_CODE', '유효한 쿠폰을 확인할 수 없습니다.');
  }

  let res: Response;
  try {
    res = await fetch('/api/staff/coupons/redeem', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    if (error instanceof CouponActionError) throw error;
    throw new CouponActionError(
      'NETWORK',
      '네트워크 오류로 사용 처리 완료 여부를 확정하지 못했습니다. 반드시 쿠폰을 다시 조회하여 서버 상태를 확인해 주세요.'
    );
  }

  const payload = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    coupon?: CouponRecord;
  };

  if (res.status === 401 || res.status === 403) {
    throw new CouponActionError('UNAUTHORIZED', payload.message || '직원 인증이 만료되었습니다.');
  }

  if (!res.ok) {
    const mappedCode: CouponErrorCode =
      payload.code === 'ALREADY_REDEEMED'
        ? 'ALREADY_REDEEMED'
        : payload.code === 'EXPIRED'
          ? 'EXPIRED'
          : payload.code === 'CANCELLED'
            ? 'CANCELLED'
            : payload.code === 'NOT_FOUND' || payload.code === 'INVALID_CODE'
              ? 'NOT_FOUND'
              : 'NETWORK';

    throw new CouponActionError(
      mappedCode,
      payload.message || '쿠폰 사용 처리 중 오류가 발생했습니다. 서버 상태를 다시 조회해 주세요.',
      payload.coupon
    );
  }

  if (!payload.coupon) {
    throw new CouponActionError('NETWORK', '서버 응답을 확인하지 못했습니다. 쿠폰을 다시 조회해 주세요.');
  }

  return payload.coupon;
}

export async function cancelCouponByStaff(rawCode: string, reason: string): Promise<CouponRecord> {
  const code = normalizeCouponCode(rawCode);
  let res: Response;
  try {
    res = await fetch('/api/staff/coupons/cancel', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code, reason }),
    });
  } catch {
    throw new CouponActionError('NETWORK', '네트워크 오류로 취소 처리를 확인하지 못했습니다.');
  }

  const payload = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    coupon?: CouponRecord;
  };

  if (res.status === 401 || res.status === 403) {
    throw new CouponActionError('UNAUTHORIZED', payload.message || '직원 인증이 만료되었습니다.');
  }

  if (!res.ok || !payload.coupon) {
    throw new CouponActionError('INVALID_CODE', payload.message || '쿠폰을 취소할 수 없습니다.', payload.coupon);
  }

  return payload.coupon;
}

export async function fetchPortalDashboardData(): Promise<{
  coupons: CouponRecord[];
  events: CouponEventRecord[];
  analytics: AnalyticsMetrics;
}> {
  const res = await fetch('/api/staff/coupons', {
    headers: getAuthHeaders(),
  });
  if (res.status === 401 || res.status === 403) {
    throw new CouponActionError('UNAUTHORIZED', '직원 인증이 만료되었습니다.');
  }
  if (!res.ok) {
    throw new Error('쿠폰 내역을 불러오지 못했습니다.');
  }
  return res.json();
}

export async function fetchStaffMembers(): Promise<StaffMemberRecord[]> {
  const res = await fetch('/api/staff/members', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || '직원 목록을 불러오지 못했습니다.');
  }
  const data = (await res.json()) as { members: StaffMemberRecord[] };
  return data.members;
}

export async function saveStaffMember(payload: {
  id: string;
  displayName: string;
  role: StaffRole;
  passcode?: string;
  active?: boolean;
}): Promise<StaffMemberRecord> {
  const res = await fetch('/api/staff/members', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { member?: StaffMemberRecord; message?: string };
  if (!res.ok || !data.member) {
    throw new Error(data.message || '직원 정보를 저장하지 못했습니다.');
  }
  return data.member;
}

export async function updateStaffMember(
  id: string,
  patch: Partial<{ active: boolean; displayName: string; role: StaffRole; passcode: string }>
): Promise<StaffMemberRecord> {
  const res = await fetch(`/api/staff/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(patch),
  });
  const data = (await res.json().catch(() => ({}))) as { member?: StaffMemberRecord; message?: string };
  if (!res.ok || !data.member) {
    throw new Error(data.message || '직원 상태를 변경하지 못했습니다.');
  }
  return data.member;
}
