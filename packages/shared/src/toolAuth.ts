import { api } from './api'
/**
 * Shared auth guard for the three tool SPAs. The logic was previously
 * copy-pasted identically into administration/scheduling/competencies; the
 * per-app pieces (Pinia store, router, config) are injected here.
 */
export interface ToolAuthOptions {
  /** The app's auth store factory (Pinia). */
  useAuthStore: () => {
    initAuth(): Promise<boolean>
    clearUser(): void
  }
  /** The app's router factory (vue-router). */
  useRouter: () => {
    push(to: string): Promise<unknown> | void
  }
  /** Portal base URL (used to bounce unauthenticated users to the login). */
  userEntryUrl: () => string
}

export function createToolAuth(options: ToolAuthOptions) {
  const auth = options.useAuthStore()
  const router = options.useRouter()

  /** True when a session exists; otherwise redirects to the portal login. */
  async function ensureAuth(): Promise<boolean> {
    const ok = await auth.initAuth()
    if (!ok) {
      window.location.href = `${options.userEntryUrl()}/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
    return ok
  }

  /** Best-effort API logout, clears the local user, back to login page. */
  async function logout(): Promise<void> {
    await apiSafeLogout()
    auth.clearUser()
    router.push('/login')
  }

  async function apiSafeLogout(): Promise<void> {
    try {
      await api.logout()
    } catch {
      // session teardown is best effort
    }
  }

  return { ensureAuth, logout }
}