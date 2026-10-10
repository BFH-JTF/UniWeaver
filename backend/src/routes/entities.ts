import { Router, Response } from 'express'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { getSession } from '../auth/session'
import {
  fetchEntities,
  fetchEntity,
  createEntity,
  updateEntity,
  copyCurriculumVersion,
  EntityHttpError,
  TABLE_SPECS,
} from '../db/entityService'
import { genEntityId } from '../db/entities'
import {
  findEntityReferences,
  deleteEntityWithCleanup,
} from '../db/referenceChecks'
import type { ReferenceFinding } from '../db/referenceChecks'
import {
  listEntityAccess,
  getEntityAccessMap,
  getUserRole,
  grantEntityAccess,
  countEntityAdmins,
  isAccessRole,
} from '../db/access'
import type { AccessRole, EntityAccessEntry } from '../db/access'
import { getUserById } from '../db/users'
import type { LocalUserProfile } from '@uniweaver/shared'

export const entitiesRouter = Router()

// All entity routes require a session; unknown collections 404 below.
entitiesRouter.use(async (req, res, next) => {
  try {
    const session = await getSession(req, res)
    if (!session.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    ;(req as AuthenticatedRequest).sessionUser = session.user
    next()
  } catch (err) {
    next(err)
  }
})

function getUser(req: AuthenticatedRequest): LocalUserProfile {
  return req.sessionUser!
}

function canWrite(role: AccessRole | null): boolean {
  return role === 'write' || role === 'admin'
}

function decorate(row: Record<string, unknown>, role: AccessRole | null): Record<string, unknown> {
  return {
    ...row,
    _isAdmin: role === 'admin',
    _canEdit: role === 'write' || role === 'admin',
  }
}

function decorateAccess(entries: EntityAccessEntry[], viewerIsAdmin: boolean): Record<string, unknown>[] {
  return entries.map(e => ({ ...e, _canManage: viewerIsAdmin }))
}

function pathParams(req: AuthenticatedRequest): { table: string; id: string } {
  return { table: String(req.params.table), id: String(req.params.id) }
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof EntityHttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  const message = error instanceof Error ? error.message : 'Internal server error'
  res.status(500).json({ error: message })
}

async function loadReadRole(
  req: AuthenticatedRequest,
  res: Response,
): Promise<{ table: string; id: string; user: LocalUserProfile; role: AccessRole } | null> {
  const pool = getPool()
  const user = getUser(req)
  const { table, id } = pathParams(req)
  const role = await getUserRole(pool, table, id, user.id, user.is_admin)
  if (!role) {
    res.status(403).json({ error: 'Read access required' })
    return null
  }
  return { table, id, user, role }
}

type EntityHandler = (req: AuthenticatedRequest, res: Response) => Promise<void>

function withEntityContext(handler: EntityHandler): EntityHandler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      handleError(res, error)
    }
  }
}

// ── Curriculum endpoints ──────────────────────────────────────────────────
// Registered before the generic /:table routes below so Express matches these
// dedicated handlers instead of routing them to the generic POST /:table CRUD.

entitiesRouter.post('/curriculums', withEntityContext(async (req, res) => {
  const user = getUser(req)
  if (!user.is_admin) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  const pool = getPool()
  const name = String(req.body?.name ?? '').trim()
  if (!name) {
    res.status(400).json({ error: 'Name is required' })
    return
  }
  const description = String(req.body?.description ?? '')

  const curriculumId = genEntityId()
  const versionId = genEntityId()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Insert the version before the curriculum: curriculum_versions.curriculum_id
    // and curriculums.active_version_id reference each other, so the version row
    // must exist first (with a NULL curriculum_id) before both FKs can be satisfied.
    await client.query(
      `INSERT INTO curriculum_versions (id, name, description, version_number, semester_id, curriculum_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, NULL, $5, NOW(), NOW())`,
      [versionId, name + ' V1', '', null, user.id],
    )
    await client.query(
      `INSERT INTO curriculums (id, name, description, active_version_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [curriculumId, name, description, versionId],
    )
    await client.query(
      `UPDATE curriculum_versions SET curriculum_id = $1 WHERE id = $2`,
      [curriculumId, versionId],
    )
    await client.query(
      `INSERT INTO entity_access (table_name, entity_id, user_id, role, created_at)
       VALUES ('curriculums', $1, $2, 'admin', NOW())`,
      [curriculumId, user.id],
    )
    await client.query(
      `INSERT INTO entity_access (table_name, entity_id, user_id, role, created_at)
       VALUES ('curriculum_versions', $1, $2, 'admin', NOW())`,
      [versionId, user.id],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  const curriculum = await fetchEntity(pool, 'curriculums', curriculumId)
  if (!curriculum) {
    res.status(500).json({ error: 'Curriculum vanished after creation' })
    return
  }
  res.status(201).json(decorate(curriculum, 'admin'))
}))

entitiesRouter.post('/curriculums/:id/versions', withEntityContext(async (req, res) => {
  const user = getUser(req)
  if (!user.is_admin) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  const pool = getPool()
  const curriculumId = String(req.params.id)

  const curriculum = await fetchEntity(pool, 'curriculums', curriculumId)
  if (!curriculum) {
    res.status(404).json({ error: 'Curriculum not found' })
    return
  }

  const versionsRes = await pool.query(
    `SELECT version_number FROM curriculum_versions WHERE curriculum_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [curriculumId],
  )
  const highestNumber = versionsRes.rows.length > 0 ? parseInt(String(versionsRes.rows[0].version_number), 10) : 0
  const newVersionNumber = highestNumber + 1

  const sourceVersionId = String(curriculum.activeVersionId ?? '')
  if (!sourceVersionId) {
    res.status(400).json({ error: 'Curriculum has no active version to copy from' })
    return
  }

  const newVersion = await copyCurriculumVersion(pool, sourceVersionId, curriculumId, newVersionNumber)
  res.status(201).json(decorate(newVersion, 'admin'))
}))

// ── Entity CRUD ──────────────────────────────────────────────────────────

entitiesRouter.get('/:table', withEntityContext(async (req, res) => {
  const pool = getPool()
  const user = getUser(req)
  const table = String(req.params.table)
  const rows = await fetchEntities(pool, table)
  const accessMap = await getEntityAccessMap(pool, table, rows.map(r => String(r.id)), user.id)
  const visible = user.is_admin
    ? rows
    : rows.filter(row => accessMap.has(String(row.id)))
  res.json(visible.map(row => decorate(row, accessMap.get(String(row.id)) ?? null)))
}))

entitiesRouter.get('/:table/:id', withEntityContext(async (req, res) => {
  const ctx = await loadReadRole(req, res)
  if (!ctx) return
  const row = await fetchEntity(getPool(), ctx.table, ctx.id)
  if (!row) {
    res.status(404).json({ error: 'Entity not found' })
    return
  }
  res.json(decorate(row, ctx.role))
}))

entitiesRouter.post('/:table', withEntityContext(async (req, res) => {
  const user = getUser(req)
  const table = String(req.params.table)
  const created = await createEntity(getPool(), table, req.body ?? {}, user.id, user.is_admin)
  res.status(201).json(decorate(created, 'admin'))
}))

entitiesRouter.put('/:table/:id', withEntityContext(async (req, res) => {
  const pool = getPool()
  const user = getUser(req)
  const { table, id } = pathParams(req)
  const role = await getUserRole(pool, table, id, user.id, user.is_admin)
  if (!canWrite(role)) {
    res.status(403).json({ error: 'Write access required' })
    return
  }
  const updated = await updateEntity(pool, table, id, req.body ?? {}, user.id, user.is_admin)
  if (!updated) {
    res.status(404).json({ error: 'Entity not found' })
    return
  }
  res.json(decorate(updated, role))
}))

entitiesRouter.get('/:table/:id/references', withEntityContext(async (req, res) => {
  const pool = getPool()
  const user = getUser(req)
  const { table, id } = pathParams(req)
  if (!TABLE_SPECS[table]) {
    res.status(404).json({ error: `Unknown collection: ${table}` })
    return
  }
  const role = await getUserRole(pool, table, id, user.id, user.is_admin)
  if (!role) {
    res.status(403).json({ error: 'Read access required' })
    return
  }
  const exists = await fetchEntity(pool, table, id)
  if (!exists) {
    res.status(404).json({ error: 'Entity not found' })
    return
  }
  const references = await findEntityReferences(pool, table, id)
  res.json({ table, id, references })
}))

entitiesRouter.delete('/:table/:id', withEntityContext(async (req, res) => {
  const pool = getPool()
  const user = getUser(req)
  const { table, id } = pathParams(req)
  if (!TABLE_SPECS[table]) {
    res.status(404).json({ error: `Unknown collection: ${table}` })
    return
  }
  const role = await getUserRole(pool, table, id, user.id, user.is_admin)
  if (role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  const references = await findEntityReferences(pool, table, id)
  const blocking = references.filter((r: ReferenceFinding) => r.severity !== 'cleanup')
  const confirmed = req.query.confirm === 'true' || req.query.confirm === '1'
  if (blocking.length > 0 && !confirmed) {
    res.status(409).json({
      error: 'Entity is referenced elsewhere; pass ?confirm=true to delete it anyway',
      references,
    })
    return
  }
  const removed = await deleteEntityWithCleanup(pool, table, id)
  if (!removed) {
    res.status(404).json({ error: 'Entity not found' })
    return
  }
  res.json({ ok: true, references })
}))

// ── Access (ACL) management ──────────────────────────────────────────────

entitiesRouter.get('/:table/:id/access', withEntityContext(async (req, res) => {
  const ctx = await loadReadRole(req, res)
  if (!ctx) return
  const entries = await listEntityAccess(getPool(), ctx.table, ctx.id)
  res.json(decorateAccess(entries, ctx.role === 'admin'))
}))

entitiesRouter.post('/:table/:id/access', withEntityContext(async (req, res) => {
  const ctx = await loadReadRole(req, res)
  if (!ctx) return
  if (ctx.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  const pool = getPool()
  const targetUserId = String(req.body?.userId ?? '')
  const targetRole = req.body?.role
  if (!targetUserId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }
  if (!isAccessRole(targetRole)) {
    res.status(400).json({ error: 'role must be one of: read, write, admin' })
    return
  }
  const targetUser = await getUserById(pool, targetUserId)
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  await pool.query(
    `INSERT INTO entity_access (table_name, entity_id, user_id, role, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (table_name, entity_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [ctx.table, ctx.id, targetUserId, targetRole],
  )
  const entries = await listEntityAccess(pool, ctx.table, ctx.id)
  res.status(201).json(decorateAccess(entries, true))
}))

entitiesRouter.put('/:table/:id/access/:userId', withEntityContext(async (req, res) => {
  const ctx = await loadReadRole(req, res)
  if (!ctx) return
  if (ctx.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  const pool = getPool()
  const targetUserId = String(req.params.userId)
  const targetRole = req.body?.role
  if (!isAccessRole(targetRole)) {
    res.status(400).json({ error: 'role must be one of: read, write, admin' })
    return
  }
  await changeAccessWithLastAdminGuard(pool, ctx.table, ctx.id, targetUserId, targetRole)
  const entries = await listEntityAccess(pool, ctx.table, ctx.id)
  res.json(decorateAccess(entries, true))
}))

entitiesRouter.delete('/:table/:id/access/:userId', withEntityContext(async (req, res) => {
  const ctx = await loadReadRole(req, res)
  if (!ctx) return
  if (ctx.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  await removeAccessWithLastAdminGuard(getPool(), ctx.table, ctx.id, String(req.params.userId))
  const entries = await listEntityAccess(getPool(), ctx.table, ctx.id)
  res.json(decorateAccess(entries, true))
}))

async function changeAccessWithLastAdminGuard(
  pool: ReturnType<typeof getPool>,
  table: string,
  id: string,
  userId: string,
  newRole: AccessRole,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query<{ role: AccessRole }>(
      `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3 FOR UPDATE`,
      [table, id, userId],
    )
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new EntityHttpError(404, 'Access entry not found')
    }
    if (current.rows[0].role === 'admin' && newRole !== 'admin') {
      const adminCount = await countEntityAdmins(pool, table, id)
      if (adminCount <= 1) {
        await client.query('ROLLBACK')
        throw new EntityHttpError(409, 'Cannot demote the last remaining administrator')
      }
    }
    await grantEntityAccess(client, table, id, userId, newRole)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function removeAccessWithLastAdminGuard(
  pool: ReturnType<typeof getPool>,
  table: string,
  id: string,
  userId: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query<{ role: AccessRole }>(
      `SELECT role FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3 FOR UPDATE`,
      [table, id, userId],
    )
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new EntityHttpError(404, 'Access entry not found')
    }
    if (current.rows[0].role === 'admin') {
      const adminCount = await countEntityAdmins(pool, table, id)
      if (adminCount <= 1) {
        await client.query('ROLLBACK')
        throw new EntityHttpError(409, 'Cannot remove the last remaining administrator')
      }
    }
    await client.query(
      `DELETE FROM entity_access WHERE table_name = $1 AND entity_id = $2 AND user_id = $3`,
      [table, id, userId],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}