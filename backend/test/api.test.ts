import { startServer } from '../src/index'
import { closeDb } from '../src/db'
import { resetRateLimit, checkRateLimit, recordFailedAttempt } from '../src/auth/bootstrap'
import type { Server } from 'http'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

async function runTests() {
  console.log('Starting UniWeaver backend tests...')
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-must-be-at-least-32-chars-long'

  const server = (await startServer(3456)) as Server
  const baseUrl = 'http://localhost:3456/api'

  try {
    console.log('Testing GET /api/health...')
    const healthRes = await fetch(`${baseUrl}/health`)
    assert(healthRes.status === 200, 'health returns 200')
    const health = (await healthRes.json()) as { status: string; databaseConnected: boolean }
    assert(health.status === 'ok', 'health status is ok')
    assert(health.databaseConnected === true, 'database is connected')

    console.log('Testing GET /api/auth/bootstrap-status...')
    const statusRes = await fetch(`${baseUrl}/auth/bootstrap-status`)
    assert(statusRes.status === 200, 'bootstrap-status returns 200')
    const status = (await statusRes.json()) as { bootstrapRequired: boolean; adminCount: number }
    assert(typeof status.bootstrapRequired === 'boolean', 'bootstrapRequired is boolean')
    assert(typeof status.adminCount === 'number', 'adminCount is number')

    console.log('Testing auth guards on protected routes...')
    const meRes = await fetch(`${baseUrl}/auth/me`, { method: 'POST' })
    assert(meRes.status === 401, 'auth/me returns 401 without session')
    const usersRes = await fetch(`${baseUrl}/users`)
    assert(usersRes.status === 401, 'users list returns 401 without session')
    const sessionRes = await fetch(`${baseUrl}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert(sessionRes.status === 400, 'auth/session without idToken returns 400')
    const badTokenRes = await fetch(`${baseUrl}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'not-a-jwt' }),
    })
    assert(badTokenRes.status === 401, 'auth/session with invalid token returns 401')

    console.log('Testing bootstrap-admin requires an established session...')
    const bootstrapRes = await fetch(`${baseUrl}/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bootstrapSecret: 'whatever' }),
    })
    assert(bootstrapRes.status === 401, 'bootstrap-admin returns 401 without a logged-in session')

    console.log('Testing logout...')
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' })
    assert(logoutRes.status === 200, 'logout returns 200')

    console.log('Testing bootstrap rate limiter isolation...')
    resetRateLimit()
    checkRateLimitHelper()

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (failed > 0) throw new Error('Some tests failed')

    server.close(() => {
      closeDb()
        .catch(() => {})
        .finally(() => process.exit(0))
    })
  } catch (err) {
    console.error('Test execution failed:', err)
    server.close(() => {
      closeDb()
        .catch(() => {})
        .finally(() => process.exit(1))
    })
  }
}

function checkRateLimitHelper() {
  const id = `test_${Date.now()}`
  let allAllowed = true
  for (let i = 0; i < 5; i++) {
    if (!checkRateLimit(id).allowed) allAllowed = false
    recordFailedAttempt(id)
  }
  assert(allAllowed, 'rate limiter allows first 5 attempts')
  assert(checkRateLimit(id).allowed === false, '6th attempt is blocked')
  resetRateLimit(id)
  assert(checkRateLimit(id).allowed, 'rate limiter resets')
}

runTests().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})