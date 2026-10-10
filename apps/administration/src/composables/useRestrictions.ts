import { ref } from 'vue'
import { ApiRequestError, getApiBaseUrl } from '@uniweaver/shared'
import type { EntityRestriction, EffectiveRestriction } from '@uniweaver/shared'

/** The JSON API authenticates via the iron-session cookie (`credentials:
 *  'include'`); there are no token headers to set. */
async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { error?: unknown }).error
    throw new ApiRequestError(res.status, typeof message === 'string' ? message : `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface RestrictionsOwner {
  /** one of: curriculums | departments | programs | degrees | modules | classes */
  table: string
  id: string
  name: string
  /** write/edit permission on the owner entity (decorated entity rows carry this) */
  _canEdit?: boolean
}

export function restrictionsEndpoint(table: string, entityId: string): string {
  return `${getApiBaseUrl()}/${table}/${entityId}/restrictions`
}

export function useRestrictions() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRestrictions(owner: RestrictionsOwner): Promise<EntityRestriction[]> {
    loading.value = true
    error.value = null
    try {
      return await authedFetch<EntityRestriction[]>(restrictionsEndpoint(owner.table, owner.id), {
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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