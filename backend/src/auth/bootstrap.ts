import crypto from 'crypto'

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length === 0 || b.length === 0) return false
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest()
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

interface RateLimitRecord {
  attempts: number
  firstAttemptTime: number
  blockedUntil?: number
}

const store = new Map<string, RateLimitRecord>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const record = store.get(identifier)
  if (!record) return { allowed: true }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) }
  }
  if (now - record.firstAttemptTime > WINDOW_MS) {
    store.delete(identifier)
    return { allowed: true }
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) }
  }
  return { allowed: true }
}

export function recordFailedAttempt(identifier: string): void {
  const now = Date.now()
  const record = store.get(identifier)
  if (!record || now - record.firstAttemptTime > WINDOW_MS) {
    store.set(identifier, { attempts: 1, firstAttemptTime: now })
    return
  }
  record.attempts += 1
  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS
  }
}

export function resetRateLimit(identifier?: string): void {
  if (identifier) {
    store.delete(identifier)
  } else {
    store.clear()
  }
}