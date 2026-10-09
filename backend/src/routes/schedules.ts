/**
 * Schedule generation endpoints: list runs, generate via the Timefold
 * scheduling service, inspect run + entries. Scheduler role required
 * throughout; reads stay behind requireScheduler too because schedule
 * drafts are working state of the planning tool.
 */

import { Router, Response } from 'express'
import type { Pool } from 'pg'
import type { AuthenticatedRequest } from '../auth/middleware'
import { requireScheduler } from '../auth/middleware'
import { getPool } from '../db'
import { schedulerHealth } from '../scheduler/solverClient'
import { createScheduleRun, runScheduleGeneration } from '../scheduler/orchestrator'
import { getScheduleScope } from '../db/scheduleScope'

export const schedulesRouter = Router()

const RUN_STATUS_WITH_ENTRIES = new Set(['draft', 'published'])

schedulesRouter.get('/scheduler/health', requireScheduler, async (_req: AuthenticatedRequest, res: Response) => {
  const online = await schedulerHealth()
  res.json({ online })
})

function mapRun(row: any) {
  return {
    id: row.id,
    semesterId: row.semester_id,
    semesterName: row.semester_name || '',
    name: row.name,
    status: row.status,
    score: row.score ?? {},
    stats: row.stats ?? {},
    meta: row.meta ?? {},
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
    entryCount: Number(row.entry_count ?? 0),
  }
}

schedulesRouter.get('/semesters', requireScheduler, async (_req: AuthenticatedRequest, res: Response) => {
  const pool = getPool()
  const result = await pool.query(
    `SELECT s.id, s.name, s.code,
            to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(s.end_date, 'YYYY-MM-DD') AS end_date,
            s.slot_duration_minutes,
            COALESCE(s.slot_start_times, '[]'::jsonb) AS slot_start_times,
            (SELECT COUNT(*) FROM weeks w WHERE w.semester_id = s.id) AS week_count,
            (SELECT COUNT(*) FROM class_entities c WHERE c.semester_id = s.id) AS class_count
     FROM semesters s
     ORDER BY s.start_date DESC NULLS LAST, s.name ASC`,
  )
  res.json(result.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    code: r.code || '',
    startDate: r.start_date || null,
    endDate: r.end_date || null,
    slotDurationMinutes: r.slot_duration_minutes || null,
    slotStartTimes: (r.slot_start_times ?? []) as string[],
    weekCount: Number(r.week_count ?? 0),
    classCount: Number(r.class_count ?? 0),
  })))
})

schedulesRouter.get('/schedules/scope/:semesterId', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool: Pool = getPool()
    const scope = await getScheduleScope(pool, String(req.params.semesterId))
    res.json(scope)
  } catch (error: any) {
    const status = error?.status || 500
    res.status(status).json({ error: error.message || 'Failed to determine schedule scope' })
  }
})

schedulesRouter.get('/schedules', requireScheduler, async (_req: AuthenticatedRequest, res: Response) => {
  const pool = getPool()
  const result = await pool.query(
    `SELECT r.*, s.name AS semester_name,
            (SELECT COUNT(*) FROM schedule_entries e WHERE e.run_id = r.id) AS entry_count
     FROM schedule_runs r
     LEFT JOIN semesters s ON s.id = r.semester_id
     ORDER BY r.created_at DESC`,
  )
  res.json(result.rows.map(mapRun))
})

schedulesRouter.post('/schedules/generate', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  const semesterId = String(req.body?.semesterId || '')
  const spentLimit = Number(req.body?.spentLimitSeconds)
  if (!semesterId) {
    res.status(400).json({ error: 'semesterId is required' })
    return
  }
  if (!Number.isFinite(spentLimit) || spentLimit < 5 || spentLimit > 600) {
    res.status(400).json({ error: 'spentLimitSeconds must be between 5 and 600' })
    return
  }
  const name = req.body?.name ? String(req.body.name).slice(0, 255) : undefined

  const pool = getPool()
  const user = req.sessionUser!

  try {
    const semesterCheck = await pool.query(
      `SELECT slot_duration_minutes, slot_start_times FROM semesters WHERE id = $1`,
      [semesterId],
    )
    if (semesterCheck.rows.length === 0) {
      res.status(404).json({ error: 'Semester not found' })
      return
    }
    const row = semesterCheck.rows[0] as any
    const starts = (row.slot_start_times ?? []) as string[]
    if (!row.slot_duration_minutes || starts.length === 0) {
      res.status(400).json({
        error: 'This semester has no timeslot grid. Configure daily slot start times and slot duration on the semester first (administration app).',
      })
      return
    }

    const { id } = await createScheduleRun(pool, { semesterId, name, spentLimitSeconds: Math.round(spentLimit), createdBy: user.id })
    // Fire-and-forget: the UI polls the run status.
    void runScheduleGeneration(pool, id, { semesterId, name, spentLimitSeconds: Math.round(spentLimit), createdBy: user.id })
    res.status(201).json({ runId: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start schedule generation' })
  }
})

schedulesRouter.get('/schedules/:runId', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool()
  const result = await pool.query(
    `SELECT r.*, s.name AS semester_name,
            (SELECT COUNT(*) FROM schedule_entries e WHERE e.run_id = r.id) AS entry_count
     FROM schedule_runs r
     LEFT JOIN semesters s ON s.id = r.semester_id
     WHERE r.id = $1`,
    [String(req.params.runId)],
  )
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Schedule run not found' })
    return
  }
  res.json(mapRun(result.rows[0]))
})

schedulesRouter.get('/schedules/:runId/entries', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool()
  const runId = String(req.params.runId)
  const run = await pool.query('SELECT id, status FROM schedule_runs WHERE id = $1', [runId])
  if (run.rows.length === 0) {
    res.status(404).json({ error: 'Schedule run not found' })
    return
  }
  if (!RUN_STATUS_WITH_ENTRIES.has((run.rows[0] as any).status)) {
    res.status(409).json({ error: `Schedule is in status "${(run.rows[0] as any).status}"; entries are available once generation finishes.` })
    return
  }
  const result = await pool.query(
    `SELECT e.id, e.run_id, e.week_id, to_char(e.start_time, 'HH24:MI') AS start_time,
            to_char(e.end_time, 'HH24:MI') AS end_time,
            e.weekday, e.module_ids, e.room_ids, e.class_ids, e.lecturer_ids,
            (SELECT jsonb_agg(m.code || ' - ' || m.name ORDER BY m.code)
             FROM jsonb_array_elements_text(e.module_ids) AS mid
             JOIN modules m ON m.id = mid) AS module_names,
            (SELECT jsonb_agg(r.name ORDER BY r.name)
             FROM jsonb_array_elements_text(e.room_ids) AS rid
             JOIN rooms r ON r.id = rid) AS room_names,
            (SELECT jsonb_agg(c.name ORDER BY c.name)
             FROM jsonb_array_elements_text(e.class_ids) AS cid
             JOIN class_entities c ON c.id = cid) AS class_names,
            (SELECT jsonb_agg(l.name ORDER BY l.name)
             FROM jsonb_array_elements_text(e.lecturer_ids) AS lid
             JOIN lecturers l ON l.id = lid) AS lecturer_names
     FROM schedule_entries e WHERE e.run_id = $1
     ORDER BY e.weekday, e.start_time`,
    [runId],
  )
  res.json(result.rows.map((r: any) => ({
    id: r.id,
    runId: r.run_id,
    weekId: r.week_id || null,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
    moduleIds: r.module_ids ?? [],
    roomIds: r.room_ids ?? [],
    classIds: r.class_ids ?? [],
    lecturerIds: r.lecturer_ids ?? [],
    moduleNames: r.module_names ?? [],
    roomNames: r.room_names ?? [],
    classNames: r.class_names ?? [],
    lecturerNames: r.lecturer_names ?? [],
  })))
})

schedulesRouter.delete('/schedules/:runId', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool()
  const result = await pool.query(
    `DELETE FROM schedule_runs WHERE id = $1 AND status IN ('draft', 'failed') RETURNING id`,
    [String(req.params.runId)],
  )
  if (result.rows.length === 0) {
    res.status(409).json({ error: 'Only draft or failed schedules can be deleted' })
    return
  }
  res.json({ ok: true })
})