import { Router, Response } from 'express'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { getSession } from '../auth/session'
import type { LocalUserProfile } from '@uniweaver/shared'
import {
  listRestrictions,
  createRestriction,
  updateRestriction,
  deleteRestriction,
  effectiveRestrictions,
} from '../db/restrictions'
import { EntityHttpError, TABLE_SPECS } from '../db/entities'

export const restrictionsRouter = Router()

restrictionsRouter.use(async (req, res, next) => {
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

type RestrictionHandler = (req: AuthenticatedRequest, res: Response) => Promise<void>

function withRestrictionContext(handler: RestrictionHandler): RestrictionHandler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error instanceof EntityHttpError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      const message = error instanceof Error ? error.message : 'Internal server error'
      res.status(500).json({ error: message })
    }
  }
}

function pathParams(req: AuthenticatedRequest): { table: string; id: string } {
  return { table: String(req.params.table), id: String(req.params.id) }
}

/** Accepts both the API's public alias (`classes`) and the DB table name. */
function canonicalTable(table: string): string {
  if (table === 'classes') return 'class_entities'
  return table
}

function requireKnownTable(table: string): void {
  if (!TABLE_SPECS[table] && table !== 'class_entities') {
    throw new EntityHttpError(404, `Unknown collection: ${table}`)
  }
}

restrictionsRouter.get('/:table/:id/restrictions', withRestrictionContext(async (req, res) => {
  const pool = getPool()
  const user = req.sessionUser as LocalUserProfile
  const { table, id } = pathParams(req)
  requireKnownTable(canonicalTable(table))
  const rows = await listRestrictions(pool, canonicalTable(table), id, user.id, user.is_admin)
  res.json(rows)
}))

restrictionsRouter.get('/:table/:id/restrictions/effective', withRestrictionContext(async (req, res) => {
  const pool = getPool()
  const user = req.sessionUser as LocalUserProfile
  const { table, id } = pathParams(req)
  requireKnownTable(canonicalTable(table))
  const rows = await effectiveRestrictions(pool, canonicalTable(table), id, user.id, user.is_admin)
  res.json(rows)
}))

restrictionsRouter.post('/:table/:id/restrictions', withRestrictionContext(async (req, res) => {
  const pool = getPool()
  const user = req.sessionUser as LocalUserProfile
  const { table, id } = pathParams(req)
  requireKnownTable(canonicalTable(table))
  const created = await createRestriction(
    pool,
    canonicalTable(table),
    id,
    req.body ?? {},
    user.id,
    user.is_admin,
  )
  res.status(201).json(created)
}))

restrictionsRouter.put('/:table/:id/restrictions/:restrictionId', withRestrictionContext(async (req, res) => {
  const pool = getPool()
  const user = req.sessionUser as LocalUserProfile
  const { table, id, restrictionId } = {
    table: String(req.params.table),
    id: String(req.params.id),
    restrictionId: String(req.params.restrictionId),
  }
  requireKnownTable(canonicalTable(table))
  const updated = await updateRestriction(
    pool,
    canonicalTable(table),
    id,
    restrictionId,
    req.body ?? {},
    user.id,
    user.is_admin,
  )
  if (!updated) {
    res.status(404).json({ error: 'Restriction not found' })
    return
  }
  res.json(updated)
}))

restrictionsRouter.delete('/:table/:id/restrictions/:restrictionId', withRestrictionContext(async (req, res) => {
  const pool = getPool()
  const user = req.sessionUser as LocalUserProfile
  const { table, id, restrictionId } = {
    table: String(req.params.table),
    id: String(req.params.id),
    restrictionId: String(req.params.restrictionId),
  }
  requireKnownTable(canonicalTable(table))
  const removed = await deleteRestriction(
    pool,
    canonicalTable(table),
    id,
    restrictionId,
    user.id,
    user.is_admin,
  )
  if (!removed) {
    res.status(404).json({ error: 'Restriction not found' })
    return
  }
  res.json({ ok: true })
}))