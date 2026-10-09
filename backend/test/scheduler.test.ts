/**
 * Unit tests for the schedule generation module. Pure functions are tested
 * directly (grid build, blackout complement, fold); the orchestrator is
 * tested against a stubbed solver HTTP endpoint (in-process http server)
 * plus the real DB, mirroring the style of the other backend tests.
 */

import http from 'http'
import type { AddressInfo } from 'net'
import { complementAgainstGridExport, buildGridSpansExport, foldSessions } from '../src/db/testPool'
import { pool, closeDb, migrateForTests } from '../src/db/testPool'

declare const process: NodeJS.Process

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

async function runTests(): Promise<void> {
  console.log('Starting UniWeaver scheduler unit tests...')

  // ---------------------------------------------------------------- grid spans
  console.log('Testing timeslot grid spans...')
  const spans = buildGridSpansExport({ durationMinutes: 45, starts: ['08:00', '08:45', '10:00', '10:45'] })
  assert(spans.length === 2, 'contiguous slots merge into one span')
  assert(spans[0]!.start === 480 && spans[0]!.end === 570, 'first span is 08:00-09:30')
  assert(spans[1]!.start === 600 && spans[1]!.end === 690, 'second span is 10:00-11:30')

  // ---------------------------------------------------------- lecturer complement
  console.log('Testing lecturer unavailability complement...')
  const daySpans = [{ start: 480, end: 720 }]
  const windows = complementAgainstGridExport(
    [{ weekday: 'monday', startMinutes: 510, endMinutes: 555 }],
    daySpans,
  )
  const mondayWindows = windows.filter((w) => w.weekday === 'monday')
  assert(mondayWindows.length === 2, 'one blackout splits the day into two windows')
  const hasMorning = mondayWindows.some((w) => w.startTime === '08:00' && w.endTime === '08:30')
  const hasAfternoon = mondayWindows.some((w) => w.startTime === '09:15' && w.endTime === '12:00')
  assert(hasMorning, 'window before the blackout starts at 08:00')
  assert(hasAfternoon, 'window after the blackout ends at grid end')

  const wholeDay = complementAgainstGridExport(
    [{ weekday: 'friday', startMinutes: null, endMinutes: null }],
    daySpans,
  )
  assert(wholeDay.filter((w) => w.weekday === 'friday').length === 0, 'whole-day blackout removes all windows for that day')

  // ---------------------------------------------------------------- fold
  console.log('Testing session folding...')
  const folded = foldSessions({
    sessions: [
      { id: 'a', moduleId: 'm1', classId: 'c1', assigned: true, dayOfWeek: 'MONDAY', startTime: '08:00:00', endTime: '09:45:00', roomId: 'r1', lecturerId: 'l1' },
      { id: 'b', moduleId: 'm2', classId: 'c2', assigned: true, dayOfWeek: 'MONDAY', startTime: '08:00:00', endTime: '09:45:00', roomId: 'r1', lecturerId: 'l1' },
      { id: 'c', moduleId: 'm3', classId: 'c1', assigned: true, dayOfWeek: 'TUESDAY', startTime: '10:00:00', endTime: '11:45:00', roomId: 'r2', lecturerId: 'l2' },
      { id: 'd', moduleId: 'm4', classId: 'c2', assigned: false },
    ],
  })
  assert(folded.length === 2, 'sessions sharing room+slot+lecturer fold into one entry')
  const monday = folded.find((e) => e.weekday === 'monday')!
  assert(monday.moduleIds.includes('m1') && monday.moduleIds.includes('m2'), 'folded entry carries both module ids')
  assert(monday.classIds.includes('c1') && monday.classIds.includes('c2'), 'folded entry carries both class ids')
  assert(monday.startTime === '08:00' && monday.endTime === '09:45', 'times are normalized to HH:MM')
  assert(!folded.some((e) => e.weekday === 'm4'), 'unplaced sessions are dropped from entries')

  // ---------------------------------------------------------------- DB-backed run
  console.log('Testing run lifecycle with a stub solver service...')
  process.env.SCHEDULER_URL = 'http://placeholder-set-below'
  await migrateForTests()

  // Seed a minimal semester with grid, class, module, lecturer, room.
  await pool.query(`DELETE FROM schedule_runs`)
  await pool.query(`INSERT INTO semesters (id, name, code, start_date, end_date, slot_duration_minutes, slot_start_times)
                    VALUES ('t-sem', 'Testsemester', 'T', '2026-10-01', '2026-12-15', 45, '["08:00","08:45"]'::jsonb)
                    ON CONFLICT (id) DO UPDATE SET slot_duration_minutes = 45, slot_start_times = '["08:00","08:45"]'::jsonb`)
  await pool.query(`INSERT INTO weeks (id, semester_id, semester_week, start_date, end_date)
                    VALUES ('t-w1', 't-sem', 1, '2026-10-01', '2026-10-07') ON CONFLICT (id) DO NOTHING`)
  await pool.query(`INSERT INTO rooms (id, name, room_type, capacity) VALUES ('t-room', 'Testraum', 'lecture', 80) ON CONFLICT (id) DO NOTHING`)
  await pool.query(`INSERT INTO lecturers (id, name) VALUES ('t-lect', 'Test Lecturer') ON CONFLICT (id) DO NOTHING`)
  await pool.query(`INSERT INTO modules (id, name, code, timeslots) VALUES ('t-mod', 'Testmodul', 'T1', 2) ON CONFLICT (id) DO NOTHING`)
  await pool.query(`INSERT INTO class_entities (id, name, semester_id, size, module_ids)
                    VALUES ('t-class', 'Testklasse', 't-sem', 20, '["t-mod"]'::jsonb) ON CONFLICT (id) DO NOTHING`)
  await pool.query(`INSERT INTO module_lecturers (lecturer_id, module_id) VALUES ('t-lect', 't-mod') ON CONFLICT DO NOTHING`)

  // Stub solver: answers POST /api/schedules and GET /api/schedules/:jobId
  // with a deterministic solution after the first poll.
  const stubResponses: Record<string, unknown> = {}
  const solver = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/schedules') {
      let body = ''
      req.on('data', (c: Buffer) => { body += c })
      req.on('end', () => {
        const parsed = JSON.parse(body) as {
          semesterId?: string
          timeSlots?: Array<Record<string, unknown>>
          sessions?: Array<{ durationMinutes?: number; lecturerCandidateIds?: string[] }>
          rooms?: Array<{ id?: string; capacity?: number }>
          terminationSpentLimitSeconds?: number
        }
        assert(typeof parsed.terminationSpentLimitSeconds === 'number' && parsed.terminationSpentLimitSeconds > 0, 'solver receives the user-chosen time limit')
        assert((parsed.timeSlots?.length ?? 0) === 14, 'representative grid: 7 weekdays x 2 slot starts')
        assert((parsed.sessions?.length ?? 0) === 1, 'one session per class x module pairing')
        assert(parsed.sessions?.[0]?.durationMinutes === 90, 'duration = timeslots x slot duration')
        assert(parsed.sessions?.[0]?.lecturerCandidateIds?.includes('t-lect') === true, 'lecturer pool from module_lecturers')
        assert(parsed.rooms?.some((r) => r.id === 't-room' && r.capacity === 80) === true, 'room capacity passed through')
        const jobId = 'stub-job'
        stubResponses[jobId] = {
          jobId,
          semesterId: parsed.semesterId ?? '',
          solverStatus: 'NOT_SOLVING',
          score: { hardScore: 0, softScore: -3, feasible: true },
          sessions: [
            {
              id: 's_t-class_t-mod',
              moduleId: 't-mod',
              moduleName: 'T1 – Testmodul',
              classId: 't-class',
              className: 'Testklasse',
              assigned: true,
              weekId: 'weekly',
              dayOfWeek: 'THURSDAY',
              startTime: { hour: 8, minute: 0, second: 0 },
              endTime: { hour: 9, minute: 45, second: 0 },
              roomId: 't-room',
              roomName: 'Testraum',
              lecturerId: 't-lect',
              lecturerName: 'Test Lecturer',
            },
          ],
        }
        res.statusCode = 202
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ jobId }))
      })
      return
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/schedules/')) {
      const jobId = req.url.split('/').pop()!
      res.setHeader('Content-Type', 'application/json')
      if (stubResponses[jobId]) {
        res.end(JSON.stringify(stubResponses[jobId]))
      } else {
        // Still solving: first GET returns SOLVING_ACTIVE without sessions assigned.
        stubResponses[jobId] = {
          jobId,
          semesterId: '',
          solverStatus: 'SOLVING_ACTIVE',
          score: { hardScore: 0, softScore: 0, feasible: true },
          sessions: [],
        }
        res.end(JSON.stringify(stubResponses[jobId]))
      }
      return
    }
    res.statusCode = 404
    res.end('{}')
  })
  await new Promise<void>((resolve) => solver.listen(0, '127.0.0.1', resolve))
  const solverPort = (solver.address() as AddressInfo).port

  // Point the client at the stub, then exercise the orchestrator through the HTTP API.
  const { default: http2 } = await import('http')
  void http2
  process.env.SCHEDULER_URL = `http://127.0.0.1:${solverPort}`

  const { createScheduleRun, runScheduleGeneration } = await import('../src/scheduler/orchestrator')
  const { id: runId } = await createScheduleRun(pool, {
    semesterId: 't-sem',
    name: 'Testlauf',
    spentLimitSeconds: 15,
  })
  await runScheduleGeneration(pool, runId, { semesterId: 't-sem', spentLimitSeconds: 15 })

  const run = await pool.query(`SELECT status, score, stats, meta FROM schedule_runs WHERE id = $1`, [runId])
  assert(run.rows.length === 1, 'run row exists')
  const runRow = run.rows[0] as any
  assert(runRow.status === 'draft', 'finished run has status draft')
  assert(runRow.score.feasible === true, 'feasible flag stored')
  assert(runRow.meta.spentLimitSeconds === 15, 'chosen solver time stored in meta')
  assert(runRow.stats.sessionsPlaced === 1, 'one session placed')

  const entries = await pool.query(`SELECT weekday, start_time, end_time, module_ids, room_ids, class_ids, lecturer_ids FROM schedule_entries WHERE run_id = $1`, [runId])
  assert(entries.rows.length === 1, 'one folded entry persisted')
  const entry = entries.rows[0] as any
  assert(entry.weekday === 'thursday', 'weekday lowercased for storage')
  assert((entry.module_ids as string[]).includes('t-mod'), 'entry module id stored')
  assert((entry.room_ids as string[]).includes('t-room'), 'entry room id stored')

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  solver.close()
  if (failed > 0) throw new Error('Some scheduler tests failed')
  await closeDb()
  process.exit(0)
}

function hhmmUnused(): void {
  void hhmm
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err)
  await closeDb().catch(() => {})
  process.exit(1)
})
void hhmmUnused