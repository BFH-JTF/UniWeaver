import { ApiRequestError, getApiBaseUrl } from '@uniweaver/shared'

export const EntityTables = {
  CURRICULUM: 'curriculums',
  CURRICULUM_VERSION: 'curriculum_versions',
  MODULE: 'modules',
  SEMESTER: 'semesters',
  DEPARTMENT: 'departments',
  PROGRAM: 'programs',
  DEGREE: 'degrees',
  CLASS: 'classes',
} as const

export type EntityTableName = (typeof EntityTables)[keyof typeof EntityTables]

/** Client-side decoration keys that must never be sent to the API: the
 *  backend either maintains them itself (created_by) or stores unknown keys
 *  losslessly in the extra JSONB column, polluting saved rows. */
const CLIENT_ONLY_KEYS = new Set(['_id', '_isAdmin', '_canEdit', '_role', 'createdByName'])

/** The JSON API authenticates via the iron-session cookie (`credentials:
 *  'include'`); there are no token headers to set. */
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { error?: unknown }).error
    throw new ApiRequestError(res.status, typeof message === 'string' ? message : `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function usePostgres() {
  async function fetchEntities<T extends { _id?: string; id?: string }>(tableName: EntityTableName): Promise<T[]> {
    const json = await apiRequest<unknown>(`${getApiBaseUrl()}/${tableName}`)
    const items = Array.isArray(json) ? json : (json as { data?: unknown[] }).data || []
    return (items as any[]).map((item: { id?: string; _id?: string }) => {
      const id = item.id || item._id
      return { ...item, _id: id, id }
    }) as T[]
  }

  async function createEntity<T extends { _id?: string; id?: string; name?: string }>(
    tableName: EntityTableName,
    entity: T
  ): Promise<T> {
    const id = entity.id || entity._id || `uw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const record = {
      ...entity,
      _id: id,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const saved = await apiRequest<any>(`${getApiBaseUrl()}/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(record),
    })
    return { ...record, ...(saved.data || saved), _id: saved.id || saved._id || id, id: saved.id || saved._id || id } as T
  }

  async function updateEntity<T extends { _id?: string; id?: string }>(
    tableName: EntityTableName,
    id: string,
    entity: Partial<T>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...entity }
    for (const key of CLIENT_ONLY_KEYS) delete payload[key]
    await apiRequest(`${getApiBaseUrl()}/${tableName}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    })
  }

  async function removeEntity(tableName: EntityTableName, id: string): Promise<void> {
    await apiRequest(`${getApiBaseUrl()}/${tableName}/${id}`, {
      method: 'DELETE',
    })
  }

  return {
    fetchEntities,
    createEntity,
    updateEntity,
    removeEntity,
  }
}