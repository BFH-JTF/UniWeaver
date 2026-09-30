import { ref, computed } from 'vue'

export const PG_STORAGE_KEYS = {
  apiUrl: 'uniweaver_pg_api_url',
  host: 'uniweaver_pg_host',
  port: 'uniweaver_pg_port',
  dbName: 'uniweaver_pg_dbname',
  user: 'uniweaver_pg_user',
} as const

const LEGACY_PG_STORAGE_KEYS = {
  apiUrl: 'courseweaver_pg_api_url',
  host: 'courseweaver_pg_host',
  port: 'courseweaver_pg_port',
  dbName: 'courseweaver_pg_dbname',
  user: 'courseweaver_pg_user',
} as const

export interface PostgresConfig {
  apiUrl: string
  host: string
  port: number
  dbName: string
  user: string
}

export const EntityTables = {
  CURRICULUM_VERSION: 'curriculum_versions',
  MODULE: 'modules',
  SEMESTER: 'semesters',
  LESSON: 'lessons',
  WEEK: 'weeks',
  SCHEDULE_ENTRY: 'schedule_entries',
  ROOM: 'rooms',
  LOCATION: 'locations',
  LECTURER: 'lecturers',
  LECTURER_AVAILABILITY: 'lecturer_availability',
  ROOM_AVAILABILITY: 'room_availability',
  SCHEDULING_RULE: 'scheduling_rules',
  TAXONOMY: 'taxonomy_items',
  COMPETENCY: 'competencies',
  COMPETENCY_MATRIX: 'competency_matrices',
  MATRIX_COMPETENCY: 'matrix_competencies',
  PROOF_OF_COMPETENCY: 'proofs_of_competency',
  DEPARTMENT: 'departments',
  PROGRAM: 'programs',
  DEGREE: 'degrees',
  CLASS: 'classes',
} as const

export type EntityTableName = (typeof EntityTables)[keyof typeof EntityTables]

function getInitialStorage(key: keyof typeof PG_STORAGE_KEYS, fallback: string = ''): string {
  return localStorage.getItem(PG_STORAGE_KEYS[key]) || localStorage.getItem(LEGACY_PG_STORAGE_KEYS[key]) || fallback
}

const apiUrl = ref(getInitialStorage('apiUrl', import.meta.env.DATABASE_URL || 'http://localhost:3000/api'))
const host = ref(getInitialStorage('host', import.meta.env.POSTGRES_HOST || 'localhost'))
const port = ref(parseInt(getInitialStorage('port', String(import.meta.env.POSTGRES_PORT || 5432))))
const dbName = ref(getInitialStorage('dbName', import.meta.env.POSTGRES_DB || 'uniweaver'))
const user = ref(getInitialStorage('user', import.meta.env.POSTGRES_USER || 'uniweaver'))

const isConnected = ref(false)
const dbError = ref<string | null>(null)

const isConfigured = computed(() => !!apiUrl.value || (!!host.value && port.value > 0 && !!dbName.value))

// Local in-memory / localStorage fallback cache when direct REST backend is starting
function getLocalCollectionKey(tableName: string): string {
  return `uw_pg_jsonb_${tableName}`
}

function getLocalEntities<T>(tableName: string): T[] {
  try {
    const raw = localStorage.getItem(getLocalCollectionKey(tableName)) || localStorage.getItem(`cw_pg_jsonb_${tableName}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalEntities<T>(tableName: string, items: T[]): void {
  localStorage.setItem(getLocalCollectionKey(tableName), JSON.stringify(items))
}

export function usePostgres() {
  function getAuthHeader(): Record<string, string> {
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
        const u = JSON.parse(userJson)
        userId = u.id || ''
      } catch {
        // ignore
      }
    }

    const headers: Record<string, string> = {}
    const primaryToken = idToken || token
    if (primaryToken) {
      headers['Authorization'] = `Bearer ${primaryToken}`
    }
    if (idToken) {
      headers['X-ID-Token'] = idToken
    }
    if (issuer) {
      headers['X-OIDC-Issuer'] = issuer
    }
    if (userId) {
      headers['X-OIDC-Subject'] = userId
    }
    return headers
  }

  async function fetchEntities<T extends { _id?: string; id?: string }>(tableName: EntityTableName | string): Promise<T[]> {
    dbError.value = null
    const endpoint = `${apiUrl.value.replace(/\/+$/, '')}/${tableName}`

    try {
      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        credentials: 'include',
      })
      if (res.ok) {
        const json = await res.json()
        const items = Array.isArray(json) ? json : json.data || []
        const normalized = items.map((item: any) => {
          const id = item.id || item._id
          return { ...item, _id: id, id }
        })
        saveLocalEntities(tableName, normalized)
        isConnected.value = true
        return normalized as T[]
      }
      if (res.status === 401 || res.status === 403) {
        // Authentication/authorization problem — never mask it with the
        // localStorage fallback or the user would see stale, misleading data.
        const body = await res.json().catch(() => ({}))
        const message = (body as any).error || `Access denied (${res.status})`
        dbError.value = message
        return []
      }
      dbError.value = `API error ${res.status}`
    } catch {
      // Backend not running or in offline dev mode; fallback to JSONB local storage store
    }

    return getLocalEntities<T>(tableName)
  }

  async function createEntity<T extends { _id?: string; id?: string; name?: string }>(
    tableName: EntityTableName | string,
    entity: T
  ): Promise<T> {
    dbError.value = null
    const id = entity.id || entity._id || `uw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const record = {
      ...entity,
      _id: id,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const endpoint = `${apiUrl.value.replace(/\/+$/, '')}/${tableName}`
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        credentials: 'include',
        body: JSON.stringify(record),
      })
      if (res.ok) {
        const saved = await res.json()
        const savedRecord = { ...record, ...(saved.data || saved), _id: saved.id || saved._id || id, id: saved.id || saved._id || id }
        const local = getLocalEntities<T>(tableName)
        local.push(savedRecord as T)
        saveLocalEntities(tableName, local)
        return savedRecord as T
      }
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        const body = await res.json().catch(() => ({}))
        dbError.value = (body as any).error || `API error ${res.status}`
        throw new Error(dbError.value || 'Request failed')
      }
    } catch (err: any) {
      if (err instanceof Error && dbError.value) throw err
      // Fallback
    }

    const local = getLocalEntities<T>(tableName)
    local.push(record as T)
    saveLocalEntities(tableName, local)
    return record as T
  }

  async function updateEntity<T extends { _id?: string; id?: string }>(
    tableName: EntityTableName | string,
    id: string,
    entity: Partial<T>
  ): Promise<void> {
    dbError.value = null
    const endpoint = `${apiUrl.value.replace(/\/+$/, '')}/${tableName}/${id}`

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        credentials: 'include',
        body: JSON.stringify({
          ...entity,
          updated_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const body = await res.json().catch(() => ({}))
          const message = (body as any).error || `Access denied (${res.status})`
          dbError.value = message
          throw new Error(message)
        }
        console.warn('API update failed, updating local state')
      }
    } catch (err: any) {
      if (err instanceof Error && dbError.value && dbError.value === err.message) throw err
      // Fallback to local
    }

    const local = getLocalEntities<any>(tableName)
    const idx = local.findIndex((item: any) => (item.id === id || item._id === id))
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...entity, id, _id: id, updated_at: new Date().toISOString() }
      saveLocalEntities(tableName, local)
    }
  }

  async function removeEntity(tableName: EntityTableName | string, id: string): Promise<void> {
    dbError.value = null
    const endpoint = `${apiUrl.value.replace(/\/+$/, '')}/${tableName}/${id}`

    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        credentials: 'include',
      })
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        const body = await res.json().catch(() => ({}))
        const message = (body as any).error || `Access denied (${res.status})`
        dbError.value = message
        throw new Error(message)
      }
    } catch (err: any) {
      if (err instanceof Error && dbError.value && dbError.value === err.message) throw err
      // Fallback to local
    }

    const local = getLocalEntities<any>(tableName)
    const filtered = local.filter((item: any) => item.id !== id && item._id !== id)
    saveLocalEntities(tableName, filtered)
  }

  function saveSettings(config: Partial<PostgresConfig>) {
    if (config.apiUrl !== undefined) {
      apiUrl.value = config.apiUrl
      localStorage.setItem(PG_STORAGE_KEYS.apiUrl, config.apiUrl)
    }
    if (config.host !== undefined) {
      host.value = config.host
      localStorage.setItem(PG_STORAGE_KEYS.host, config.host)
    }
    if (config.port !== undefined) {
      port.value = config.port
      localStorage.setItem(PG_STORAGE_KEYS.port, config.port.toString())
    }
    if (config.dbName !== undefined) {
      dbName.value = config.dbName
      localStorage.setItem(PG_STORAGE_KEYS.dbName, config.dbName)
    }
    if (config.user !== undefined) {
      user.value = config.user
      localStorage.setItem(PG_STORAGE_KEYS.user, config.user)
    }
  }

  function clearSettings() {
    apiUrl.value = ''
    host.value = ''
    port.value = 5432
    dbName.value = ''
    user.value = ''
    Object.values(PG_STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    Object.values(LEGACY_PG_STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    Object.values(EntityTables).forEach(tableName => {
      localStorage.removeItem(getLocalCollectionKey(tableName))
      localStorage.removeItem(`cw_pg_jsonb_${tableName}`)
    })
  }

  function loadSettings(): PostgresConfig {
    return {
      apiUrl: apiUrl.value,
      host: host.value,
      port: port.value,
      dbName: dbName.value,
      user: user.value,
    }
  }

  return {
    apiUrl,
    host,
    port,
    dbName,
    user,
    isConfigured,
    isConnected,
    dbError,
    fetchEntities,
    createEntity,
    updateEntity,
    removeEntity,
    saveSettings,
    clearSettings,
    loadSettings,
  }
}
