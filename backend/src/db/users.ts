import type { Pool } from 'pg'
import type { LocalUserProfile } from '@uniweaver/shared'

export type { LocalUserProfile }

export interface CreateUserData {
  oidc_issuer: string
  oidc_subject: string
  name?: string
  email?: string
  is_admin?: boolean
}

export interface UpdateUserData {
  name?: string
  email?: string
  local_name?: string
  display_name?: string
  is_active?: boolean
  timezone?: string
  is_admin?: boolean
  roles?: string[]
}

export class LastAdminError extends Error {
  constructor() {
    super('Cannot remove the last remaining administrator')
  }
}

export class UserExistsError extends Error {
  constructor() {
    super('Administrator already exists. Bootstrap is disabled.')
  }
}

export function mapRowToUser(row: any): LocalUserProfile {
  return {
    id: row.id,
    oidc_issuer: row.oidc_issuer,
    oidc_subject: row.oidc_subject,
    name: row.name || '',
    email: row.email || '',
    local_name: row.local_name || '',
    display_name: row.display_name || '',
    is_active: row.is_active !== false,
    timezone: row.timezone || '',
    roles: Array.isArray(row.roles) ? row.roles : [],
    is_admin: !!row.is_admin,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ''),
  }
}

export async function getAdminCount(pool: Pool): Promise<number> {
  const res = await pool.query<{ count: string }>('SELECT COUNT(*) FROM local_users WHERE is_admin = true')
  return parseInt(res.rows[0]!.count, 10)
}

export async function getUserByOidc(pool: Pool, issuer: string, subject: string): Promise<LocalUserProfile | null> {
  const res = await pool.query('SELECT * FROM local_users WHERE oidc_issuer = $1 AND oidc_subject = $2', [issuer, subject])
  return res.rows.length > 0 ? mapRowToUser(res.rows[0]) : null
}

export async function getUserById(pool: Pool, id: string): Promise<LocalUserProfile | null> {
  const res = await pool.query('SELECT * FROM local_users WHERE id = $1', [id])
  return res.rows.length > 0 ? mapRowToUser(res.rows[0]) : null
}

export async function getAllUsers(pool: Pool): Promise<LocalUserProfile[]> {
  const res = await pool.query('SELECT * FROM local_users ORDER BY created_at ASC')
  return res.rows.map(mapRowToUser)
}

export async function searchUsers(pool: Pool, query: string): Promise<LocalUserProfile[]> {
  const res = await pool.query(
    'SELECT * FROM local_users WHERE name ILIKE $1 OR email ILIKE $1 OR id ILIKE $1 ORDER BY name ASC LIMIT 20',
    [`%${query}%`],
  )
  return res.rows.map(mapRowToUser)
}

export async function createOrUpdateUser(pool: Pool, data: CreateUserData): Promise<LocalUserProfile> {
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const now = new Date().toISOString()
  const name = data.name || ''
  const email = data.email || ''
  const roles = data.is_admin ? ['admin'] : ['user']
  const isAdmin = data.is_admin ?? false

  const res = await pool.query(
    `INSERT INTO local_users (id, oidc_issuer, oidc_subject, name, email, local_name, display_name, is_active, roles, is_admin, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $4, $4, true, $6, $7, $8, $8)
     ON CONFLICT (oidc_issuer, oidc_subject)
     DO UPDATE SET
       name = CASE WHEN local_users.name IS NOT NULL AND local_users.name <> '' THEN local_users.name ELSE $4 END,
       email = CASE WHEN local_users.email IS NOT NULL AND local_users.email <> '' THEN local_users.email ELSE $5 END,
       updated_at = $8
     RETURNING *`,
    [id, data.oidc_issuer, data.oidc_subject, name, email, JSON.stringify(roles), isAdmin, now],
  )
  return mapRowToUser(res.rows[0])
}

export async function updateUser(pool: Pool, id: string, updates: UpdateUserData): Promise<LocalUserProfile | null> {
  const currentRes = await pool.query('SELECT is_admin, roles FROM local_users WHERE id = $1', [id])
  if (currentRes.rows.length === 0) return null
  const current = currentRes.rows[0]
  const currentRoles: string[] = Array.isArray(current.roles) ? current.roles : []
  const currentIsAdmin: boolean = !!current.is_admin

  const newIsAdmin = updates.is_admin !== undefined ? !!updates.is_admin : currentIsAdmin
  const newRoles = updates.roles !== undefined && Array.isArray(updates.roles)
    ? updates.roles.map(String)
    : newIsAdmin
      ? Array.from(new Set([...currentRoles, 'admin']))
      : currentRoles.filter(r => r !== 'admin')

  if (currentIsAdmin && (!newIsAdmin || !newRoles.includes('admin'))) {
    const adminCount = await getAdminCount(pool)
    if (adminCount <= 1) {
      throw new LastAdminError()
    }
  }

  const fields: Array<{ name: string; value: unknown }> = []
  if (updates.name !== undefined) fields.push({ name: 'name', value: String(updates.name).trim() })
  if (updates.email !== undefined) fields.push({ name: 'email', value: String(updates.email).trim() })
  if (updates.local_name !== undefined) fields.push({ name: 'local_name', value: String(updates.local_name).trim() })
  if (updates.display_name !== undefined) fields.push({ name: 'display_name', value: String(updates.display_name).trim() })
  if (updates.is_active !== undefined) fields.push({ name: 'is_active', value: !!updates.is_active })
  if (updates.timezone !== undefined) fields.push({ name: 'timezone', value: String(updates.timezone).trim() })
  fields.push({ name: 'is_admin', value: newIsAdmin })
  fields.push({ name: 'roles', value: JSON.stringify(newRoles) })
  fields.push({ name: 'updated_at', value: new Date().toISOString() })

  const setClauses = fields.map((f, i) => `${f.name} = $${i + 2}`).join(', ')
  const params = [id, ...fields.map(f => f.value)]

  const res = await pool.query(`UPDATE local_users SET ${setClauses} WHERE id = $1 RETURNING *`, params)
  return res.rows.length > 0 ? mapRowToUser(res.rows[0]) : null
}

export async function bootstrapAdminUser(
  pool: Pool,
  data: { oidc_issuer: string; oidc_subject: string; name?: string; email?: string },
): Promise<{ success: boolean; user?: LocalUserProfile; error?: string }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('LOCK TABLE local_users IN EXCLUSIVE MODE')

    const countRes = await client.query<{ count: string }>('SELECT COUNT(*) FROM local_users WHERE is_admin = true')
    const adminCount = parseInt(countRes.rows[0]!.count, 10)
    if (adminCount > 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Administrator already exists. Bootstrap is disabled.' }
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const name = data.name || ''
    const email = data.email || ''

    const insertRes = await client.query(
      `INSERT INTO local_users (id, oidc_issuer, oidc_subject, name, email, local_name, display_name, is_active, roles, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $4, $4, true, '["admin"]'::jsonb, true, NOW(), NOW())
       ON CONFLICT (oidc_issuer, oidc_subject)
       DO UPDATE SET
         roles = '["admin"]'::jsonb,
         is_admin = true,
         name = CASE WHEN local_users.name IS NOT NULL AND local_users.name <> '' THEN local_users.name ELSE $4 END,
         email = CASE WHEN local_users.email IS NOT NULL AND local_users.email <> '' THEN local_users.email ELSE $5 END,
         updated_at = NOW()
       RETURNING *`,
      [id, data.oidc_issuer, data.oidc_subject, name, email],
    )

    await client.query('COMMIT')
    return { success: true, user: mapRowToUser(insertRes.rows[0]) }
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {})
    return { success: false, error: err.message || 'Database error during bootstrap' }
  } finally {
    client.release()
  }
}