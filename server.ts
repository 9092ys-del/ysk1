import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'iconcafe-db.json');

const SESSION_SECRET =
  process.env.ICONCAFE_SESSION_SECRET ||
  crypto.createHash('sha256').update(`iconcafe-local-secret-${__dirname}`).digest('hex');

const COUPON_VALIDITY_DAYS = 14;
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

type CouponStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';
type BeverageOption = 'ICE' | 'HOT' | 'UNDECIDED';
type StaffRole = 'staff' | 'admin';

interface ServerCoupon {
  id: string;
  tokenHash: string;
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

interface ServerStaff {
  id: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerCouponEvent {
  id: string;
  couponId: string;
  eventType: CouponStatus;
  actorId: string;
  actorName: string;
  note: string | null;
  createdAt: string;
}

interface AnalyticsMetrics {
  pageViews: number;
  couponClicks: number;
  menuViews: number;
}

interface DatabaseSchema {
  coupons: Record<string, ServerCoupon>;
  staff: Record<string, ServerStaff>;
  events: ServerCouponEvent[];
  analytics: AnalyticsMetrics;
}

interface SessionPayload {
  uid: string;
  role: StaffRole;
  displayName: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  staffSession?: SessionPayload;
}

function hashPasscode(passcode: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(passcode, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPasscode(passcode: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(passcode, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  const adminId = (process.env.ICONCAFE_ADMIN_ID || 'admin').trim();
  const adminPass = process.env.ICONCAFE_ADMIN_PASSCODE || 'icon2026!';
  const adminCreds = hashPasscode(adminPass);

  const staffPass = process.env.ICONCAFE_STAFF_PASSCODE || '2026';
  const staffCreds = hashPasscode(staffPass);

  return {
    coupons: {},
    staff: {
      [adminId]: {
        id: adminId,
        displayName: '매장 관리자',
        role: 'admin',
        active: true,
        passwordSalt: adminCreds.salt,
        passwordHash: adminCreds.hash,
        createdAt: now,
        updatedAt: now,
      },
      staff01: {
        id: 'staff01',
        displayName: '매장 스태프',
        role: 'staff',
        active: true,
        passwordSalt: staffCreds.salt,
        passwordHash: staffCreds.hash,
        createdAt: now,
        updatedAt: now,
      },
    },
    events: [],
    analytics: {
      pageViews: 0,
      couponClicks: 0,
      menuViews: 0,
    },
  };
}

function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDb();
    persistDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      coupons: parsed.coupons || {},
      staff: parsed.staff && Object.keys(parsed.staff).length > 0 ? parsed.staff : createInitialDb().staff,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      analytics: parsed.analytics || { pageViews: 0, couponClicks: 0, menuViews: 0 },
    };
  } catch {
    const initial = createInitialDb();
    persistDatabase(initial);
    return initial;
  }
}

function persistDatabase(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

let dbCache: DatabaseSchema = loadDatabase();
let lockChain: Promise<void> = Promise.resolve();

async function withDbLock<T>(mutator: (db: DatabaseSchema) => Promise<T> | T, persist = true): Promise<T> {
  const previous = lockChain;
  let release!: () => void;
  lockChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const result = await mutator(dbCache);
    if (persist) {
      persistDatabase(dbCache);
    }
    return result;
  } finally {
    release();
  }
}

function randomSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function generateUniqueCouponId(existing: Record<string, ServerCoupon>): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `ICON-${randomSegment(5)}-${randomSegment(5)}`;
    if (!existing[candidate]) return candidate;
  }
  throw new Error('Failed to allocate unique coupon code.');
}

function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function isValidCouponCodeFormat(code: string): boolean {
  return /^ICON-[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/.test(code);
}

function computeTokenHash(couponId: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(couponId).digest('hex');
}

function sanitizePublicCoupon(coupon: ServerCoupon) {
  const isPastExpiry = coupon.status === 'issued' && Date.parse(coupon.expiresAt) < Date.now();
  const effectiveStatus: CouponStatus = isPastExpiry ? 'expired' : coupon.status;
  return {
    id: coupon.id,
    couponType: coupon.couponType,
    benefitLabel: coupon.benefitLabel,
    status: effectiveStatus,
    selectedOption: coupon.selectedOption,
    issuedAt: coupon.issuedAt,
    expiresAt: coupon.expiresAt,
    redeemedAt: coupon.redeemedAt,
    redeemedBy: coupon.redeemedBy,
    redeemedByName: coupon.redeemedByName,
    cancelledAt: coupon.cancelledAt,
    cancelledReason: coupon.cancelledReason,
    updatedAt: coupon.updatedAt,
  };
}

function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireStaffAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '직원 인증이 필요합니다.' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '인증 세션이 만료되었거나 유효하지 않습니다.' });
    return;
  }
  const staffRecord = dbCache.staff[session.uid];
  if (!staffRecord || !staffRecord.active) {
    res.status(403).json({ error: 'FORBIDDEN', message: '비활성화되었거나 권한이 없는 직원 계정입니다.' });
    return;
  }
  req.staffSession = {
    ...session,
    role: staffRecord.role,
    displayName: staffRecord.displayName,
  };
  next();
}

function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireStaffAuth(req, res, () => {
    if (req.staffSession?.role !== 'admin') {
      res.status(403).json({ error: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' });
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Optional P1 promotion analytics
  app.post('/api/analytics/track', async (req, res) => {
    const event = typeof req.body?.event === 'string' ? req.body.event : '';
    if (!['pageView', 'couponClick', 'menuView'].includes(event)) {
      res.status(400).json({ error: 'INVALID_EVENT' });
      return;
    }
    await withDbLock((db) => {
      if (event === 'pageView') db.analytics.pageViews += 1;
      if (event === 'couponClick') db.analytics.couponClicks += 1;
      if (event === 'menuView') db.analytics.menuViews += 1;
    });
    res.json({ ok: true });
  });

  // Customer: Issue new single-use barcode coupon
  app.post('/api/coupons/issue', async (req, res) => {
    const rawOption = typeof req.body?.selectedOption === 'string' ? req.body.selectedOption : 'UNDECIDED';
    const selectedOption: BeverageOption =
      rawOption === 'ICE' || rawOption === 'HOT' || rawOption === 'UNDECIDED' ? rawOption : 'UNDECIDED';

    const created = await withDbLock((db) => {
      const couponId = generateUniqueCouponId(db.coupons);
      const now = new Date();
      const nowIso = now.toISOString();
      const expiresIso = new Date(now.getTime() + COUPON_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const coupon: ServerCoupon = {
        id: couponId,
        tokenHash: computeTokenHash(couponId),
        couponType: 'NEW_CARROT_CAKE_AMERICANO',
        benefitLabel: '아메리카노 1잔 무료',
        status: 'issued',
        selectedOption,
        issuedAt: nowIso,
        expiresAt: expiresIso,
        redeemedAt: null,
        redeemedBy: null,
        redeemedByName: null,
        cancelledAt: null,
        cancelledReason: null,
        updatedAt: nowIso,
      };

      db.coupons[couponId] = coupon;
      db.events.unshift({
        id: `EVT-${Date.now().toString(36).toUpperCase()}-${randomSegment(6)}`,
        couponId,
        eventType: 'issued',
        actorId: 'customer',
        actorName: '방문 고객',
        note: `신메뉴 쿠폰 발급 (선호 옵션: ${selectedOption})`,
        createdAt: nowIso,
      });

      return sanitizePublicCoupon(coupon);
    });

    res.status(201).json({ coupon: created });
  });

  // Customer: Lookup own coupon status from server
  app.get('/api/coupons/:code', async (req, res) => {
    const code = normalizeCouponCode(req.params.code || '');
    if (!isValidCouponCodeFormat(code)) {
      res.status(404).json({ code: 'NOT_FOUND', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }

    const result = await withDbLock((db) => {
      const coupon = db.coupons[code];
      if (!coupon) return null;
      if (coupon.status === 'issued' && Date.parse(coupon.expiresAt) < Date.now()) {
        coupon.status = 'expired';
        coupon.updatedAt = new Date().toISOString();
      }
      return sanitizePublicCoupon(coupon);
    });

    if (!result) {
      res.status(404).json({ code: 'NOT_FOUND', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }
    res.json({ coupon: result });
  });

  // Staff Login
  app.post('/api/staff/login', async (req, res) => {
    const staffId = typeof req.body?.staffId === 'string' ? req.body.staffId.trim() : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';

    if (!staffId || !passcode) {
      res.status(400).json({ message: '직원 아이디와 비밀번호를 모두 입력해 주세요.' });
      return;
    }

    const staff = dbCache.staff[staffId];
    if (!staff || !verifyPasscode(passcode, staff.passwordSalt, staff.passwordHash)) {
      res.status(401).json({ message: '직원 아이디 또는 비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (!staff.active) {
      res.status(403).json({ message: '비활성화된 직원 계정입니다. 매장에 문의해 주세요.' });
      return;
    }

    const token = signSessionToken({
      uid: staff.id,
      role: staff.role,
      displayName: staff.displayName,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      staff: {
        id: staff.id,
        displayName: staff.displayName,
        role: staff.role,
      },
    });
  });

  app.get('/api/staff/me', requireStaffAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      staff: {
        id: req.staffSession!.uid,
        displayName: req.staffSession!.displayName,
        role: req.staffSession!.role,
      },
    });
  });

  // Staff: Lookup & Verify coupon without redeeming yet
  app.post('/api/staff/coupons/verify', requireStaffAuth, async (req: AuthenticatedRequest, res) => {
    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    const code = normalizeCouponCode(rawCode);
    if (!isValidCouponCodeFormat(code)) {
      res.status(404).json({ code: 'INVALID_CODE', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }

    const result = await withDbLock((db) => {
      const coupon = db.coupons[code];
      if (!coupon) return null;
      if (coupon.status === 'issued' && Date.parse(coupon.expiresAt) < Date.now()) {
        coupon.status = 'expired';
        coupon.updatedAt = new Date().toISOString();
      }
      return sanitizePublicCoupon(coupon);
    });

    if (!result) {
      res.status(404).json({ code: 'NOT_FOUND', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }
    res.json({ coupon: result });
  });

  // Staff: Atomic single-use redemption
  app.post('/api/staff/coupons/redeem', requireStaffAuth, async (req: AuthenticatedRequest, res) => {
    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    const code = normalizeCouponCode(rawCode);
    const staff = req.staffSession!;

    if (!isValidCouponCodeFormat(code)) {
      res.status(404).json({ code: 'INVALID_CODE', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }

    const outcome = await withDbLock((db) => {
      const coupon = db.coupons[code];
      if (!coupon) {
        return { httpStatus: 404, code: 'NOT_FOUND', message: '유효한 쿠폰을 확인할 수 없습니다.' };
      }

      if (coupon.status === 'redeemed') {
        return {
          httpStatus: 409,
          code: 'ALREADY_REDEEMED',
          message: '이미 사용된 쿠폰입니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }

      if (coupon.status === 'cancelled') {
        return {
          httpStatus: 400,
          code: 'CANCELLED',
          message: '취소된 쿠폰입니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }

      if (coupon.status === 'expired' || Date.parse(coupon.expiresAt) < Date.now()) {
        coupon.status = 'expired';
        coupon.updatedAt = new Date().toISOString();
        return {
          httpStatus: 410,
          code: 'EXPIRED',
          message: '쿠폰 유효기간이 만료되었습니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }

      const nowIso = new Date().toISOString();
      coupon.status = 'redeemed';
      coupon.redeemedAt = nowIso;
      coupon.redeemedBy = staff.uid;
      coupon.redeemedByName = staff.displayName;
      coupon.updatedAt = nowIso;

      db.events.unshift({
        id: `EVT-${Date.now().toString(36).toUpperCase()}-${randomSegment(6)}`,
        couponId: coupon.id,
        eventType: 'redeemed',
        actorId: staff.uid,
        actorName: staff.displayName,
        note: '매장 직원 쿠폰 사용 확정',
        createdAt: nowIso,
      });

      return {
        httpStatus: 200,
        code: 'REDEEMED',
        message: '쿠폰 사용 처리가 완료되었습니다.',
        coupon: sanitizePublicCoupon(coupon),
      };
    });

    res.status(outcome.httpStatus).json({
      code: outcome.code,
      message: outcome.message,
      coupon: outcome.coupon,
    });
  });

  // Staff: Cancel an issued coupon with reason
  app.post('/api/staff/coupons/cancel', requireStaffAuth, async (req: AuthenticatedRequest, res) => {
    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
    const code = normalizeCouponCode(rawCode);
    const staff = req.staffSession!;

    if (!isValidCouponCodeFormat(code)) {
      res.status(404).json({ code: 'INVALID_CODE', message: '유효한 쿠폰을 확인할 수 없습니다.' });
      return;
    }
    if (!reason) {
      res.status(400).json({ code: 'INVALID_REASON', message: '취소 사유를 입력해 주세요.' });
      return;
    }

    const outcome = await withDbLock((db) => {
      const coupon = db.coupons[code];
      if (!coupon) {
        return { httpStatus: 404, code: 'NOT_FOUND', message: '유효한 쿠폰을 확인할 수 없습니다.' };
      }
      if (coupon.status === 'redeemed') {
        return {
          httpStatus: 409,
          code: 'ALREADY_REDEEMED',
          message: '이미 사용된 쿠폰은 취소할 수 없습니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }
      if (coupon.status === 'cancelled') {
        return {
          httpStatus: 400,
          code: 'CANCELLED',
          message: '이미 취소된 쿠폰입니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }
      if (coupon.status === 'expired' || Date.parse(coupon.expiresAt) < Date.now()) {
        coupon.status = 'expired';
        return {
          httpStatus: 410,
          code: 'EXPIRED',
          message: '만료된 쿠폰은 취소할 수 없습니다.',
          coupon: sanitizePublicCoupon(coupon),
        };
      }

      const nowIso = new Date().toISOString();
      coupon.status = 'cancelled';
      coupon.cancelledAt = nowIso;
      coupon.cancelledReason = reason;
      coupon.updatedAt = nowIso;

      db.events.unshift({
        id: `EVT-${Date.now().toString(36).toUpperCase()}-${randomSegment(6)}`,
        couponId: coupon.id,
        eventType: 'cancelled',
        actorId: staff.uid,
        actorName: staff.displayName,
        note: reason,
        createdAt: nowIso,
      });

      return {
        httpStatus: 200,
        code: 'CANCELLED',
        message: '쿠폰이 취소 처리되었습니다.',
        coupon: sanitizePublicCoupon(coupon),
      };
    });

    res.status(outcome.httpStatus).json({
      code: outcome.code,
      message: outcome.message,
      coupon: outcome.coupon,
    });
  });

  // Staff: List coupons, events, and promotion metrics
  app.get('/api/staff/coupons', requireStaffAuth, async (_req, res) => {
    const snapshot = await withDbLock((db) => {
      const now = Date.now();
      let changed = false;
      const coupons = Object.values(db.coupons)
        .map((c) => {
          if (c.status === 'issued' && Date.parse(c.expiresAt) < now) {
            c.status = 'expired';
            c.updatedAt = new Date(now).toISOString();
            changed = true;
          }
          return sanitizePublicCoupon(c);
        })
        .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));

      return {
        changed,
        coupons,
        events: db.events.slice(0, 150),
        analytics: db.analytics,
      };
    }, false);

    if (snapshot.changed) {
      await withDbLock(() => {}, true);
    }

    res.json({
      coupons: snapshot.coupons,
      events: snapshot.events,
      analytics: snapshot.analytics,
    });
  });

  // Admin: List staff members
  app.get('/api/staff/members', requireAdminAuth, (_req, res) => {
    const members = Object.values(dbCache.staff)
      .map((s) => ({
        id: s.id,
        displayName: s.displayName,
        role: s.role,
        active: s.active,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    res.json({ members });
  });

  // Admin: Create or update staff member
  app.post('/api/staff/members', requireAdminAuth, async (req, res) => {
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 80) : '';
    const role: StaffRole = req.body?.role === 'admin' ? 'admin' : 'staff';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const active = req.body?.active !== false;

    if (!/^[a-zA-Z0-9_\-]{2,40}$/.test(id)) {
      res.status(400).json({ message: '직원 아이디는 2~40자의 영문, 숫자, -, _만 사용할 수 있습니다.' });
      return;
    }
    if (!displayName) {
      res.status(400).json({ message: '직원 표시 이름을 입력해 주세요.' });
      return;
    }
    if (!dbCache.staff[id] && passcode.length < 4) {
      res.status(400).json({ message: '신규 직원 비밀번호는 4자 이상 입력해 주세요.' });
      return;
    }

    const member = await withDbLock((db) => {
      const nowIso = new Date().toISOString();
      const existing = db.staff[id];
      const creds = passcode ? hashPasscode(passcode) : null;

      if (existing) {
        existing.displayName = displayName;
        existing.role = role;
        existing.active = active;
        if (creds) {
          existing.passwordSalt = creds.salt;
          existing.passwordHash = creds.hash;
        }
        existing.updatedAt = nowIso;
        return {
          id: existing.id,
          displayName: existing.displayName,
          role: existing.role,
          active: existing.active,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      }

      const created: ServerStaff = {
        id,
        displayName,
        role,
        active,
        passwordSalt: creds!.salt,
        passwordHash: creds!.hash,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.staff[id] = created;
      return {
        id: created.id,
        displayName: created.displayName,
        role: created.role,
        active: created.active,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    });

    res.status(201).json({ member });
  });

  // Admin: Toggle or update staff status
  app.patch('/api/staff/members/:id', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    const id = (req.params.id || '').trim();
    if (!dbCache.staff[id]) {
      res.status(404).json({ message: '직원 계정을 찾을 수 없습니다.' });
      return;
    }
    if (id === req.staffSession!.uid && req.body?.active === false) {
      res.status(400).json({ message: '현재 로그인된 관리자 본인의 계정은 비활성화할 수 없습니다.' });
      return;
    }

    const updated = await withDbLock((db) => {
      const target = db.staff[id];
      if (typeof req.body?.active === 'boolean') target.active = req.body.active;
      if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
        target.displayName = req.body.displayName.trim().slice(0, 80);
      }
      if (req.body?.role === 'admin' || req.body?.role === 'staff') {
        target.role = req.body.role;
      }
      if (typeof req.body?.passcode === 'string' && req.body.passcode.length >= 4) {
        const creds = hashPasscode(req.body.passcode);
        target.passwordSalt = creds.salt;
        target.passwordHash = creds.hash;
      }
      target.updatedAt = new Date().toISOString();
      return {
        id: target.id,
        displayName: target.displayName,
        role: target.role,
        active: target.active,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      };
    });

    res.json({ member: updated });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Icon Cafe server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
