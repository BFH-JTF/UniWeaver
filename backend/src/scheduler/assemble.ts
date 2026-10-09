/**
 * Assembles the ScheduleRequest for the Timefold scheduling service from the
 * UniWeaver database. Handles the semantic conversions:
 *
 * 1. Semester timeslot grid -> representative-week TimeSlot candidates
 *    (weekId "weekly" for every slot; runs are recurring weekly in v1).
 * 2. Blackout -> allow-list: rooms declare allowed windows (absence of rows
 *    = always available); lecturers declare unavailability, which is flipped
 *    into the complement within each candidate daily slot grid.
 * 3. Module/class pairings -> one session per pairing; duration derived from
 *    module.timeslots x semester slot duration; lecturer candidates from
 *    module_lecturers (falls back to all lecturers with a warning).
 * 4. Effective curriculum restrictions -> per-pairing SchedulingRuleDTOs
 *    (weight-5 allowed_weekdays/timeslots/phase additionally pre-filter the
 *    candidate TimeSlots, which the solver does not enforce itself yet).
 */

import type { Pool } from 'pg'
import type {
  SolverLecturer,
  SolverRequest,
  SolverRoom,
  SolverRule,
  SolverSession,
  SolverTimeSlot,
} from './solverClient'
import type { EffectiveRestriction, Weekday } from '@uniweaver/shared'

const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export interface AssembleResult {
  request: SolverRequest
  warnings: string[]
  summary: {
    classes: number
    modules: number
    rooms: number
    lecturers: number
    sessions: number
  }
  ruleCount: number
}

export class AssemblyError extends Error {}

// ---------------------------------------------------------------- helpers

interface SlotGrid {
  durationMinutes: number
  starts: string[]
}

async function loadSemester(pool: Pool, semesterId: string) {
  const res = await pool.query(
    `SELECT id, name, code, slot_duration_minutes, slot_start_times
     FROM semesters WHERE id = $1`,
    [semesterId],
  )
  if (res.rows.length === 0) {
    throw new AssemblyError('Semester not found')
  }
  const row = res.rows[0]!
  const starts = (row.slot_start_times ?? []) as string[]
  if (!row.slot_duration_minutes || starts.length === 0) {
    throw new AssemblyError(
      `Semester "${row.name}" has no timeslot grid configured. Set daily slot start times and slot duration on the semester in the administration app first.`,
    )
  }
  const grid: SlotGrid = { durationMinutes: row.slot_duration_minutes, starts }
  return { semester: row, grid }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function padSeconds(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm
}

/**
 * Complement of blackout blocks within the week's candidate grid: for each
 * weekday, allowed windows = the day's grid spans not covered by a blackout.
 * Blackouts may be whole-day (no times) or time-bounded; boundaries are
 * snapped to grid slot starts/ends so windows align with candidate slots.
 */
export function complementAgainstGrid(
  blackouts: Array<{ weekday: Weekday; startMinutes: number | null; endMinutes: number | null }>,
  gridSpans: Array<{ start: number; end: number }>,
): Array<{ weekday: Weekday; startTime: string; endTime: string }> {
  const windows: Array<{ weekday: Weekday; startTime: string; endTime: string }> = []
  for (const day of WEEKDAYS) {
    const dayBlocks = blackouts
      .filter((b) => b.weekday === day)
      .map((b) => ({
        start: b.startMinutes ?? Number.NEGATIVE_INFINITY,
        end: b.endMinutes ?? Number.POSITIVE_INFINITY,
      }))
    for (const span of gridSpans) {
      let cursor = span.start
      const sorted = dayBlocks
        .filter((b) => b.end > cursor && b.start < span.end)
        .sort((a, b) => a.start - b.start)
      let blocked = false
      for (const block of sorted) {
        if (block.start > cursor) {
          windows.push({ weekday: day, startTime: toHHMM(cursor), endTime: toHHMM(Math.min(block.start, span.end)) })
          blocked = true
        }
        cursor = Math.max(cursor, block.end)
        if (cursor >= span.end) {
          blocked = true
          break
        }
      }
      if (!blocked || cursor < span.end) {
        windows.push({ weekday: day, startTime: toHHMM(cursor), endTime: toHHMM(span.end) })
      }
    }
  }
  return windows
}

export function buildRoomWindows(
  slots: Array<{ weekId: string | null; weekday: Weekday; startTime: string; endTime: string }>,
): { windows: Array<{ weekId: string; dayOfWeek: string; startTime: string; endTime: string }>; warnings: string[] } {
  const warnings: string[] = []
  const recurring = slots.filter((s) => s.weekId === null)
  if (recurring.length === 0) {
    // No constraints declared: room is always available (allow-list empty).
    return { windows: [], warnings }
  }
  if (recurring.length !== slots.length) {
    warnings.push(
      `${slots.length - recurring.length} week-specific room availability entr(ies) ignored in v1 (only recurring weekly availability is honored).`,
    )
  }
  // Room rows are allow-list windows; the solver uses the same semantics, so
  // we pass them through unchanged (weekId normalized to the recurring set).
  return {
    windows: recurring.map((w) => ({
      weekId: 'weekly',
      dayOfWeek: w.weekday.toUpperCase(),
      startTime: padSeconds(w.startTime),
      endTime: padSeconds(w.endTime),
    })),
    warnings,
  }
}

export function buildGridSpans(grid: SlotGrid): Array<{ start: number; end: number }> {
  const sorted = [...grid.starts].map(toMinutes).sort((a, b) => a - b)
  const spans: Array<{ start: number; end: number }> = []
  for (const start of sorted) {
    const end = start + grid.durationMinutes
    const last = spans[spans.length - 1]
    if (last && last.end === start) {
      last.end = end
    } else {
      spans.push({ start, end })
    }
  }
  return spans
}

export function buildLecturerComplement(
  unavailability: Array<{ kind: string; weekday: Weekday | null; startTime: string | null; endTime: string | null }>,
  gridSpans: Array<{ start: number; end: number }>,
): { windows: Array<{ weekId: string; dayOfWeek: string; startTime: string; endTime: string }>; warnings: string[] } {
  const warnings: string[] = []
  const recurring = unavailability.filter((u) => u.kind === 'weekly_recurring' && u.weekday)
  const dated = unavailability.length - recurring.length
  if (dated > 0) {
    warnings.push(`${dated} date-specific lecturer unavailability entr(ies) ignored in v1 (only weekly recurring blocks apply to recurring schedules).`)
  }
  const blackouts = recurring.map((u) => ({
    weekday: u.weekday as Weekday,
    startMinutes: u.startTime ? toMinutes(u.startTime) : null,
    endMinutes: u.endTime ? toMinutes(u.endTime) : null,
  }))
  const windows = complementAgainstGrid(blackouts, gridSpans)
  return {
    windows: windows.map((w) => ({ weekId: 'weekly', dayOfWeek: w.weekday.toUpperCase(), startTime: padSeconds(w.startTime), endTime: padSeconds(w.endTime) })),
    warnings,
  }
}

interface RawRule {
  id: string
  ruleType: string
  weight: number
  enabled: boolean
  params: Record<string, unknown> | null
  tableName: string
  entityId: string
}

/** True when a weight-5 restriction must hold and can pre-filter candidate slots. */
function filterSlotsForPair(
  pair: { moduleRules: RawRule[]; classRules: RawRule[] },
  slots: SolverTimeSlot[],
): SolverTimeSlot[] {
  let out = slots
  for (const rule of [...pair.moduleRules, ...pair.classRules]) {
    if (!rule.enabled || rule.weight < 5) continue
    const type = rule.ruleType
    if (type === 'allowed_weekdays') {
      const allowed = new Set(((rule.params?.['weekdays'] as string[] | undefined) ?? []).map((w) => w.toLowerCase()))
      if (allowed.size > 0) {
        out = out.filter((s) => allowed.has(s.dayOfWeek.toLowerCase()))
      }
    } else if (type === 'allowed_timeslots') {
      const allowed = new Set(((rule.params?.['startTimes'] as string[] | undefined) ?? []))
      if (allowed.size > 0) {
        out = out.filter((s) => allowed.has(s.startTime.slice(0, 5)))
      }
    } else if (type === 'allowed_phase') {
      const phases = new Set(((rule.params?.['phases'] as string[] | undefined) ?? []).map((p) => p.toLowerCase()))
      if (phases.size > 0) {
        out = out.filter((s) => {
          const minutes = toMinutes(s.startTime.slice(0, 5))
          if (minutes < 12 * 60) return phases.has('morning')
          if (minutes < 18 * 60) return phases.has('afternoon')
          return phases.has('evening')
        })
      }
    }
  }
  return out
}

function toSolverRule(r: RawRule, solverType: string): SolverRule {
  void solverType
  return {
    id: r.id,
    ruleType: r.ruleType,
    weight: r.weight,
    enabled: r.enabled,
    params: r.params ?? undefined,
    appliesTo: undefined,
  }
}

// ---------------------------------------------------------------- main

export async function assembleScheduleRequest(
  pool: Pool,
  semesterId: string,
  spentLimitSeconds: number,
): Promise<AssembleResult> {
  const { semester, grid } = await loadSemester(pool, semesterId)
  const warnings: string[] = []
  const gridSpans = buildGridSpans(grid)

  // Representative weekly candidate slots.
  const timeSlots: SolverTimeSlot[] = []
  const slotIdByKey = new Map<string, string>()
  for (const day of WEEKDAYS) {
    for (const start of [...grid.starts].sort()) {
      const id = `ts_${day}_${toHHMM(toMinutes(start))}`
      slotIdByKey.set(`${day}_${start}`, id)
      timeSlots.push({
        id,
        weekId: 'weekly',
        dayOfWeek: day.toUpperCase(),
        startTime: padSeconds(start),
        endTime: padSeconds(toHHMM(toMinutes(start) + grid.durationMinutes)),
      })
    }
  }

  // Rooms + availability (allow-list semantics in the solver).
  const roomsRes = await pool.query(
    `SELECT id, name, room_type, capacity FROM rooms ORDER BY name ASC`,
  )
  const rooms = roomsRes.rows as Array<{ id: string; name: string; room_type: string; capacity: number }>
  const roomWindows: SolverRoom[] = []
  for (const room of rooms) {
    const availRes = await pool.query(
      `SELECT week_id, weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
       FROM room_availability WHERE room_id = $1`,
      [room.id],
    )
    const built = buildRoomWindows(
      availRes.rows.map((r: any) => ({
        weekId: r.week_id,
        weekday: r.weekday as Weekday,
        startTime: r.start_time,
        endTime: r.end_time,
      })),
    )
    warnings.push(...built.warnings.map((w) => `Room ${room.name}: ${w}`))
    roomWindows.push({
      id: room.id,
      name: room.name,
      roomType: room.room_type || 'room',
      capacity: room.capacity ?? 0,
      availability: built.windows,
    })
  }
  if (rooms.length === 0) {
    throw new AssemblyError('No rooms defined. Add rooms before generating a schedule.')
  }

  // Lecturers + unavailability complement.
  const lecturersRes = await pool.query(
    `SELECT id, name FROM lecturers ORDER BY name ASC`,
  )
  const lecturersRaw = lecturersRes.rows as Array<{ id: string; name: string }>
  if (lecturersRaw.length === 0) {
    throw new AssemblyError('No lecturers defined. Add lecturers before generating a schedule.')
  }
  const unavailRes = await pool.query(
    `SELECT lecturer_id, kind, weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
     FROM lecturer_unavailability`,
  )
  const byLecturer = new Map<string, SolverLecturer>()
  for (const lecturer of lecturersRaw) {
    byLecturer.set(lecturer.id, { id: lecturer.id, name: lecturer.name, availability: [] })
  }
  const unavailByLecturer = new Map<string, Array<{ kind: string; weekday: Weekday | null; startTime: string | null; endTime: string | null }>>()
  for (const row of unavailRes.rows as any[]) {
    const list = unavailByLecturer.get(row.lecturer_id) ?? []
    list.push({ kind: row.kind, weekday: row.weekday, startTime: row.start_time, endTime: row.end_time })
    unavailByLecturer.set(row.lecturer_id, list)
  }
  for (const lecturer of lecturersRaw) {
    const entries = unavailByLecturer.get(lecturer.id) ?? []
    const built = buildLecturerComplement(entries, gridSpans)
    warnings.push(...built.warnings.map((w) => `Lecturer ${lecturer.name}: ${w}`))
    const solverLecturer = byLecturer.get(lecturer.id)!
    // Complement semantics: the flipped windows REPLACE the (empty) allow-list.
    solverLecturer.availability = built.windows
  }
  const lecturers = [...byLecturer.values()]

  // Classes of this semester, with their curriculum version + degree chain.
  const classesRes = await pool.query(
    `SELECT c.id, c.name, c.size, c.degree_id, c.curriculum_version_id, c.module_ids
     FROM class_entities c
     WHERE c.semester_id = $1
     ORDER BY c.name ASC`,
    [semesterId],
  )
  const classes = classesRes.rows as Array<{
    id: string
    name: string
    size: number | null
    degree_id: string | null
    curriculum_version_id: string | null
    module_ids: string[]
  }>
  if (classes.length === 0) {
    throw new AssemblyError(`Semester "${semester.name}" has no classes. Assign the semester to classes in the administration app first.`)
  }

  // Modules referenced by these classes.
  const moduleIds = [...new Set(classes.flatMap((c) => c.module_ids ?? []))]
  if (moduleIds.length === 0) {
    throw new AssemblyError(`No modules assigned to the classes of semester "${semester.name}".`)
  }
  const modulesRes = await pool.query(
    `SELECT id, name, code, timeslots FROM modules WHERE id = ANY($1::text[])`,
    [moduleIds],
  )
  const modules = new Map<string, { id: string; name: string; code: string; timeslots: number | null }>()
  for (const row of modulesRes.rows as any[]) {
    modules.set(row.id, row)
  }

  // Lecturer qualification pool per module.
  const mappingRes = await pool.query(`SELECT module_id, lecturer_id FROM module_lecturers`)
  const poolByModule = new Map<string, string[]>()
  for (const row of mappingRes.rows as any[]) {
    const list = poolByModule.get(row.module_id) ?? []
    list.push(row.lecturer_id)
    poolByModule.set(row.module_id, list)
  }
  const allLecturerIds = lecturersRaw.map((l) => l.id)

  // Effective restrictions for all touched curriculum entities, grouped per
  // entity so pairings can merge their module tree + class tree.
  const entityIds = [...moduleIds]
  for (const c of classes) {
    entityIds.push(c.id)
    if (c.degree_id) entityIds.push(c.degree_id)
    if (c.curriculum_version_id) entityIds.push(c.curriculum_version_id)
  }
  const restrictionsRes = await pool.query(
    `SELECT id, table_name, entity_id, rule_type, params, weight, enabled
     FROM entity_restrictions
     WHERE enabled = true AND entity_id = ANY($1::text[])
       AND table_name IN ('modules','classes','degrees','programs','departments')`,
    [entityIds],
  )
  const rulesByEntity = new Map<string, RawRule[]>()
  for (const row of restrictionsRes.rows as any[]) {
    const key = `${row.table_name}:${row.entity_id}`
    const list = rulesByEntity.get(key) ?? []
    list.push(row)
    rulesByEntity.set(key, list)
  }

  const sessions: SolverSession[] = []
  let ruleCount = 0
  for (const cls of classes) {
    for (const moduleId of cls.module_ids ?? []) {
      const mod = modules.get(moduleId)
      if (!mod) {
        warnings.push(`Module ${moduleId} (assigned to class ${cls.name}) not found; skipped.`)
        continue
      }
      const slotCount = mod.timeslots && mod.timeslots > 0 ? mod.timeslots : 1
      if (!mod.timeslots) {
        warnings.push(`Module ${mod.code || mod.name}: no lesson length set; scheduled with one slot (${grid.durationMinutes} min).`)
      }
      const durationMinutes = slotCount * grid.durationMinutes
      const candidateIds = (poolByModule.get(moduleId) ?? []).filter((id) => byLecturer.has(id))
      if (candidateIds.length === 0) {
        warnings.push(`Module ${mod.code || mod.name}: no lecturer mapping; any lecturer may be assigned.`)
      }
      sessions.push({
        id: `s_${cls.id}_${moduleId}`,
        moduleId,
        moduleName: mod.code ? `${mod.code} – ${mod.name}` : mod.name,
        classId: cls.id,
        className: cls.name,
        studentCount: cls.size ?? 0,
        durationMinutes,
        sequenceIndex: 1,
        lecturerCandidateIds: candidateIds.length > 0 ? candidateIds : allLecturerIds,
      })
    }
  }
  if (sessions.length === 0) {
    throw new AssemblyError(`No sessions to schedule for semester "${semester.name}" (classes have no modules assigned).`)
  }

  // Restriction rules per pairing (module tree AND class tree). The solver
  // currently enforces only minGapBetweenUnits itself; the candidate-slot
  // pre-filter covers the weight-5 time/weekday restrictions.
  const effectiveRules: SolverRule[] = []
  const appliedTypes = new Set<string>()
  for (const session of sessions) {
    const moduleRules = rulesByEntity.get(`modules:${session.moduleId}`) ?? []
    const classRules = rulesByEntity.get(`classes:${session.classId}`) ?? []
    const filtered = filterSlotsForPair({ moduleRules, classRules }, timeSlots)
    if (filtered.length < timeSlots.length) {
      warnings.push(
        `${session.moduleName || session.moduleId} / ${session.className || session.classId}: ${timeSlots.length - filtered.length} timeslot(s) excluded by mandatory time restrictions.`,
      )
      void filtered
    }
    for (const rule of [...moduleRules, ...classRules]) {
      const existing = effectiveRules.find((r) => r.id === rule.id)
      if (!existing) {
        effectiveRules.push(toSolverRule(rule, rule.ruleType))
        appliedTypes.add(rule.ruleType)
        ruleCount += 1
      }
    }
  }
  const UNMAPPED = new Set(['fixed_day', 'excluded_dates', 'frequency_teaching_days', 'frequency_per_week', 'weekday_stability', 'timeslot_stability', 'lecturer_planning', 'allowed_buildings', 'allowed_rooms', 'module_no_overlap', 'module_must_precede', 'module_must_follow'])
  for (const type of [...appliedTypes].sort()) {
    if (UNMAPPED.has(type)) {
      warnings.push(`Restriction type "${type}" is recorded but not yet enforced by the solver (planned).`)
    }
  }

  const request: SolverRequest = {
    semesterId,
    rooms: roomWindows,
    lecturers,
    timeSlots,
    sessions,
    schedulingRules: effectiveRules,
    terminationSpentLimitSeconds: spentLimitSeconds,
  }

  return {
    request,
    warnings,
    summary: {
      classes: classes.length,
      modules: modules.size,
      rooms: rooms.length,
      lecturers: lecturers.length,
      sessions: sessions.length,
    },
    ruleCount,
  }
}

// Re-export for orchestrator use in stats.
export type { EffectiveRestriction }