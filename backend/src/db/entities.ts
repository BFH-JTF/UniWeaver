import type { Pool } from 'pg'

export type EntityKind = 'audited' | 'shared'

export interface ColumnSpec {
  column: string
  camel: string
  aliases?: string[]
  json?: boolean
  numeric?: boolean
}

export interface TableSpec {
  dbTable: string
  kind: EntityKind
  /** camel key in the payload that carries the parent entity ids (audited tables only) */
  parentKey?: string
  parentTable?: 'departments' | 'programs' | 'degrees' | 'curriculums'
  parentLabel?: string
  columns: ColumnSpec[]
  nameRequired?: boolean
  /** camel keys of columns that must be non-empty on create and cannot be cleared on update */
  requiredColumns?: string[]
}

export class EntityHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const URL_COL: ColumnSpec = { column: 'url', camel: 'url', aliases: ['URL'] }

function col(column: string, camel: string, aliases?: string[]): ColumnSpec {
  return { column, camel, aliases }
}

function jsonCol(column: string, camel: string, aliases?: string[]): ColumnSpec {
  return { column, camel, aliases, json: true }
}

function numCol(column: string, camel: string): ColumnSpec {
  return { column, camel, numeric: true }
}

/**
 * `audited` tables keep unmapped payload keys in an `extra` JSONB column, so
 * lossless round-trips stay possible while the relational columns below are
 * the authoritative projection. `shared` tables only store mapped columns.
 */
export const TABLE_SPECS: Record<string, TableSpec> = {
  departments: {
    dbTable: 'departments',
    kind: 'audited',
    nameRequired: true,
    columns: [col('name', 'name'), col('description', 'description'), col('contact', 'contact'), URL_COL],
  },
  lecturers: {
    dbTable: 'lecturers',
    kind: 'audited',
    nameRequired: true,
    parentKey: 'departmentId',
    parentTable: 'departments',
    parentLabel: 'department',
    columns: [
      col('name', 'name'),
      col('user_id', 'userId'),
      col('department_id', 'departmentId'),
      col('contact', 'contact'),
      URL_COL,
    ],
  },
  programs: {
    dbTable: 'programs',
    kind: 'audited',
    nameRequired: true,
    columns: [
      col('name', 'name'),
      col('description', 'description'),
      jsonCol('department_ids', 'departmentIds', ['departmentIDs']),
      col('curriculum_id', 'curriculumId'),
      col('contact', 'contact'),
      URL_COL,
    ],
  },
  degrees: {
    dbTable: 'degrees',
    kind: 'audited',
    nameRequired: true,
    parentKey: 'programIds',
    parentTable: 'programs',
    parentLabel: 'program',
    columns: [
      col('name', 'name'),
      col('description', 'description'),
      jsonCol('program_ids', 'programIds', ['programIDs', 'ProgramIDs']),
      col('contact', 'contact'),
      URL_COL,
    ],
  },
  modules: {
    dbTable: 'modules',
    kind: 'audited',
    nameRequired: true,
    parentKey: 'degreeIds',
    parentTable: 'degrees',
    parentLabel: 'degree',
    columns: [
      col('name', 'name'),
      col('code', 'code'),
      col('description', 'description'),
      jsonCol('degree_ids', 'degreeIds', ['degreeIDs', 'DegreeIDs']),
      col('curriculum_version_id', 'curriculumVersionId'),
      jsonCol('competency_ids', 'competencyIds'),
      jsonCol('proof_ids', 'proofOfCompetencyIds', ['proofIds']),
      numCol('credit_points', 'creditPoints'),
      numCol('timeslots', 'timeslots'),
      col('contact', 'contact'),
      URL_COL,
    ],
  },
  classes: {
    dbTable: 'class_entities',
    kind: 'audited',
    nameRequired: true,
    columns: [
      col('name', 'name'),
      col('code', 'code'),
      col('description', 'description'),
      col('semester_id', 'semesterId'),
      col('curriculum_version_id', 'curriculumVersionId'),
      col('degree_id', 'degreeId'),
      jsonCol('module_ids', 'moduleIds'),
      numCol('size', 'size'),
      col('contact', 'contact'),
      URL_COL,
    ],
  },
  semesters: {
    dbTable: 'semesters',
    kind: 'shared',
    columns: [
      col('name', 'name'),
      col('code', 'code'),
      col('start_date', 'startDate'),
      col('end_date', 'endDate'),
      numCol('slot_duration_minutes', 'slotDurationMinutes'),
      jsonCol('slot_start_times', 'slotStartTimes'),
    ],
  },
  curriculums: {
    dbTable: 'curriculums',
    kind: 'audited',
    nameRequired: true,
    columns: [
      col('name', 'name'),
      col('description', 'description'),
      col('active_version_id', 'activeVersionId'),
    ],
  },
  curriculum_versions: {
    dbTable: 'curriculum_versions',
    kind: 'shared',
    nameRequired: true,
    parentKey: 'curriculumId',
    parentTable: 'curriculums',
    parentLabel: 'curriculum',
    requiredColumns: ['semesterId'],
    columns: [
      col('name', 'name'),
      col('description', 'description'),
      numCol('version_number', 'versionNumber'),
      col('semester_id', 'semesterId'),
      col('curriculum_id', 'curriculumId'),
      col('created_by', 'createdBy'),
    ],
  },
}

export function genEntityId(): string {
  return `uw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function firstDefined(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (payload[key] !== undefined) return payload[key]
  }
  return undefined
}

function keyChain(c: ColumnSpec): string[] {
  return [c.camel, ...(c.aliases ?? [])]
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function toIntOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export interface RowPayload {
  row: Record<string, unknown>
  extra: Record<string, unknown>
  parentIds: string[]
}

/**
 * Splits an API payload into relational column values and an `extra` bag that
 * holds every unmapped key losslessly. Historical alias spellings are synced
 * into the relational column but never land in `extra` (the camelCase key is
 * authoritative on read).
 */
export function payloadToRowPayload(spec: TableSpec, payload: Record<string, unknown>): RowPayload {
  const row: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  const reserved = new Set<string>(['id', '_id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'])
  for (const c of spec.columns) {
    for (const key of keyChain(c)) reserved.add(key)
  }

  for (const c of spec.columns) {
    const raw = firstDefined(payload, keyChain(c))
    if (raw === undefined) continue
    if (c.json) {
      row[c.column] = JSON.stringify(Array.isArray(raw) ? raw : [])
    } else if (c.numeric) {
      row[c.column] = toIntOrNull(raw)
    } else {
      row[c.column] = toText(raw)
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('_') || reserved.has(key)) continue
    if (value === undefined) continue
    extra[key] = value
  }

  let parentIds: string[] = []
  if (spec.parentKey) {
    const raw = firstDefined(payload, keyChain(spec.columns.find(c => c.camel === spec.parentKey)!))
    if (Array.isArray(raw)) parentIds = raw.map(String).filter(id => id.length > 0)
  }

  return { row, extra, parentIds }
}

export function rowToEntity(spec: TableSpec, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row.id }
  for (const c of spec.columns) {
    const value = row[c.column]
    if (value === null || value === undefined) {
      if (c.json) out[c.camel] = []
      continue
    }
    out[c.camel] = value instanceof Date ? value.toISOString() : value
  }
  if (row.extra && typeof row.extra === 'object') {
    for (const [key, value] of Object.entries(row.extra as Record<string, unknown>)) {
      out[key] = value
    }
  }
  for (const [src, dst] of [['created_at', 'createdAt'], ['updated_at', 'updatedAt']] as const) {
    const value = row[src]
    if (value instanceof Date) out[src] = value.toISOString()
    if (value instanceof Date) out[dst] = value.toISOString()
  }
  return out
}

export function entityParentIds(spec: TableSpec, row: Record<string, unknown>): string[] {
  if (!spec.parentKey) return []
  const colName = spec.columns.find(c => c.camel === spec.parentKey)?.column
  if (!colName) return []
  const value = row[colName]
  return Array.isArray(value) ? value.map(String) : []
}

/** Validates the referenced parent rows exist and that the user admins them all. */
export async function assertAdminOfAll(
  pool: Pool,
  parentTable: string,
  parentLabel: string,
  ids: string[],
  userId: string,
  isGlobalAdmin = false,
): Promise<void> {
  const existing = await pool.query(
    `SELECT COUNT(DISTINCT id) AS count FROM ${parentTable} WHERE id = ANY($1)`,
    [ids],
  )
  const foundCount = parseInt(String(existing.rows[0]?.count ?? '0'), 10)
  if (foundCount < ids.length) {
    throw new EntityHttpError(400, `Unknown ${parentLabel}: ${ids.join(', ')}`)
  }
  if (isGlobalAdmin) return
  const admin = await pool.query(
    `SELECT COUNT(DISTINCT entity_id) AS count FROM entity_access
     WHERE table_name = $1 AND user_id = $2 AND role = 'admin' AND entity_id = ANY($3)`,
    [parentTable, userId, ids],
  )
  const adminCount = parseInt(String(admin.rows[0]?.count ?? '0'), 10)
  if (adminCount < ids.length) {
    throw new EntityHttpError(403, `Administrator access required for the referenced ${parentLabel}`)
  }
}