import { Router, Response } from 'express'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { getSession } from '../auth/session'
import { provisionLecturersFromUsers } from '../db/schedulingDb'

export const lecturersRouter = Router()

/**
 * Lecturer list + per-lecturer unavailability for the Scheduling tool.
 *
 * Lecturers need no CRUD: every active user account is a lecturer by default
 * (opt-out flag is_not_lecturer on the account). This screen only manages
 * when lecturers are NOT available:
 *   - weekly_recurring (every week on a weekday)
 *   - individual_date  (one date, optionally with a time window)
 *
 * Permissions: every authenticated user may read the lecturer list and edit
 * THEIR OWN unavailability; schedulers/global admins may edit anybody's.
 */

lecturersRouter.use(async (req, res, next) => {
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

function isSchedulerLike(user: { is_admin?: boolean; is_scheduler?: boolean }): boolean {
  return !!user.is_admin || !!user.is_scheduler
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ------------------------------------------------------------------ lecturer list
lecturersRouter.get('/lecturers', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool()
    const provisioned = await provisionLecturersFromUsers(pool)
    if (provisioned > 0) {
      console.log(`[Scheduling] Provisioned ${provisioned} lecturer row(s) from user accounts`)
    }

    const result = await pool.query(
      `SELECT l.id, l.name, l.department_id, l.contact,
              u.id AS account_id, u.display_name AS user_display_name, u.name AS user_name,
              u.is_not_lecturer AS account_opted_out,
              d.name AS department_name,
              (SELECT count(*)::int FROM lecturer_unavailability lu WHERE lu.lecturer_id = l.id) AS unavailability_count
       FROM lecturers l
       LEFT JOIN local_users u ON u.id = l.user_id
       LEFT JOIN departments d ON d.id = l.department_id
       -- Hide lecturers whose linked account has opted out.
       WHERE l.user_id IS NULL OR NOT COALESCE(u.is_not_lecturer, false)
       ORDER BY l.name ASC`,
    )
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      departmentId: r.department_id || '',
      departmentName: r.department_name || '',
      contact: r.contact || '',
      accountId: r.account_id || null,
      displayLabel: r.user_display_name || r.user_name || '',
      isAccountBased: !!r.account_id,
      unavailabilityCount: r.unavailability_count ?? 0,
      /** Whether the requesting user may edit this lecturer's availability. */
      canEdit: false,
    })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load lecturers' })
  }
})

// ------------------------------------------------------------------ unavailability
const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface UnavailabilityInput {
  kind: 'weekly_recurring' | 'individual_date'
  weekday: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  note: string
}

/**
 * Validates entries against the kind-discriminated model.
 * weekly_recurring: weekday required; times optional (null = whole day)
 * individual_date: ISO date required; times optional (null = whole day)
 */
function validUnavailability(list: unknown, res: Response): UnavailabilityInput[] | null {
  if (!Array.isArray(list)) {
    res.status(400).json({ error: 'entries must be an array' })
    return null
  }
  if (list.length > 2000) {
    res.status(413).json({ error: 'Too many entries in one request (max 2000)' })
    return null
  }
  const out: UnavailabilityInput[] = []
  for (const raw of list) {
    const kind = raw?.kind === 'weekly_recurring' ? 'weekly_recurring' : raw?.kind === 'individual_date' ? 'individual_date' : null
    if (!kind) {
      res.status(400).json({ error: "Each entry needs kind 'weekly_recurring' or 'individual_date'" })
      return null
    }
    const startTime = raw.startTime ? String(raw.startTime) : null
    const endTime = raw.endTime ? String(raw.endTime) : null

    if (kind === 'weekly_recurring') {
      const weekday = raw.weekday ? String(raw.weekday).toLowerCase() : ''
      if (!WEEKDAYS.has(weekday)) {
        res.status(400).json({ error: 'Weekly recurring entries need a valid weekday' })
        return null
      }
      out.push({ kind, weekday, date: null, startTime, endTime, note: String(raw.note ?? '').slice(0, 255) })
    } else {
      const date = raw.date ? String(raw.date) : ''
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
        res.status(400).json({ error: 'Individual date entries need an ISO date (YYYY-MM-DD)' })
        return null
      }
      out.push({ kind, weekday: null, date, startTime, endTime, note: String(raw.note ?? '').slice(0, 255) })
    }

    const entry = out[out.length - 1]!
    if (entry.startTime && !TIME_RE.test(entry.startTime)) {
      res.status(400).json({ error: 'Times must be HH:MM' })
      return null
    }
    if (entry.endTime && !TIME_RE.test(entry.endTime)) {
      res.status(400).json({ error: 'Times must be HH:MM' })
      return null
    }
    if (entry.startTime && entry.endTime && entry.endTime <= entry.startTime) {
      res.status(400).json({ error: 'endTime must be after startTime' })
      return null
    }
    // Both or neither time: a window needs both bounds.
    if (!!entry.startTime !== !!entry.endTime) {
      res.status(400).json({ error: 'Provide both start and end time (or leave both empty for the whole day)' })
      return null
    }
  }
  return out
}

lecturersRouter.get('/lecturers/:id/unavailability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool()
    const user = req.sessionUser!
    const param = String(req.params.id)

    // Resolve the target lecturer row.
    let lecturerId = param
    if (param === 'me') {
      const own = await pool.query<{ id: string }>('SELECT id FROM lecturers WHERE user_id = $1', [user.id])
      if (own.rows.length === 0) {
        // Opted-out or account without lecturer row: no availability to manage.
        res.json([])
        return
      }
      lecturerId = own.rows[0]!.id
    }

    const result = await pool.query(
      `SELECT id, lecturer_id, kind, weekday,
              to_char(date, 'YYYY-MM-DD') AS date,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time, 'HH24:MI') AS end_time,
              note
       FROM lecturer_unavailability
       WHERE lecturer_id = $1
       ORDER BY kind ASC, weekday NULLS LAST, date NULLS LAST, start_time NULLS FIRST`,
      [lecturerId],
    )
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      kind: r.kind,
      weekday: r.weekday || null,
      date: r.date || null,
      startTime: r.start_time || null,
      endTime: r.end_time || null,
      note: r.note || '',
    })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load unavailability' })
  }
})

/** Full replace of a lecturer's unavailability entries (single transaction). */
lecturersRouter.put('/lecturers/:id/unavailability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool()
    const user = req.sessionUser!
    const param = String(req.params.id)

    // Resolve target + enforce self-or-scheduler.
    let lecturerId = param
    if (param === 'me') {
      const own = await pool.query<{ id: string }>('SELECT id FROM lecturers WHERE user_id = $1', [user.id])
      if (own.rows.length === 0) {
        res.status(404).json({ error: 'Your account is not listed as a lecturer (opted out?)' })
        return
      }
      lecturerId = own.rows[0]!.id
    } else if (!isSchedulerLike(user)) {
      // Explicit target id: only schedulers may write someone else's data.
      const target = await pool.query<{ user_id: string | null }>('SELECT user_id FROM lecturers WHERE id = $1', [param])
      if (target.rows.length === 0) {
        res.status(404).json({ error: 'Lecturer not found' })
        return
      }
      if (target.rows[0]!.user_id !== user.id) {
        res.status(403).json({ error: 'You may only edit your own availability' })
        return
      }
      lecturerId = param
    }

    const entries = validUnavailability(req.body?.entries, res)
    if (!entries) return

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM lecturer_unavailability WHERE lecturer_id = $1', [lecturerId])
      for (const e of entries) {
        await client.query(
          `INSERT INTO lecturer_unavailability (id, lecturer_id, kind, weekday, date, start_time, end_time, note, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [genId('uw_lun'), lecturerId, e.kind, e.weekday, e.date, e.startTime, e.endTime, e.note, user.id],
        )
      }
      await client.query('COMMIT')
      res.json({ ok: true, count: entries.length })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save unavailability' })
  }
})