import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { all, get, getDbPath, initDb, run, transaction } from './db.js'

const app = express()
const port = Number(process.env.PORT ?? 5000)
const host = process.env.HOST ?? '0.0.0.0'
const debugApi = process.env.DEBUG_API === '1'
const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change'
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPasswordHashEnv = process.env.ADMIN_PASSWORD_HASH ?? ''
const adminPasswordEnv = process.env.ADMIN_PASSWORD ?? ''
const isProd = process.env.NODE_ENV === 'production'

const adminPasswordHash = adminPasswordHashEnv
  ? adminPasswordHashEnv
  : adminPasswordEnv
    ? await bcrypt.hash(adminPasswordEnv, 10)
    : await bcrypt.hash('admin123', 10)

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      if (!isProd) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true
  })
)
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

type RateLimitEntry = { count: number; resetAt: number }
type LoginAttempt = { count: number; lockUntil: number; lastAttempt: number }

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 300
const LOGIN_RATE_LIMIT_MAX = 10
const LOGIN_RESET_AFTER_MS = 30 * 60 * 1000
const LOGIN_LOCK_BASE_MS = 60 * 1000
const LOGIN_LOCK_MAX_MS = 30 * 60 * 1000
const ADMIN_2FA_REQUEST_TTL_MS = 5 * 60 * 1000
const ADMIN_2FA_ISSUER = process.env.ADMIN_2FA_ISSUER ?? 'Bits en Bytes'
const ADMIN_2FA_LABEL = process.env.ADMIN_2FA_LABEL ?? 'Admin'

const rateLimitStore = new Map<string, RateLimitEntry>()
const loginAttempts = new Map<string, LoginAttempt>()
const admin2faRequests = new Map<string, { createdAt: number; mode: 'setup' | 'verify' }>()

function getClientIp(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0]!.trim()
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0]!.trim()
  return req.socket.remoteAddress ?? 'unknown'
}

function createRateLimiter(options: { windowMs: number; max: number; keyPrefix: string; keyFn?: (req: express.Request) => string }) {
  const { windowMs, max, keyPrefix, keyFn } = options
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${keyPrefix}:${keyFn ? keyFn(req) : getClientIp(req)}`
    const now = Date.now()
    const entry = rateLimitStore.get(key)
    if (!entry || entry.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({ detail: 'Too many requests, slow down.' })
    }
    entry.count += 1
    return next()
  }
}

function getLoginKey(req: express.Request, identifier: string) {
  const normalized = identifier.trim().toLowerCase() || 'unknown'
  return `${getClientIp(req)}:${normalized}`
}

function getLoginLock(key: string) {
  const entry = loginAttempts.get(key)
  if (!entry) return null
  const now = Date.now()
  if (entry.lockUntil > now) return entry.lockUntil - now
  return null
}

function recordLoginFailure(key: string) {
  const now = Date.now()
  const existing = loginAttempts.get(key)
  if (!existing || now - existing.lastAttempt > LOGIN_RESET_AFTER_MS) {
    loginAttempts.set(key, { count: 1, lockUntil: 0, lastAttempt: now })
    return
  }

  const count = existing.count + 1
  let lockUntil = existing.lockUntil
  if (count >= 5) {
    const exponent = count - 5
    const backoff = Math.min(LOGIN_LOCK_MAX_MS, LOGIN_LOCK_BASE_MS * Math.pow(2, exponent))
    lockUntil = now + backoff
  }

  loginAttempts.set(key, { count, lockUntil, lastAttempt: now })
}

function clearLoginFailures(key: string) {
  loginAttempts.delete(key)
}

function createAdmin2faRequest(mode: 'setup' | 'verify') {
  const requestId = crypto.randomUUID()
  admin2faRequests.set(requestId, { createdAt: Date.now(), mode })
  return requestId
}

function getAdmin2faRequest(requestId: string) {
  const entry = admin2faRequests.get(requestId)
  if (!entry) return null
  if (Date.now() - entry.createdAt > ADMIN_2FA_REQUEST_TTL_MS) {
    admin2faRequests.delete(requestId)
    return null
  }
  return entry
}

function clearAdmin2faRequest(requestId: string) {
  admin2faRequests.delete(requestId)
}

function getAdmin2faConfig() {
  return get<{ secret: string | null; enabled: number | null }>('SELECT secret, enabled FROM admin_2fa WHERE id = 1')
}

function setAdmin2faConfig(secret: string, enabled: number) {
  run(
    `
    INSERT INTO admin_2fa (id, secret, enabled, updated_at)
    VALUES (1, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET secret = excluded.secret, enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
    `,
    [secret, enabled]
  )
}

const apiLimiter = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX, keyPrefix: 'api' })
const loginLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  keyPrefix: 'login',
  keyFn: (req) => {
    const identifier = String(req.body?.identifier ?? '')
    return getLoginKey(req, identifier)
  }
})

app.use('/api', apiLimiter)

app.use((req, _res, next) => {
  const token = req.cookies?.auth_token
  if (!token) return next()
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload
    if (payload && typeof payload === 'object' && payload.role) {
      const parsedId = typeof payload.sub === 'string' ? Number(payload.sub) : undefined
      req.user = {
        id: Number.isFinite(parsedId) ? parsedId : undefined,
        role: payload.role,
        name: String(payload.name ?? 'User'),
        email: payload.email ? String(payload.email) : undefined
      }
    }
  } catch {
    req.user = undefined
  }
  next()
})

initDb()

function toIso(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toDateOnly(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function calculatePoints(workDurationMinutes?: number | null) {
  if (workDurationMinutes == null) return 0
  return workDurationMinutes < 240 ? 1 : 2
}

function addPointsForUser(userId: number, workDurationMinutes?: number | null) {
  const pointsToAdd = calculatePoints(workDurationMinutes)
  if (pointsToAdd <= 0) return
  run('UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?', [pointsToAdd, userId])
}

function logScan(rfidUid: string, action: string, success: boolean, message: string) {
  run(
    `
    INSERT INTO scan_log (rfid_uid, action, success, message)
    VALUES (?, ?, ?, ?)
    `,
    [rfidUid, action, success ? 1 : 0, message]
  )
}

function ensureDepartmentsTable() {
  run(
    `
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    `
  )

  const rows = all<Array<{ department: string | null }>>(
    'SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> \'\''
  )

  for (const row of rows) {
    if (!row.department) continue
    run('INSERT OR IGNORE INTO departments (name) VALUES (?)', [row.department])
  }
}

function ensureProductsTable() {
  run(
    `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    `
  )

  const rows = all<Array<{ product: string | null }>>(
    'SELECT DISTINCT product FROM users WHERE product IS NOT NULL AND product <> \'\''
  )

  for (const row of rows) {
    if (!row.product) continue
    run('INSERT OR IGNORE INTO products (name) VALUES (?)', [row.product])
  }
}

function ensureDepartmentId(name?: string | null) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return null
  run('INSERT OR IGNORE INTO departments (name) VALUES (?)', [trimmed])
  const row = get<{ id: number }>('SELECT id FROM departments WHERE name = ?', [trimmed])
  return row?.id ?? null
}

function ensureProductId(name?: string | null) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return null
  run('INSERT OR IGNORE INTO products (name) VALUES (?)', [trimmed])
  const row = get<{ id: number }>('SELECT id FROM products WHERE name = ?', [trimmed])
  return row?.id ?? null
}

type AuthUser = {
  id?: number
  role: 'admin' | 'user'
  name: string
  email?: string | null
}

function signAuthToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id ? String(user.id) : 'admin',
      role: user.role,
      name: user.name,
      email: user.email ?? null
    },
    jwtSecret,
    { expiresIn: '12h' }
  )
}

function setAuthCookie(res: express.Response, token: string) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 12 * 60 * 60 * 1000
  })
}

function clearAuthCookie(res: express.Response) {
  res.clearCookie('auth_token')
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ detail: 'Authentication required' })
  if (req.user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' })
  return next()
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { identifier, password } = (req.body ?? {}) as { identifier?: string; password?: string }
  if (!identifier || !password) {
    return res.status(400).json({ detail: 'Identifier and password are required' })
  }

  const loginKey = getLoginKey(req, String(identifier))
  const lockMs = getLoginLock(loginKey)
  if (lockMs) {
    const seconds = Math.ceil(lockMs / 1000)
    return res.status(429).json({ detail: `Too many failed attempts. Try again in ${seconds}s.` })
  }

  if (String(identifier).trim().toLowerCase() === adminUsername.toLowerCase()) {
    const ok = await bcrypt.compare(password, adminPasswordHash)
    if (!ok) {
      recordLoginFailure(loginKey)
      return res.status(401).json({ detail: 'Invalid credentials' })
    }

    const config = getAdmin2faConfig();
    if (!config?.secret) {
      // No 2FA secret, trigger setup
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `${ADMIN_2FA_ISSUER}:${ADMIN_2FA_LABEL}`,
        issuer: ADMIN_2FA_ISSUER
      });
      if (!secret.base32 || !secret.otpauth_url) {
        return res.status(500).json({ detail: 'Failed to generate 2FA secret' });
      }
      setAdmin2faConfig(secret.base32, 0);
      const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
      const requestId = createAdmin2faRequest('setup');
      return res.json({ requires2faSetup: true, request_id: requestId, otpauth_url: secret.otpauth_url, qr_data_url: qrDataUrl });
    }

    // 2FA secret exists, require 2FA verification
    const requestId = createAdmin2faRequest('verify');
    return res.json({ requires2fa: true, request_id: requestId });
  }

  const user = get<{ id: number; name: string; email: string | null; password_hash: string | null }>(
    'SELECT id, name, email, password_hash FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [String(identifier).trim()]
  )

  if (!user || !user.password_hash) {
    recordLoginFailure(loginKey)
    return res.status(401).json({ detail: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    recordLoginFailure(loginKey)
    return res.status(401).json({ detail: 'Invalid credentials' })
  }

  const authUser: AuthUser = { id: user.id, role: 'user', name: user.name, email: user.email }
  const token = signAuthToken(authUser)
  setAuthCookie(res, token)
  clearLoginFailures(loginKey)
  return res.json({ user: authUser })
})

app.post('/api/auth/admin-2fa/verify', (req, res) => {
  const { request_id: requestId, code } = (req.body ?? {}) as { request_id?: string; code?: string }
  if (!requestId || !code) return res.status(400).json({ detail: 'Missing request_id or code' })

  const request = getAdmin2faRequest(String(requestId))
  if (!request) return res.status(410).json({ detail: '2FA request expired' })

  const config = getAdmin2faConfig()
  if (!config?.secret) return res.status(400).json({ detail: '2FA not configured' })

  const ok = speakeasy.totp.verify({
    secret: config.secret,
    encoding: 'base32',
    token: String(code),
    window: 1
  })

  if (!ok) return res.status(401).json({ detail: 'Ongeldige 2FA code' })

  if (request.mode === 'setup' && config.enabled !== 1) {
    setAdmin2faConfig(config.secret, 1)
  }

  const user: AuthUser = { role: 'admin', name: 'Administrator' }
  const token = signAuthToken(user)
  setAuthCookie(res, token)
  clearAdmin2faRequest(String(requestId))
  return res.json({ user })
})

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ detail: 'Not authenticated' })
  return res.json({ user: req.user })
})

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res)
  return res.json({ status: 'ok' })
})

app.get('/api/points/me', (req, res) => {
  if (!req.user?.id) return res.status(401).json({ detail: 'Not authenticated' })
  try {
    const row = get<{ id: number; name: string; points: number | null }>(
      'SELECT id, name, points FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!row) return res.status(404).json({ detail: 'User not found' })
    return res.json({ user_id: row.id, user_name: row.name, points: row.points ?? 0 })
  } catch {
    return res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.use('/api', (req, res, next) => {
  const openPaths = new Set(['/scan', '/clock_in_with_signature'])
  if (openPaths.has(req.path)) return next()
  return requireAdmin(req, res, next)
})

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.get('/api/debug/info', (_req, res) => {
  res.json({
    host,
    port,
    sqlite_path: getDbPath(),
    timestamp: new Date().toISOString()
  })
})

app.get('/api/debug/last-attendance/:rfidUid', (req, res) => {
  try {
    const rfidUid = String(req.params.rfidUid).trim().toUpperCase()
    const row = get<{
      id: number
      date: string
      clock_in: string | null
      clock_out: string | null
      status: string
      work_duration: number | null
      signature_data: string | null
      name: string
      department: string | null
    }>(
      `
      SELECT
        a.id,
        a.date,
        a.clock_in,
        a.clock_out,
        a.status,
        a.work_duration,
        a.signature_data,
        u.name,
        u.department
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.rfid_uid = ?
      ORDER BY a.date DESC, a.clock_in DESC
      LIMIT 1
      `,
      [rfidUid]
    )

    if (!row) return res.status(404).json({ detail: 'No attendance record found' })

    res.json({
      ...row,
      date: toDateOnly(row.date),
      clock_in: toIso(row.clock_in),
      clock_out: toIso(row.clock_out)
    })
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/debug/attendance/:rfidUid', (req, res) => {
  try {
    const rfidUid = String(req.params.rfidUid).trim().toUpperCase()
    const user = get<{ id: number; name: string }>('SELECT id, name FROM users WHERE rfid_uid = ?', [rfidUid])

    if (!user) return res.status(404).json({ detail: 'User not found' })

    const rows = all<
      Array<{
        id: number
        date: string
        clock_in: string | null
        clock_out: string | null
        status: string
        work_duration: number | null
        signature_data: string | null
      }>
    >(
      `
      SELECT id, date, clock_in, clock_out, status, work_duration, signature_data
      FROM attendance
      WHERE user_id = ?
      ORDER BY date DESC, clock_in DESC
      LIMIT 10
      `,
      [user.id]
    )

    res.json({
      user_id: user.id,
      user_name: user.name,
      rows: rows.map((row) => ({
        ...row,
        date: toDateOnly(row.date),
        clock_in: toIso(row.clock_in),
        clock_out: toIso(row.clock_out)
      }))
    })
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/debug/user/:rfidUid', (req, res) => {
  try {
    const rfidUid = String(req.params.rfidUid).trim().toUpperCase()
    const user = get<{
      id: number
      rfid_uid: string
      name: string
      department: string | null
      active: number | null
    }>('SELECT id, rfid_uid, name, department, active FROM users WHERE rfid_uid = ?', [rfidUid])

    if (!user) return res.status(404).json({ detail: 'User not found' })

    res.json(user)
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/debug/scan-log', (req, res) => {
  try {
    const limit = Math.min(Number(req.query?.limit ?? 25), 200)
    const rows = all<
      Array<{
        id: number
        rfid_uid: string
        scan_time: string
        action: string | null
        success: number | null
        message: string | null
      }>
    >(
      `
      SELECT id, rfid_uid, scan_time, action, success, message
      FROM scan_log
      ORDER BY id DESC
      LIMIT ?
      `,
      [limit]
    )

    res.json(
      rows.map((row) => ({
        ...row,
        scan_time: toIso(row.scan_time)
      }))
    )
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/user-points/id/:userId', (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const user = get<{ id: number; name: string; points: number | null }>(
      'SELECT id, name, points FROM users WHERE id = ?',
      [userId]
    )

    if (!user) return res.status(404).json({ detail: 'User not found' })

    res.json({ user_id: user.id, user_name: user.name, points: user.points ?? 0 })
  } catch (error) {
    if (res.headersSent) return
    res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.post('/api/update-points', (req, res) => {
  try {
    const { user_id: userId, user_name: userName, work_duration_minutes: workDuration } = req.body ?? {}

    if (workDuration == null) return res.status(400).json({ detail: 'Missing work_duration_minutes' })
    if (!userId && !userName) return res.status(400).json({ detail: 'Missing user_id or user_name' })

    const user = get<{ id: number }>(
      userId ? 'SELECT id FROM users WHERE id = ?' : 'SELECT id FROM users WHERE name = ?',
      [userId ?? userName]
    )

    if (!user) return res.status(404).json({ detail: 'User not found' })

    addPointsForUser(user.id, Number(workDuration))
    res.json({ success: true, message: 'Points updated' })
  } catch (error) {
    res.status(500).json({ detail: 'Failed to update points' })
  }
})

app.post('/api/scan', (req, res) => {
  const { rfid_uid: rfidUidRaw } = req.body ?? {}
  if (!rfidUidRaw) return res.status(400).json({ detail: 'Missing rfid_uid' })

  const rfidUid = String(rfidUidRaw).trim().toUpperCase()
  if (debugApi) {
    console.log(`[scan] rfid_uid=${rfidUid} db=${getDbPath()}`)
  }

  try {
    const user = get<{ id: number; name: string; department: string | null }>(
      'SELECT * FROM users WHERE rfid_uid = ? AND active = 1',
      [rfidUid]
    )

    if (!user) {
      logScan(rfidUid, 'unknown', false, 'User not found')
      return res.status(404).json({ detail: 'RFID card not registered' })
    }

    const attendance = get<{ id: number; status: string }>(
      `
      SELECT * FROM attendance
      WHERE user_id = ? AND date = date('now')
      ORDER BY id DESC LIMIT 1
      `,
      [user.id]
    )

    if (!attendance || attendance.status === 'clocked_out') {
      const message = `Welcome ${user.name}! Please sign to clock in.`
      logScan(rfidUid, 'clock_in', true, message)
      return res.json({
        success: true,
        action: 'clock_in',
        message,
        user: { name: user.name, department: user.department },
        timestamp: new Date().toISOString()
      })
    }

    run(
      `
      UPDATE attendance
      SET clock_out = datetime('now'),
          status = 'clocked_out',
          work_duration = CAST((julianday('now') - julianday(clock_in)) * 1440 AS INTEGER)
      WHERE id = ?
      `,
      [attendance.id]
    )

    const durationRow = get<{ work_duration: number | null }>('SELECT work_duration FROM attendance WHERE id = ?', [
      attendance.id
    ])

    const workDuration = durationRow?.work_duration ?? 0
    if (workDuration >= 0) {
      addPointsForUser(user.id, workDuration)
    }

    const message = `Goodbye ${user.name}! Clocked out successfully.`
    logScan(rfidUid, 'clock_out', true, message)
    return res.json({
      success: true,
      action: 'clock_out',
      message,
      user: { name: user.name, department: user.department },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[scan] error', error)
    if (res.headersSent) return
    return res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.get('/api/status/:rfidUid', (req, res) => {
  try {
    const rfidUid = String(req.params.rfidUid).toUpperCase()
    const status = get<{
      name: string
      status: string
      clock_in: string | null
      clock_out: string | null
      minutes_worked: number | null
    }>(
      `
      SELECT
        u.name,
        a.status,
        a.clock_in,
        a.clock_out,
        CASE
          WHEN a.status = 'clocked_in' THEN CAST((julianday('now') - julianday(a.clock_in)) * 1440 AS INTEGER)
          ELSE a.work_duration
        END AS minutes_worked
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND a.date = date('now')
      WHERE u.rfid_uid = ? AND u.active = 1
      `,
      [rfidUid]
    )

    if (!status) return res.status(404).json({ detail: 'User not found' })

    res.json({
      name: status.name,
      status: status.status,
      clock_in: toIso(status.clock_in),
      clock_out: toIso(status.clock_out),
      minutes_worked: status.minutes_worked
    })
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/users', (_req, res) => {
  try {
    const rows = all('SELECT id, rfid_uid, name, email, department, product, points, active FROM users')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.put('/api/users/:userId/password', async (req, res) => {
  const password = String(req.body?.password ?? '')
  if (!password || password.length < 8) {
    return res.status(400).json({ detail: 'Password must be at least 8 characters' })
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    const result = run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, Number(req.params.userId)])
    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.get('/api/points', (_req, res) => {
  try {
    const rows = all('SELECT id, name, department, product, points FROM users WHERE active = 1 ORDER BY name')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.put('/api/points/:userId', (req, res) => {
  const points = Number(req.body?.points)
  if (Number.isNaN(points) || points < 0) return res.status(400).json({ detail: 'Points must be 0 or higher' })

  try {
    const result = run('UPDATE users SET points = ? WHERE id = ?', [points, Number(req.params.userId)])

    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.get('/api/floorplan', (_req, res) => {
  try {
    const row = get<{ data: string; updated_at: string | null }>('SELECT data, updated_at FROM floorplan_layout WHERE id = 1')

    if (!row) return res.json({ data: null, updated_at: null })

    let payload: unknown = null
    try {
      payload = row.data ? JSON.parse(row.data) : null
    } catch {
      payload = null
    }

    res.json({ data: payload, updated_at: toIso(row.updated_at) })
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.put('/api/floorplan', (req, res) => {
  const data = req.body
  if (data == null) return res.status(400).json({ detail: 'Missing floorplan data' })

  try {
    const payload = JSON.stringify(data)
    run(
      `
      INSERT INTO floorplan_layout (id, data)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `,
      [payload]
    )

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.post('/api/clock_in_with_signature', (req, res) => {
  const { rfid_uid: rfidUidRaw, signature } = req.body ?? {}
  const rfidUid = String(rfidUidRaw ?? '').trim().toUpperCase()
  const signatureData = signature

  if (debugApi) {
    const sigLength = typeof signatureData === 'string' ? signatureData.length : 0
    console.log(`[clock_in_with_signature] rfid_uid=${rfidUid} sig_len=${sigLength} db=${getDbPath()}`)
  }

  if (!rfidUid) return res.status(400).json({ detail: 'Missing rfid_uid' })

  try {
    const user = get<{ id: number; name: string; department: string | null }>(
      'SELECT * FROM users WHERE rfid_uid = ? AND active = 1',
      [rfidUid]
    )

    if (!user) {
      return res.status(404).json({ detail: 'User not found' })
    }

    const existing = get<{ id: number }>(
      `
      SELECT * FROM attendance
      WHERE user_id = ? AND date = date('now') AND status = 'clocked_in'
      `,
      [user.id]
    )

    if (existing) {
      return res.status(400).json({ detail: 'Already clocked in today' })
    }

    const insertResult = run(
      `
      INSERT INTO attendance (user_id, clock_in, date, status, signature_data)
      VALUES (?, datetime('now'), date('now'), 'clocked_in', ?)
      `,
      [user.id, signatureData]
    )

    if (debugApi) {
      console.log(`[clock_in_with_signature] insert changes=${insertResult.changes} id=${insertResult.lastInsertRowid}`)
    }

    logScan(rfidUid, 'clock_in_with_signature', true, 'Clocked in with signature')

    return res.json({
      success: true,
      message: `Welcome ${user.name}! Clocked in successfully.`,
      user: { name: user.name, department: user.department },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[clock_in_with_signature] error', error)
    if (res.headersSent) return
    return res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.post('/api/users', async (req, res) => {
  const { rfid_uid: rfidUidRaw, name, email, department, password } = req.body ?? {}
  const rfidUid = String(rfidUidRaw ?? '').trim().toUpperCase()

  if (!rfidUid || !name) return res.status(400).json({ detail: 'Missing required fields' })
  if (password && String(password).length < 8) {
    return res.status(400).json({ detail: 'Password must be at least 8 characters' })
  }

  try {
    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null
    const departmentId = ensureDepartmentId(department)
    const result = run(
      'INSERT INTO users (rfid_uid, name, email, department, department_id, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [rfidUid, name, email ?? null, department ?? null, departmentId, passwordHash]
    )

    res.json({ success: true, message: 'User added successfully', user_id: result.lastInsertRowid })
  } catch (error) {
    res.status(400).json({ detail: String(error) })
  }
})

app.delete('/api/users', (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ detail: 'ids must be a non-empty list' })

  try {
    const placeholders = ids.map(() => '?').join(',')
    const result = run(`DELETE FROM users WHERE id IN (${placeholders})`, ids)

    res.json({ success: true, deleted_count: result.changes ?? 0 })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.get('/api/attendance/today', (_req, res) => {
  try {
    const rows = all<
      Array<{
        name: string
        department: string | null
        product: string | null
        clock_in: string | null
        clock_out: string | null
        status: string
        work_duration: number | null
      }>
    >(
      `
      SELECT
        u.name,
        u.department,
        u.product,
        a.clock_in,
        a.clock_out,
        a.status,
        a.work_duration
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.date = date('now')
      ORDER BY a.clock_in DESC
      `
    )

    res.json(
      rows.map((record) => ({
        ...record,
        clock_in: toIso(record.clock_in),
        clock_out: toIso(record.clock_out)
      }))
    )
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.post('/api/attendance_last_30', (req, res) => {
  const rfidUid = String(req.body?.rfid_uid ?? '').trim().toUpperCase()
  if (!rfidUid) return res.status(400).json({ detail: 'Missing rfid_uid' })

  try {
    const user = get<{ id: number }>('SELECT id FROM users WHERE rfid_uid = ? AND active = 1', [rfidUid])

    if (!user) return res.status(404).json({ detail: 'User not found' })

    const rows = all<Array<{ date: string }>>(
      `
      SELECT DISTINCT a.date
      FROM attendance a
      WHERE a.user_id = ?
        AND a.date >= date('now', '-30 day')
      ORDER BY a.date DESC
      `,
      [user.id]
    )

    res.json({
      success: true,
      rfid_uid: rfidUid,
      dates: rows.map((row) => toDateOnly(row.date)).filter(Boolean)
    })
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/attendance/filter', (req, res) => {
  try {
    const { user_id, department, start_date, end_date, product } = req.query
    const params: Array<string | number> = []

    let queryText =
      'SELECT a.id, a.date, u.name, u.department, u.product, a.clock_in, a.clock_out, a.work_duration, a.status, a.signature_data ' +
      'FROM attendance a JOIN users u ON a.user_id = u.id WHERE 1=1'

    if (user_id) {
      queryText += ' AND a.user_id = ?'
      params.push(Number(user_id))
    }
    if (department) {
      queryText += ' AND u.department = ?'
      params.push(String(department))
    }
    if (product) {
      queryText += ' AND u.product = ?'
      params.push(String(product))
    }
    if (start_date) {
      queryText += ' AND a.date >= ?'
      params.push(String(start_date))
    }
    if (end_date) {
      queryText += ' AND a.date <= ?'
      params.push(String(end_date))
    }

    queryText += ' ORDER BY a.date DESC, a.clock_in DESC'

    const rows = all<
      Array<{
        id: number
        date: string
        name: string
        department: string | null
        product: string | null
        clock_in: string | null
        clock_out: string | null
        work_duration: number | null
        status: string
        signature_data: string | null
      }>
    >(queryText, params)

    res.json(
      rows.map((record) => ({
        ...record,
        date: toDateOnly(record.date),
        clock_in: toIso(record.clock_in),
        clock_out: toIso(record.clock_out)
      }))
    )
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.get('/api/attendance/all', (_req, res) => {
  try {
    const rows = all<
      Array<{
        id: number
        date: string
        name: string
        department: string | null
        product: string | null
        clock_in: string | null
        clock_out: string | null
        status: string
        work_duration: number | null
        signature_data: string | null
      }>
    >(
      `
      SELECT
        a.id,
        a.date,
        u.name,
        u.department,
        u.product,
        a.clock_in,
        a.clock_out,
        a.status,
        a.work_duration,
        a.signature_data
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.date DESC, a.clock_in DESC
      LIMIT 100
      `
    )

    res.json(
      rows.map((record) => ({
        ...record,
        date: toDateOnly(record.date),
        clock_in: toIso(record.clock_in),
        clock_out: toIso(record.clock_out)
      }))
    )
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.post('/api/attendance/manual', (req, res) => {
  try {
    const { user_id, date, clock_in, clock_out, signature_data } = req.body ?? {}
    if (!user_id || !date || !clock_in || !signature_data) {
      return res.status(400).json({ detail: 'Missing required fields' })
    }

    const user = get<{ id: number; name: string }>('SELECT id, name FROM users WHERE id = ? AND active = 1', [
      Number(user_id)
    ])

    if (!user) return res.status(404).json({ detail: 'User not found' })

    const dateOnly = String(date).length === 10 ? String(date) : String(date).split('T')[0]
    const clockInDate = new Date(String(clock_in))
    const clockOutDate = clock_out ? new Date(String(clock_out)) : null

    if (Number.isNaN(clockInDate.getTime()) || (clockOutDate && Number.isNaN(clockOutDate.getTime()))) {
      return res.status(400).json({ detail: 'Invalid date/time format' })
    }

    const status = clockOutDate ? 'clocked_out' : 'clocked_in'
    let workDuration: number | null = null

    if (clockOutDate) {
      workDuration = Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 60000)
    }

    const result = run(
      `
      INSERT INTO attendance (user_id, date, clock_in, clock_out, status, work_duration, signature_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [Number(user_id), dateOnly, clockInDate.toISOString(), clockOutDate?.toISOString() ?? null, status, workDuration, signature_data]
    )

    if (workDuration != null && workDuration >= 0) {
      addPointsForUser(Number(user_id), workDuration)
    }

    res.json({ success: true, message: `Attendance record created for ${user.name}`, id: result.lastInsertRowid })
  } catch (error) {
    res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.post('/api/attendance/delete', (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ detail: 'No records to delete' })

  try {
    const placeholders = ids.map(() => '?').join(',')
    const result = run(`DELETE FROM attendance WHERE id IN (${placeholders})`, ids)

    res.json({
      success: true,
      message: `Deleted ${result.changes ?? 0} attendance record(s)`,
      deleted_count: result.changes ?? 0
    })
  } catch (error) {
    res.status(500).json({ detail: 'Database operation failed' })
  }
})

app.get('/api/departments', (_req, res) => {
  try {
    ensureDepartmentsTable()
    const rows = all<Array<{ id: number; name: string }>>('SELECT id, name FROM departments ORDER BY name ASC')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.post('/api/departments', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ detail: 'Missing department name' })

  try {
    ensureDepartmentsTable()
    const result = run('INSERT OR IGNORE INTO departments (name) VALUES (?)', [name])
    if ((result.changes ?? 0) === 0) {
      return res.status(409).json({ detail: 'Organisatie bestaat al' })
    }
    res.json({ success: true, id: result.lastInsertRowid, name })
  } catch (error) {
    res.status(400).json({ detail: String(error) })
  }
})

app.delete('/api/departments/:deptId', (req, res) => {
  const deptId = Number(req.params.deptId)

  try {
    ensureDepartmentsTable()
    const row = get<{ name: string }>('SELECT name FROM departments WHERE id = ?', [deptId])
    if (!row) return res.status(404).json({ detail: 'Department not found' })

    run('UPDATE users SET department = NULL WHERE department = ?', [row.name])
    const result = run('DELETE FROM departments WHERE id = ?', [deptId])

    res.json({ success: true, users_cleared: result.changes ?? 0 })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.get('/api/products', (_req, res) => {
  try {
    ensureProductsTable()
    const rows = all<Array<{ id: number; name: string }>>('SELECT id, name FROM products ORDER BY name ASC')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ detail: 'Database connection failed' })
  }
})

app.post('/api/products', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ detail: 'Missing product name' })

  try {
    ensureProductsTable()
    const result = run('INSERT INTO products (name) VALUES (?)', [name])
    res.json({ success: true, id: result.lastInsertRowid, name })
  } catch (error) {
    res.status(400).json({ detail: String(error) })
  }
})

app.delete('/api/products/:productId', (req, res) => {
  const productId = Number(req.params.productId)

  try {
    ensureProductsTable()
    const row = get<{ name: string }>('SELECT name FROM products WHERE id = ?', [productId])
    if (!row) return res.status(404).json({ detail: 'Product not found' })

    run('UPDATE users SET product = NULL WHERE product = ?', [row.name])
    const result = run('DELETE FROM products WHERE id = ?', [productId])

    res.json({ success: true, users_cleared: result.changes ?? 0 })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.put('/api/users/:userId/department', (req, res) => {
  let department = req.body?.department
  if (department != null) {
    department = String(department).trim()
    if (department === '') department = null
  }

  try {
    const departmentId = ensureDepartmentId(department)
    const result = run('UPDATE users SET department = ?, department_id = ? WHERE id = ?', [
      department,
      departmentId,
      Number(req.params.userId)
    ])

    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.put('/api/users/:userId/product', (req, res) => {
  let product = req.body?.product
  if (product != null) {
    product = String(product).trim()
    if (product === '') product = null
  }

  try {
    const productId = ensureProductId(product)
    const result = run('UPDATE users SET product = ?, product_id = ? WHERE id = ?', [
      product,
      productId,
      Number(req.params.userId)
    ])

    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.put('/api/users/:userId/uid', (req, res) => {
  const newUid = String(req.body?.rfid_uid ?? '').trim().toUpperCase()
  if (!newUid) return res.status(400).json({ detail: 'Missing rfid_uid' })

  try {
    const dup = get<{ id: number }>('SELECT id FROM users WHERE rfid_uid = ? AND id != ?', [
      newUid,
      Number(req.params.userId)
    ])

    if (dup) return res.status(400).json({ detail: 'RFID UID already in use' })

    const result = run('UPDATE users SET rfid_uid = ? WHERE id = ?', [newUid, Number(req.params.userId)])

    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.put('/api/users/:userId', (req, res) => {
  const payload = req.body ?? {}
  const updates: Record<string, string | null> = {}
  const idUpdates: Record<string, number | null> = {}

  for (const key of ['name', 'email', 'department', 'rfid_uid'] as const) {
    const value = payload[key]
    if (value != null) {
      updates[key] = typeof value === 'string' ? value.trim() : value
    }
  }

  if (updates.department !== undefined) {
    idUpdates.department_id = ensureDepartmentId(updates.department)
  }

  if (!Object.keys(updates).length) return res.status(400).json({ detail: 'No valid fields to update' })

  if (updates.rfid_uid) updates.rfid_uid = updates.rfid_uid.toUpperCase()

  const setParts = [
    ...Object.keys(updates).map((key) => `${key} = ?`),
    ...Object.keys(idUpdates).map((key) => `${key} = ?`)
  ]
  const params = [...Object.values(updates), ...Object.values(idUpdates), Number(req.params.userId)]

  try {
    const result = run(`UPDATE users SET ${setParts.join(', ')} WHERE id = ?`, params)

    if (result.changes === 0) return res.status(404).json({ detail: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ detail: String(error) })
  }
})

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`)
})
