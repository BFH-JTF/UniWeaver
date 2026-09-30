import { ref } from 'vue'
import type { EntityRestriction, EffectiveRestriction } from '@uniweaver/shared'

const apiUrl = localStorage.getItem('uniweaver_pg_api_url')
  || localStorage.getItem('courseweaver_pg_api_url')
  || import.meta.env.DATABASE_URL
  || 'http://localhost:3000/api'

function restrictionsEndpoint(table: string, entityId: string): string {
  return `${apiUrl.replace(/\/+$/, '')}/${table}/${entityId}/restrictions`
}

async function authedFetch<T>(path: string, init: RequestInit & { auth?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string') {
        message = (body as any).error
      }
    } catch {
      // no JSON body
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export interface RestrictionsOwner {
  /** one of: departments | programs | degrees | modules | classes */
  table: string
  id: string
  name: string
  /** write/edit permission on the owner entity (decorated entity rows carry this) */
  _canEdit?: boolean
}

export function useRestrictions() {
  const { getAuthHeader } = usePostgresAuth()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRestrictions(owner: RestrictionsOwner): Promise<EntityRestriction[]> {
    loading.value = true
    error.value = null
    try {
      return await authedFetch<EntityRestriction[]>(restrictionsEndpoint(owner.table, owner.id), {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        credentials: 'include',
      })
    } catch (e: any) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchEffectiveRestrictions(owner: RestrictionsOwner): Promise<EffectiveRestriction[]> {
    loading.value = true
    error.value = null
    try {
      return await authedFetch<EffectiveRestriction[]>(
        `${restrictionsEndpoint(owner.table, owner.id)}/effective`,
        {
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          credentials: 'include',
        },
      )
    } catch (e: any) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  async function addRestriction(owner: RestrictionsOwner, restriction: Partial<EntityRestriction>): Promise<EntityRestriction | null> {
    loading.value = true
    error.value = null
    try {
      return await authedFetch<EntityRestriction>(restrictionsEndpoint(owner.table, owner.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        credentials: 'include',
        body: JSON.stringify(restriction),
      })
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateRestriction(owner: RestrictionsOwner, restriction: EntityRestriction): Promise<EntityRestriction | null> {
    loading.value = true
    error.value = null
    try {
      return await authedFetch<EntityRestriction>(
        `${restrictionsEndpoint(owner.table, owner.id)}/${restriction.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          credentials: 'include',
          body: JSON.stringify(restriction),
        },
      )
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function removeRestriction(owner: RestrictionsOwner, restrictionId: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await authedFetch(`${restrictionsEndpoint(owner.table, owner.id)}/${restrictionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        credentials: 'include',
      })
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    fetchRestrictions,
    fetchEffectiveRestrictions,
    addRestriction,
    updateRestriction,
    removeRestriction,
  }
}

// The shared auth-header helper lives inside usePostgres; expose a thin
// wrapper so this composable does not instantiate a whole postgres store.
function usePostgresAuth() {
  return {
    getAuthHeader(): Record<string, string> {
      const token =
        localStorage.getItem('uniweaver_oidc_access_token') ||
        localStorage.getItem('courseweaver_oidc_access_token') ||
        localStorage.getItem('authToken') ||
        ''
      const idToken =
        localStorage.getItem('uniweaver_oidc_id_token') ||
        localStorage.getItem('courseweaver_oidc_id_token') ||
        ''
      const issuer =
        localStorage.getItem('uniweaver_oidc_issuer') ||
        localStorage.getItem('courseweaver_oidc_issuer') ||
        import.meta.env.OIDC_ISSUER ||
        ''
      const userJson =
        localStorage.getItem('uniweaver_oidc_user') ||
        localStorage.getItem('courseweaver_oidc_user')
      let userId = ''
      if (userJson) {
        try {
          userId = JSON.parse(userJson).id || ''
        } catch {
          // ignore
        }
      }
      const headers: Record<string, string> = {}
      const primaryToken = idToken || token
      if (primaryToken) headers['Authorization'] = `Bearer ${primaryToken}`
      if (idToken) headers['X-ID-Token'] = idToken
      if (issuer) headers['X-OIDC-Issuer'] = issuer
      if (userId) headers['X-OIDC-Subject'] = userId
      return headers
    },
  }
}