import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { userEntryUrl } from '../config'

export function useAuth() {
  const router = useRouter()
  const auth = useAuthStore()

  async function ensureAuth(): Promise<boolean> {
    const ok = await auth.initAuth()
    if (!ok) {
      window.location.href = `${userEntryUrl()}/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
    return ok
  }

  async function logout(): Promise<void> {
    await apiSafeLogout()
    auth.clearUser()
    router.push('/login')
  }

  async function apiSafeLogout(): Promise<void> {
    const { api } = await import('@uniweaver/shared')
    try {
      await api.logout()
    } catch {
      // session teardown is best effort
    }
  }

  return { ensureAuth, logout }
}
