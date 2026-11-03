import type { Pool } from 'pg'
import { TABLE_SPECS, EntityHttpError } from './entities'
import type { TableSpec } from './entities'

export { EntityHttpError, TABLE_SPECS }

export async function requireTable(tableName: string): Promise<TableSpec> {
  const spec = TABLE_SPECS[tableName]
  if (!spec) throw new EntityHttpError(404, `Unknown collection: ${tableName}`)
  return spec
}

/** Create-time validation for columns that must be present and non-empty. */
export function assertRequiredColumns(spec: TableSpec, payload: Record<string, unknown>): void {
  for (const camel of spec.requiredColumns ?? []) {
    const value = payload[camel]
    if (value === undefined || value === null || value === '') {
      const label = camel.charAt(0).toUpperCase() + camel.slice(1)
      throw new EntityHttpError(400, `${label} is required`)
    }
  }
}

/** Fills createdByName on audited rows based on the local_users table. */
export async function resolveCreatedByNames(
  pool: Pool,
  rows: Record<string, unknown>[],
): Promise<void> {
  const ids = [...new Set(rows.map(r => r.createdBy).filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (ids.length === 0) return
  const res = await pool.query<{ id: string; display_name: string | null; local_name: string | null; name: string | null }>(
    `SELECT id, display_name, local_name, name FROM local_users WHERE id = ANY($1)`,
    [ids],
  )
  const names = new Map<string, string>()
  for (const u of res.rows) {
    names.set(u.id, u.display_name || u.local_name || u.name || u.id)
  }
  for (const r of rows) {
    if (typeof r.createdBy === 'string') {
      r.createdByName = names.get(r.createdBy) ?? r.createdBy
    }
  }
}