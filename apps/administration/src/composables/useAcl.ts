import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export type AccessRole = 'read' | 'write' | 'admin'

export interface EntityAccessEntry {
  table_name: string
  entity_id: string
  user_id: string
  role: AccessRole
  created_at: string
  name?: string
  email?: string
  _canManage?: boolean
}

export interface UserSearchResult {
  id: string
  name: string
  email: string
  is_admin: boolean
  is_active?: boolean
}

export function useAcl() {
  const entries = ref<EntityAccessEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function getApiUrl(): string {
    return (
      localStorage.getItem('uniweaver_pg_api_url') ||
      localStorage.getItem('courseweaver_pg_api_url') ||
      import.meta.env.DATABASE_URL?.replace(/\/+$/, '') ||
      '/api'
    )
  }

  function getHeaders(): Record<string, string> {
    const auth = useAuthStore()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token =
      localStorage.getItem('uniweaver_oidc_access_token') ||
      localStorage.getItem('courseweaver_oidc_access_token') ||
      localStorage.getItem('authToken') ||
      ''
    const idToken =
      localStorage.getItem('uniweaver_oidc_id_token') ||
      localStorage.getItem('courseweaver_oidc_id_token') ||
      ''
    const primaryToken = idToken || token
    if (primaryToken) headers['Authorization'] = `Bearer ${primaryToken}`
    if (idToken) headers['X-ID-Token'] = idToken
    const issuer =
      localStorage.getItem('uniweaver_oidc_issuer') ||
      localStorage.getItem('courseweaver_oidc_issuer') ||
      import.meta.env.OIDC_ISSUER ||
      ''
    if (issuer) headers['X-OIDC-Issuer'] = issuer
    const localUser = auth.localUser
    if (localUser?.id) headers['X-OIDC-Subject'] = localUser.id
    if (localUser?.name) headers['X-OIDC-Name'] = localUser.name
    if (localUser?.email) headers['X-OIDC-Email'] = localUser.email
    return headers
  }

  async function fetchAccess(entity: string, id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${getApiUrl()}/${entity}/${id}/access`, {
        headers: getHeaders(),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      entries.value = await res.json()
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function addUser(entity: string, id: string, userId: string, role: AccessRole): Promise<boolean> {
    try {
      const res = await fetch(`${getApiUrl()}/${entity}/${id}/access`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ userId, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      entries.value = await res.json()
      return true
    } catch (err: any) {
      error.value = err.message
      return false
    }
  }

  async function changeRole(entity: string, id: string, userId: string, role: AccessRole): Promise<boolean> {
    try {
      const res = await fetch(`${getApiUrl()}/${entity}/${id}/access/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      entries.value = await res.json()
      return true
    } catch (err: any) {
      error.value = err.message
      return false
    }
  }

  async function removeUser(entity: string, id: string, userId: string): Promise<boolean> {
    try {
      const res = await fetch(`${getApiUrl()}/${entity}/${id}/access/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      entries.value = await res.json()
      return true
    } catch (err: any) {
      error.value = err.message
      return false
    }
  }

  async function searchUsers(query: string): Promise<UserSearchResult[]> {
    if (!query || query.length < 1) return []
    try {
      const res = await fetch(`${getApiUrl()}/users/search?q=${encodeURIComponent(query)}`, {
        headers: getHeaders(),
        credentials: 'include',
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  return { entries, loading, error, fetchAccess, addUser, changeRole, removeUser, searchUsers }
}