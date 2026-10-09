/**
 * Orchestrates one schedule generation run: create DB row, assemble the
 * solver request, submit to the Timefold service, wait, fold placed sessions
 * into schedule_entries rows, and finalize the run's status/score/stats.
 *
 * Runs fire-and-forget on the backend (promise chain): the API returns the
 * run id immediately and callers poll GET /schedules/:runId.
 */

import type { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { schedulerHealth, solverSolveAndWait } from './solverClient'
import { assembleScheduleRequest, AssemblyError } from './assemble'

export interface GenerateOptions {
  semesterId: string
  name?: string
  spentLimitSeconds: number
  createdBy?: string
}

export interface CreateRunResult {
  id: string
}

interface UnplacedInfo {
  sessionId: string
  moduleId: string
  moduleName?: string
  classId: string
  className?: string
}

/**
 * Normalizes a time value as serialized by the solver service: plain
 * "HH:mm[:ss]" strings, or Jackson's LocalTime object/array form
 * ({hour, minute, second} / [hour, minute, second]).
 */
function normalizeTime(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    // "08:00:00" -> "08:00"
    return raw.length >= 5 ? raw.slice(0, 5) : undefined
  }
  if (Array.isArray(raw) && raw.length >= 2 && typeof raw[0] === 'number' && typeof raw[1] === 'number') {
    return toHHMM(raw[0] as number, raw[1] as number)
  }
  if (raw && typeof raw === 'object') {
    const o = raw as { hour?: unknown; minute?: unknown }
    if (typeof o.hour === 'number' && typeof o.minute === 'number') {
      return toHHMM(o.hour, o.minute)
    }
  }
  return undefined
}

function toHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function foldSessions(response: { sessions: Array<{
  id: string
  moduleId: string
  classId: string
  assigned: boolean
  dayOfWeek?: string
  startTime?: unknown
  endTime?: unknown
  roomId?: string
  lecturerId?: string
}> }): Array<{
  weekday: string
  startTime: string
  endTime: string
  moduleIds: string[]
  roomIds: string[]
  classIds: string[]
  lecturerIds: string[]
}> {
  const byKey = new Map<string, {
    weekday: string
    startTime: string
    endTime: string
    moduleIds: string[]
    roomIds: string[]
    classIds: string[]
    lecturerIds: string[]
  }>()
  for (const s of response.sessions) {
    if (!s.assigned || !s.dayOfWeek) continue
    const startTime = normalizeTime(s.startTime)
    const endTime = normalizeTime(s.endTime)
    if (!startTime || !endTime) continue
    const key = `day:${s.dayOfWeek}:${startTime}:${endTime}:${s.roomId ?? ''}:${s.lecturerId ?? ''}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.moduleIds.includes(s.moduleId)) existing.moduleIds.push(s.moduleId)
      if (s.roomId && !existing.roomIds.includes(s.roomId)) existing.roomIds.push(s.roomId)
      if (!existing.classIds.includes(s.classId)) existing.classIds.push(s.classId)
      if (s.lecturerId && !existing.lecturerIds.includes(s.lecturerId)) existing.lecturerIds.push(s.lecturerId)
    } else {
      byKey.set(key, {
        weekday: s.dayOfWeek.toLowerCase(),
        startTime,
        endTime,
        moduleIds: [s.moduleId],
        roomIds: s.roomId ? [s.roomId] : [],
        classIds: [s.classId],
        lecturerIds: s.lecturerId ? [s.lecturerId] : [],
      })
    }
  }
  return [...byKey.values()]
}

/** Creates the run row (status pending) and returns its id. */
export async function createScheduleRun(pool: Pool, options: GenerateOptions): Promise<CreateRunResult> {
  const id = `run_${randomUUID()}`
  const name = options.name?.trim() || `Schedule ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  await pool.query(
    `INSERT INTO schedule_runs (id, semester_id, name, status, meta, created_by)
     VALUES ($1, $2, $3, 'pending', $4, $5)`,
    [id, options.semesterId, name, JSON.stringify({ spentLimitSeconds: options.spentLimitSeconds }), options.createdBy ?? null],
  )
  return { id }
}

/**
 * Executes one generation run end-to-end. Never throws: every failure mode
 * (assembly, solver offline, timeout) is written into the run row so the UI
 * can display a helpful message.
 */
export async function runScheduleGeneration(pool: Pool, runId: string, options: GenerateOptions): Promise<void> {
  await pool.query(`UPDATE schedule_runs SET status = 'generating', updated_at = NOW() WHERE id = $1`, [runId])
  try {
    const online = await schedulerHealth()
    if (!online) {
      throw new Error('Scheduling service is offline. Start it with "docker compose up" or "mvn spring-boot:run" in scheduler/.')
    }

    const assembled = await assembleScheduleRequest(pool, options.semesterId, options.spentLimitSeconds)

    const response = await solverSolveAndWait(assembled.request, {
      waitTimeoutMs: options.spentLimitSeconds * 1000 + 60_000,
    })

    const unplaced: UnplacedInfo[] = []
    for (const s of response.sessions) {
      if (!s.assigned) {
        unplaced.push({
          sessionId: s.id,
          moduleId: s.moduleId,
          moduleName: s.moduleName,
          classId: s.classId,
          className: s.className,
        })
      }
    }

    const entries = foldSessions(response)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let i = 0
      for (const entry of entries) {
        i += 1
        await client.query(
          `INSERT INTO schedule_entries (id, run_id, week_id, weekday, start_time, end_time, module_ids, room_ids, class_ids, lecturer_ids)
           VALUES ($1, $2, NULL, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)`,
          [
            `ent_${randomUUID()}_${i}`,
            runId,
            entry.weekday,
            entry.startTime,
            entry.endTime,
            JSON.stringify(entry.moduleIds),
            JSON.stringify(entry.roomIds),
            JSON.stringify(entry.classIds),
            JSON.stringify(entry.lecturerIds),
          ],
        )
      }
      await client.query('COMMIT')
    } finally {
      client.release()
    }

    const stats = {
      sessionsTotal: response.sessions.length,
      sessionsPlaced: response.sessions.length - unplaced.length,
      sessionsUnplaced: unplaced.length,
      unplaced,
      classes: assembled.summary.classes,
      modules: assembled.summary.modules,
      rooms: assembled.summary.rooms,
      lecturers: assembled.summary.lecturers,
      warnings: assembled.warnings,
    }
    await pool.query(
      `UPDATE schedule_runs
       SET status = 'draft', score = $2, stats = $3, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [runId, JSON.stringify(response.score), JSON.stringify(stats)],
    )
  } catch (error: unknown) {
    const message = error instanceof AssemblyError
      ? error.message
      : error instanceof Error ? error.message : 'Unknown scheduling error'
    await pool.query(
      `UPDATE schedule_runs SET status = 'failed', stats = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [runId, JSON.stringify({ error: message, warnings: [] })],
    )
  }
}

/** Exposed for tests. */
export { foldSessions }