import type { Pool } from 'pg'
import {
  RESTRICTION_TYPES,
  isRestrictableTable,
  validateRestrictionParams,
  DEFAULT_PRIORITY,
} from '@uniweaver/shared'
import { genEntityId, EntityHttpError } from './entities'

/** Valid priority (weight) range: 1 = nice-to-have … 5 = mandatory condition. */
const MIN_PRIORITY = 1
const MAX_PRIORITY = 5

/** Clamps any incoming weight to the 1–5 priority scale. */
function normalizePriority(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, Math.trunc(n)))
}

export interface RestrictionRow {
  id: string
  table_name: string
  entity_id: string
  rule_type: string
  params: Record<string, unknown>
  enabled: boolean
  weight: number
  created_at: Date
  updated_at: Date
}

export interface ResolvedRestriction {
  id: string
  table: string
  entityId: string
  ruleType: string
  params: Record<string, unknown>
  enabled: boolean
  weight: number
  createdAt?: string
  updatedAt?: string
  inheritedFrom?: { table: string; id: string; name: string }
}

interface ParentEdgeRow {
  child_table: string
  child_id: string
  parent_table: string
  parent_id: string
}

/**
 * All parent edges of the curriculum hierarchy, one SELECT per direction of
 * the JSONB id-array storage format:
 *  - parent's  side:  programs.departmentIds,   degrees.programIds,
 *                     modules.degreeIds          (array column on parent)
 *  - child's   side:  class_entities.degreeId    (scalar FK on child)
 */
const PARENT_EDGES_SQL = {
  programs_departments: `SELECT 'programs' AS child_table, p.id AS child_id, 'departments' AS parent_table, d AS parent_id
    FROM programs p, jsonb_array_elements_text(p.department_ids::jsonb) AS d`,
  degrees_programs: `SELECT 'degrees' AS child_table, g.id AS child_id, 'programs' AS parent_table, pr AS parent_id
    FROM degrees g, jsonb_array_elements_text(g.program_ids::jsonb) AS pr`,
  modules_degrees: `SELECT 'modules' AS child_table, m.id AS child_id, 'degrees' AS parent_table, dg AS parent_id
    FROM modules m, jsonb_array_elements_text(m.degree_ids::jsonb) AS dg`,
  classes_degrees: `SELECT 'class_entities' AS child_table, c.id AS child_id, 'degrees' AS parent_table, c.degree_id AS parent_id
    FROM class_entities c WHERE c.degree_id IS NOT NULL`,
} as const

async function loadParentEdges(pool: Pool): Promise<Map<string, { table: string; id: string }[]>> {
  const edges = new Map<string, { table: string; id: string }[]>()
  for (const sql of Object.values(PARENT_EDGES_SQL)) {
    const res = await pool.query<ParentEdgeRow>(sql)
    for (const row of res.rows) {
      const key = `${row.child_table}:${row.child_id}`
      const list = edges.get(key) ?? []
      list.push({ table: row.parent_table, id: row.parent_id })
      edges.set(key, list)
    }
  }
  return edges
}

function normalizedName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : ''
}

/** Loads display names for a batch of (table, id) references. */
async function loadNames(
  pool: Pool,
  refs: { table: string; id: string }[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const byTable = new Map<string, string[]>()
  for (const ref of refs) {
    const list = byTable.get(ref.table) ?? []
    list.push(ref.id)
    byTable.set(ref.table, list)
  }
  for (const [table, ids] of byTable) {
    const res = await pool.query<{ id: string; name: string | null; display_name: string | null }>(
      `SELECT id, COALESCE(NULLIF(name, ''), '') AS name FROM ${table} WHERE id = ANY($1)`,
      [ids],
    )
    for (const row of res.rows) {
      names.set(`${table}:${row.id}`, normalizedName(row.name) || row.id)
    }
  }
  return names
}

export function toResolved(row: RestrictionRow, inheritedFrom?: ResolvedRestriction['inheritedFrom']): ResolvedRestriction {
  return {
    id: row.id,
    table: row.table_name,
    entityId: row.entity_id,
    ruleType: row.rule_type,
    params: row.params ?? {},
    enabled: row.enabled,
    weight: row.weight,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : undefined,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : undefined,
    inheritedFrom,
  }
}

function assertRestrictable(table: string): void {
  if (!isRestrictableTable(normalizedName(table)) && !(table === 'class_entities')) {
    throw new EntityHttpError(404, `Unknown collection: ${table}`)
  }
}

async function assertReadAccess(
  pool: Pool,
  table: string,
  entityId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<void> {
  if (isGlobalAdmin) return
  const ownRole = await pool.query<{ role: string }>(
    `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
    [table, entityId, userId],
  )
  const role = ownRole.rows[0]?.role
  if (role) return
  // Inherited read access: visibility of the parent entity implies visibility
  // of its restrictions (restrictions of parents apply to children anyway).
  const edges = await loadParentEdges(pool)
  const parents = edges.get(`${table}:${entityId}`) ?? []
  if (parents.length === 0) {
    throw new EntityHttpError(403, 'Read access required')
  }
  for (const parent of parents) {
    const res = await pool.query(
      `SELECT 1 FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
      [parent.table, parent.id, userId],
    )
    if ((res.rowCount ?? 0) > 0) return
  }
  throw new EntityHttpError(403, 'Read access required')
}

/** Restrictions owned directly by the given entity. */
export async function listRestrictions(
  pool: Pool,
  table: string,
  entityId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<ResolvedRestriction[]> {
  assertRestrictable(table)
  await assertReadAccess(pool, table, entityId, userId, isGlobalAdmin)
  const res = await pool.query<RestrictionRow>(
    `SELECT * FROM entity_restrictions WHERE table_name = $1 AND entity_id = $2 ORDER BY created_at ASC`,
    [table, entityId],
  )
  return res.rows.map(r => toResolved(r))
}

/** Own restrictions without access checks (for internal composition). */
async function listRestrictionsOwnOnly(
  pool: Pool,
  table: string,
  entityId: string,
): Promise<ResolvedRestriction[]> {
  const res = await pool.query<RestrictionRow>(
    `SELECT * FROM entity_restrictions WHERE table_name = $1 AND entity_id = $2 ORDER BY created_at ASC`,
    [table, entityId],
  )
  return res.rows.map(r => toResolved(r))
}

async function loadRestriction(
  pool: Pool,
  restrictionId: string,
): Promise<RestrictionRow | null> {
  const res = await pool.query<RestrictionRow>(
    `SELECT * FROM entity_restrictions WHERE id = $1`,
    [restrictionId],
  )
  return res.rows[0] ?? null
}

async function assertWriteAccess(
  pool: Pool,
  table: string,
  entityId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<void> {
  if (isGlobalAdmin) return
  const ownRole = await pool.query<{ role: string }>(
    `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
    [table, entityId, userId],
  )
  const role = ownRole.rows[0]?.role
  if (role === 'admin' || role === 'write') return
  if (role) {
    throw new EntityHttpError(403, 'Write access required')
  }
  // Inherited write access: a user who can already admin the entity's direct
  // curriculum ancestors may maintain its restrictions.
  const edges = await loadParentEdges(pool)
  const parents = edges.get(`${table}:${entityId}`) ?? []
  for (const parent of parents) {
    const parentRole = await pool.query<{ role: string }>(
      `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
      [parent.table, parent.id, userId],
    )
    const parentRoleValue = parentRole.rows[0]?.role
    if (parentRoleValue === 'admin' || parentRoleValue === 'write') return
  }
  throw new EntityHttpError(403, 'Write access required')
}

export async function createRestriction(
  pool: Pool,
  table: string,
  entityId: string,
  payload: { ruleType?: unknown; params?: unknown; enabled?: unknown; weight?: unknown },
  userId: string,
  isGlobalAdmin: boolean,
): Promise<ResolvedRestriction> {
  await assertWriteAccess(pool, table, entityId, userId, isGlobalAdmin)
  return insertRestriction(pool, table, entityId, payload)
}

export async function insertRestriction(
  pool: Pool,
  table: string,
  entityId: string,
  payload: { ruleType?: unknown; params?: unknown; enabled?: unknown; weight?: unknown },
): Promise<ResolvedRestriction> {
  assertRestrictable(table)
  const exists = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [entityId])
  if (exists.rows.length === 0) {
    throw new EntityHttpError(404, 'Entity not found')
  }
  const ruleType = typeof payload.ruleType === 'string' ? payload.ruleType : ''
  if (!RESTRICTION_TYPES[ruleType]) {
    throw new EntityHttpError(400, `Unknown restriction type: ${ruleType}`)
  }
  const paramsError = validateRestrictionParams(ruleType, payload.params ?? {})
  if (paramsError) {
    throw new EntityHttpError(400, paramsError)
  }
  const weight = normalizePriority(payload.weight, DEFAULT_PRIORITY)
  const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled)
  const id = genEntityId()
  const res = await pool.query<RestrictionRow>(
    `INSERT INTO entity_restrictions (id, table_name, entity_id, rule_type, params, enabled, weight, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [id, table, entityId, ruleType, JSON.stringify(payload.params ?? {}), enabled, weight],
  )
  return toResolved(res.rows[0])
}

export async function updateRestriction(
  pool: Pool,
  table: string,
  entityId: string,
  restrictionId: string,
  payload: { ruleType?: unknown; params?: unknown; enabled?: unknown; weight?: unknown },
  userId: string,
  isGlobalAdmin: boolean,
): Promise<ResolvedRestriction | null> {
  await assertWriteAccess(pool, table, entityId, userId, isGlobalAdmin)
  const current = await loadRestriction(pool, restrictionId)
  if (!current || current.table_name !== table || current.entity_id !== entityId) {
    throw new EntityHttpError(404, 'Restriction not found')
  }
  const ruleType = typeof payload.ruleType === 'string' ? payload.ruleType : current.rule_type
  if (!RESTRICTION_TYPES[ruleType]) {
    throw new EntityHttpError(400, `Unknown restriction type: ${ruleType}`)
  }
  const params = payload.params === undefined ? current.params : payload.params
  const paramsError = validateRestrictionParams(ruleType, params ?? {})
  if (paramsError) {
    throw new EntityHttpError(400, paramsError)
  }
  const weight = normalizePriority(payload.weight, current.weight)
  const enabled = payload.enabled === undefined ? current.enabled : Boolean(payload.enabled)
  const res = await pool.query<RestrictionRow>(
    `UPDATE entity_restrictions
     SET rule_type = $1, params = $2, enabled = $3, weight = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [ruleType, JSON.stringify(params ?? {}), enabled, weight, restrictionId],
  )
  return res.rows[0] ? toResolved(res.rows[0]) : null
}

export async function deleteRestriction(
  pool: Pool,
  table: string,
  entityId: string,
  restrictionId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<boolean> {
  await assertWriteAccess(pool, table, entityId, userId, isGlobalAdmin)
  const res = await pool.query(
    `DELETE FROM entity_restrictions WHERE id = $1 AND table_name = $2 AND entity_id = $3`,
    [restrictionId, table, entityId],
  )
  return (res.rowCount ?? 0) > 0
}

/**
 * All restrictions that apply to the given entity: its own plus every
 * ancestor's (degree(s) → program(s) → department(s), walking all parallel
 * parent chains). Each ancestor restriction appears once, tagged with the
 * ancestor it was inherited from.
 */
export async function effectiveRestrictions(
  pool: Pool,
  table: string,
  entityId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<ResolvedRestriction[]> {
  assertRestrictable(table)
  await assertReadAccess(pool, table, entityId, userId, isGlobalAdmin)
  const own = await listRestrictionsOwnOnly(pool, table, entityId)
  const edges = await loadParentEdges(pool)
  const names = new Map<string, string>()

  const result: ResolvedRestriction[] = [...own]
  const visitedEntities = new Set<string>([`${table}:${entityId}`])
  const queue: { table: string; id: string }[] = edges
    .get(`${table}:${entityId}`)?.slice() ?? []

  while (queue.length > 0) {
    const ref = queue.shift()!
    const key = `${ref.table}:${ref.id}`
    if (visitedEntities.has(key)) continue
    visitedEntities.add(key)
    if (!names.has(key)) {
      const loaded = await loadNames(pool, [ref])
      names.set(key, loaded.get(key) ?? ref.id)
    }
    const ancestors = await listRestrictionsOwnOnly(pool, ref.table, ref.id)
    for (const a of ancestors) {
      result.push({ ...a, inheritedFrom: { table: ref.table, id: ref.id, name: names.get(key) ?? ref.id } })
    }
    for (const parent of edges.get(key) ?? []) queue.push(parent)
  }
  return result
}