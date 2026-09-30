import type { Pool, PoolClient } from 'pg'

export type AccessRole = 'read' | 'write' | 'admin'

export const ROLE_RANK: Record<AccessRole, number> = { read: 1, write: 2, admin: 3 }

export function isAccessRole(value: unknown): value is AccessRole {
  return value === 'read' || value === 'write' || value === 'admin'
}

export interface EntityAccessEntry {
  table_name: string
  entity_id: string
  user_id: string
  role: AccessRole
  created_at: string
  name?: string
  email?: string
}

export async function listEntityAccess(
  pool: Pool,
  tableName: string,
  entityId: string,
): Promise<EntityAccessEntry[]> {
  const res = await pool.query(
    `SELECT ea.table_name, ea.entity_id, ea.user_id, ea.role, ea.created_at,
            COALESCE(NULLIF(u.display_name, ''), NULLIF(u.local_name, ''), u.name, ea.user_id) AS name,
            u.email
     FROM entity_access ea
     LEFT JOIN local_users u ON u.id = ea.user_id
     WHERE ea.table_name = $1 AND ea.entity_id = $2
     ORDER BY ea.created_at ASC, ea.user_id ASC`,
    [tableName, entityId],
  )
  return res.rows.map(row => ({
    table_name: row.table_name,
    entity_id: row.entity_id,
    user_id: row.user_id,
    role: row.role as AccessRole,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
    name: row.name ?? undefined,
    email: row.email ?? undefined,
  }))
}

/** Highest role the user holds on each of the given entities. */
export async function getEntityAccessMap(
  pool: Pool,
  tableName: string,
  entityIds: string[],
  userId: string | null,
): Promise<Map<string, AccessRole>> {
  const map = new Map<string, AccessRole>()
  if (!userId || entityIds.length === 0) return map
  const res = await pool.query(
    `SELECT entity_id, role FROM entity_access
     WHERE table_name = $1 AND user_id = $2 AND entity_id = ANY($3)`,
    [tableName, userId, entityIds],
  )
  for (const row of res.rows) {
    map.set(String(row.entity_id), row.role as AccessRole)
  }
  return map
}

export async function getUserRole(
  pool: Pool,
  tableName: string,
  entityId: string,
  userId: string | null,
  isGlobalAdmin: boolean,
): Promise<AccessRole | null> {
  if (isGlobalAdmin) return 'admin'
  if (!userId) return null
  const res = await pool.query(
    `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
    [tableName, entityId, userId],
  )
  return (res.rows[0]?.role as AccessRole) ?? null
}

export async function grantEntityAccess(
  client: PoolClient,
  tableName: string,
  entityId: string,
  userId: string,
  role: AccessRole,
): Promise<void> {
  await client.query(
    `INSERT INTO entity_access (table_name, entity_id, user_id, role, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (table_name, entity_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [tableName, entityId, userId, role],
  )
}

/** Number of distinct administrators recorded on one entity. */
export async function countEntityAdmins(
  pool: Pool,
  tableName: string,
  entityId: string,
): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM entity_access
     WHERE table_name = $1 AND entity_id = $2 AND role = 'admin'`,
    [tableName, entityId],
  )
  return parseInt(res.rows[0]?.count ?? '0', 10)
}