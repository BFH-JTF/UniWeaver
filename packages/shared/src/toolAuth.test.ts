import { describe, expect, it, vi } from 'vitest'
import { createToolAuth } from './toolAuth'

function makeHarness(initResult: boolean) {
  const clearUser = vi.fn()
  const push = vi.fn()
  const store = { initAuth: vi.fn(async () => initResult), clearUser }
  const router = { push }
  const auth = createToolAuth({
    useAuthStore: () => store,
    useRouter: () => router,
    userEntryUrl: () => 'http://portal.example/user_entry',
  })
  return { auth, store, router, clearUser, push }
}

describe('createToolAuth', () => {
  it('ensureAuth returns true and stays on the page when init succeeds', async () => {
    const { auth } = makeHarness(true)
    await expect(auth.ensureAuth()).resolves.toBe(true)
  })

  it('ensureAuth redirects to the portal login with the current path when init fails', async () => {
    const { auth } = makeHarness(false)
    const fakeWindow = { location: { href: '', pathname: '/x' } }
    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('location', fakeWindow.location)
    try {
      await auth.ensureAuth()
      expect(fakeWindow.location.href).toContain('http://portal.example/user_entry/login?redirect=')
      expect(fakeWindow.location.href).toContain(encodeURIComponent('/x'))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('logout clears the user and routes back to /login even when the API call fails', async () => {
    const { auth, clearUser, push } = makeHarness(true)
    // api.logout() would hit the network; the shared api module will throw
    // which must be swallowed by the best-effort teardown.
    await auth.logout()
    expect(clearUser).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/login')
  })
})