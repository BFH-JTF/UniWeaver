import { ref } from 'vue'
import { getApiBaseUrl } from '@uniweaver/shared'

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

  // The JSON API authenticates via the iron-session cookie (`credentials:
  // 'include'`); there are no token headers to set.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  async function fetchAccess(entity: string, id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${getApiBaseUrl()}/${entity}/${id}/access`, {
        headers,
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
      const res = await fetch(`${getApiBaseUrl()}/${entity}/${id}/access`, {
        method: 'POST',
        headers,
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
      const res = await fetch(`${getApiBaseUrl()}/${entity}/${id}/access/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers,
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
      const res = await fetch(`${getApiBaseUrl()}/${entity}/${id}/access/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers,
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
      const res = await fetch(`${getApiBaseUrl()}/users/search?q=${encodeURIComponent(query)}`, {
        headers,
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