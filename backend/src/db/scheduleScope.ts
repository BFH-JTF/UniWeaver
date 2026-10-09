/**
 * Scope summary for the schedule-generation wizard: counts + warnings that
 * assembling the solver input will produce, without running anything heavy.
 */

import type { Pool } from 'pg'

export interface ScheduleScope {
  semesterId: string
  sessions: number
  classes: number
  modules: number
  rooms: number
  lecturers: number
  warnings: string[]
  gridMissing: boolean
}

export async function getScheduleScope(pool: Pool, semesterId: string): Promise<ScheduleScope> {
  const semesterRes = await pool.query(
    `SELECT name, slot_duration_minutes, slot_start_times FROM semesters WHERE id = $1`,
    [semesterId],
  )
  if (semesterRes.rows.length === 0) {
    throw Object.assign(new Error('Semester not found'), { status: 404 })
  }
  const semester = semesterRes.rows[0] as any
  const starts = (semester.slot_start_times ?? []) as string[]
  const gridMissing = !semester.slot_duration_minutes || starts.length === 0

  const classesRes = await pool.query(
    `SELECT id, name, module_ids FROM class_entities WHERE semester_id = $1`,
    [semesterId],
  )
  const classes = classesRes.rows as Array<{ id: string; name: string; module_ids: string[] }>
  const moduleIds = [...new Set(classes.flatMap((c) => c.module_ids ?? []))]

  let moduleCount = 0
  const unmappedModules: string[] = []
  let sessions = 0
  if (moduleIds.length > 0) {
    const modulesRes = await pool.query(
      `SELECT id, code, name, timeslots FROM modules WHERE id = ANY($1::text[])`,
      [moduleIds],
    )
    const modules = new Map<string, { code: string; name: string; timeslots: number | null }>()
    for (const row of modulesRes.rows as any[]) {
      modules.set(row.id, row)
      if (!row.timeslots) {
        unmappedModules.push(`${row.code || row.name} (no lesson length; scheduled with one slot)`)
      }
    }
    moduleCount = modules.size
    const mappingRes = await pool.query(`SELECT module_id FROM module_lecturers WHERE module_id = ANY($1::text[]) GROUP BY module_id`, [moduleIds])
    const mapped = new Set((mappingRes.rows as any[]).map((r) => r.module_id))
    for (const id of moduleIds) {
      if (!mapped.has(id)) {
        unmappedModules.push(`${(modules.get(id)?.code) || (modules.get(id)?.name) || id} (no lecturer mapping; any lecturer may be assigned)`)
      }
    }
    for (const cls of classes) {
      sessions += (cls.module_ids ?? []).filter((id) => modules.has(id)).length
    }
  }

  const roomsRes = await pool.query(`SELECT COUNT(*)::int AS count FROM rooms`)
  const lecturersRes = await pool.query(`SELECT COUNT(*)::int AS count FROM lecturers`)
  const unavailRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM lecturer_unavailability WHERE kind = 'individual_date'`,
  )

  const warnings: string[] = []
  if (gridMissing) {
    warnings.push('The semester has no timeslot grid configured. Set daily slot start times and slot duration on the semester first (administration app).')
  }
  if (Number(unavailRes.rows[0]?.count ?? 0) > 0) {
    warnings.push('One or more lecturers have date-specific unavailability entries; they are ignored in recurring v1 schedules.')
  }
  if (unmappedModules.length > 0) {
    warnings.push(`Modules without full mapping data: ${unmappedModules.join('; ')}.`)
  }
  if (Number(roomsRes.rows[0]?.count ?? 0) === 0) {
    warnings.push('No rooms defined. Generation will fail until at least one room exists.')
  }
  if (Number(lecturersRes.rows[0]?.count ?? 0) === 0) {
    warnings.push('No lecturers defined. Generation will fail until at least one lecturer exists.')
  }

  return {
    semesterId,
    sessions,
    classes: classes.length,
    modules: moduleCount,
    rooms: Number(roomsRes.rows[0]?.count ?? 0),
    lecturers: Number(lecturersRes.rows[0]?.count ?? 0),
    warnings,
    gridMissing,
  }
}