import { startServer } from '../src/index'
import { closeDb, getPool, initDb } from '../src/db'
import { sealData } from 'iron-session'
import type { Server } from 'http'
import type { LocalUserProfile } from '@uniweaver/shared'

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

const SESSION_SECRET = 'test-session-secret-must-be-at-least-32-chars-long'

function makeUser(id: string, isAdmin: boolean): LocalUserProfile {
  return {
    id,
    oidc_issuer: 'http://localhost:3000/oidc',
    oidc_subject: `subj-${id}`,
    name: id,
    email: `${id}@example.org`,
    display_name: id,
    roles: isAdmin ? ['admin'] : ['user'],
    is_admin: isAdmin,
  }
}

async function cookieFor(user: LocalUserProfile): Promise<string> {
  const sealed = await sealData(
    { user: user, issuer: user.oidc_issuer, subject: user.oidc_subject },
    { password: SESSION_SECRET, ttl: 60 },
  )
  return `uniweaver_session=${sealed}`
}

async function main() {
  console.log('Starting UniWeaver entity restriction tests...')
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SESSION_SECRET

  const dbReady = await initDb()
  assert(dbReady, 'database is connected')
  if (!dbReady) process.exit(1)

  const server = (await startServer(3458)) as Server
  const base = 'http://localhost:3458/api'

  const globalAdmin = makeUser('rstr_global_admin', true)
  const programAdmin = makeUser('rstr_program_admin', false)
  const reader = makeUser('rstr_reader', false)
  const outsider = makeUser('rstr_outsider', false)

  const adminCookie = await cookieFor(globalAdmin)
  const programAdminCookie = await cookieFor(programAdmin)
  const readerCookie = await cookieFor(reader)
  const outsiderCookie = await cookieFor(outsider)

  function auth(cookie: string): Record<string, string> {
    return { 'Content-Type': 'application/json', Cookie: cookie }
  }

  async function seedUser(user: LocalUserProfile): Promise<void> {
    await getPool().query(
      `INSERT INTO local_users (id, oidc_issuer, oidc_subject, name, email, is_admin, roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
      [user.id, user.oidc_issuer, user.oidc_subject, user.name, user.email, user.is_admin, JSON.stringify(user.roles)],
    )
  }

  try {
    for (const u of [globalAdmin, programAdmin, reader, outsider]) await seedUser(u)

    // ── Fixtures: curriculum → department → program → degree → module ───
    console.log('Fixtures...')
    const currRes = await fetch(`${base}/curriculums`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Rstr Curriculum' }),
    })
    assert(currRes.status === 201, 'admin creates curriculum')
    const curriculum = await currRes.json() as any
    const versionsRes = await fetch(`${base}/curriculum_versions`, { headers: auth(adminCookie) })
    const versions = (await versionsRes.json()) as any[]
    const version = versions.find(v => v.curriculumId === curriculum.id)

    const deptRes = await fetch(`${base}/departments`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Rstr Dept' }),
    })
    assert(deptRes.status === 201, 'admin creates department')
    const department = await deptRes.json() as any

    const progRes = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Rstr Prog', departmentIds: [department.id], curriculumId: curriculum.id }),
    })
    assert(progRes.status === 201, 'admin creates program in department')
    const program = await progRes.json() as any

    const degRes = await fetch(`${base}/degrees`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Rstr Deg', programIds: [program.id] }),
    })
    assert(degRes.status === 201, 'admin creates degree in program')
    const degree = await degRes.json() as any

    const modRes = await fetch(`${base}/modules`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Rstr Mod', degreeIds: [degree.id], curriculumVersionId: version.id }),
    })
    assert(modRes.status === 201, 'admin creates module in degree')
    const mod = await modRes.json() as any

    // ── Auth required ───────────────────────────────────────────────────
    console.log('Auth guards...')
    const anon = await fetch(`${base}/departments/${department.id}/restrictions`)
    assert(anon.status === 401, 'restrictions without session return 401')

    // ── Validation ──────────────────────────────────────────────────────
    console.log('Validation...')
    const unknownType = await fetch(`${base}/departments/${department.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ ruleType: 'nonsense', params: {} }),
    })
    assert(unknownType.status === 400, 'unknown rule type is rejected')

    const badParams = await fetch(`${base}/departments/${department.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_weekdays', params: { weekdays: ['funday'] } }),
    })
    assert(badParams.status === 400, 'invalid weekday values are rejected')

    const emptyWeekdays = await fetch(`${base}/departments/${department.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_weekdays', params: { weekdays: [] } }),
    })
    assert(emptyWeekdays.status === 400, 'empty required param list is rejected')

    const badDate = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'excluded_dates', params: { dates: ['2026-13-99'] } }),
    })
    assert(badDate.status === 400, 'invalid date format is rejected')

    const badFrequency = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'frequency_per_week', params: { min: 3, max: 2 } }),
    })
    assert(badFrequency.status === 400, 'frequency min > max is rejected')

    const badTimeslot = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_timeslots', params: { startTimes: ['24:00'] } }),
    })
    assert(badTimeslot.status === 400, 'invalid timeslot start time is rejected')

    const badChoice = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'lecturer_planning', params: { mode: 'sometimes' } }),
    })
    assert(badChoice.status === 400, 'invalid choice value is rejected')

    const badRoomList = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_rooms', params: { roomIds: [] } }),
    })
    assert(badRoomList.status === 400, 'empty room list is rejected')

    // ── New catalog types are accepted ──────────────────────────────────
    const okTimeslots = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_timeslots', params: { startTimes: ['08:00', '10:15'] } }),
    })
    assert(okTimeslots.status === 201, 'allowed_timeslots is accepted')
    const okTimeslotsBody = await okTimeslots.json() as any
    assert(okTimeslotsBody.weight === 3, 'restriction defaults to priority 3')

    const okStability = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'weekday_stability', params: {}, weight: 3 }),
    })
    assert(okStability.status === 201, 'param-less weekday_stability is accepted')

    const okPrecede = await fetch(`${base}/modules/${mod.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'module_must_precede', params: { moduleIds: ['uw_other_module'] } }),
    })
    assert(okPrecede.status === 201, 'module_must_precede is accepted')

    // remove the new-type module restrictions again so the inheritance
    // section below sees a module without own restrictions
    const modList = await (await fetch(`${base}/modules/${mod.id}/restrictions`, { headers: auth(adminCookie) })).json() as any[]
    for (const r of modList) {
      await fetch(`${base}/modules/${mod.id}/restrictions/${r.id}`, { method: 'DELETE', headers: auth(adminCookie) })
    }

    // ── CRUD on department (the top of the chain) ───────────────────────
    console.log('CRUD...')
    const createRes = await fetch(`${base}/departments/${department.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'allowed_weekdays', params: { weekdays: ['monday', 'tuesday'] } }),
    })
    assert(createRes.status === 201, 'creates department restriction')
    const created = await createRes.json() as any
    assert(created.enabled === true, 'restriction defaults to enabled')
    assert(created.weight === 3, 'restriction defaults to priority 3')

    const listRes = await fetch(`${base}/departments/${department.id}/restrictions`, { headers: auth(adminCookie) })
    const list = await listRes.json() as any[]
    assert(listRes.status === 200 && list.length === 1, 'lists department restrictions')

    const updRes = await fetch(`${base}/departments/${department.id}/restrictions/${created.id}`, {
      method: 'PUT', headers: auth(adminCookie),
      body: JSON.stringify({ params: { weekdays: ['friday'] } }),
    })
    assert(updRes.status === 200, 'updates restriction params')
    const updated = await updRes.json() as any
    assert(updated.ruleType === 'allowed_weekdays', 'update keeps rule type when omitted')

    // ── Inheritance resolution ──────────────────────────────────────────
    console.log('Inheritance...')
    await fetch(`${base}/programs/${program.id}/restrictions`, {
      method: 'POST', headers: auth(adminCookie),
      body: JSON.stringify({ ruleType: 'excluded_dates', params: { dates: ['2026-12-25'] } }),
    })

    const effMod = await fetch(`${base}/modules/${mod.id}/restrictions/effective`, { headers: auth(adminCookie) })
    assert(effMod.status === 200, 'effective restrictions resolve for module')
    const effective = await effMod.json() as any[]
    const ownCount = effective.filter((r) => !r.inheritedFrom).length
    const inheritedCount = effective.filter((r) => !!r.inheritedFrom).length
    assert(ownCount === 0 && inheritedCount >= 2, 'module effective list has no own but inherits from ancestors')
    const inheritedTables = new Set(effective.filter((r) => !!r.inheritedFrom).map((r) => r.inheritedFrom.table))
    assert(inheritedTables.has('departments') && inheritedTables.has('programs'), 'inherits from department and program levels')

    const effDeg = await fetch(`${base}/degrees/${degree.id}/restrictions/effective`, { headers: auth(adminCookie) })
    const effDegList = await effDeg.json() as any[]
    assert(effDeg.status === 200 && effDegList.some((r) => r.inheritedFrom?.table === 'departments'), 'degree inherits department restrictions')

    // ── Access control ──────────────────────────────────────────────────
    console.log('Access control...')
    const byReader = await fetch(`${base}/departments/${department.id}/restrictions`, {
      method: 'POST', headers: auth(readerCookie), body: JSON.stringify({ ruleType: 'fixed_day', params: { weekday: 'monday' } }),
    })
    assert(byReader.status === 403, 'user without entity access cannot add restriction')

    // grant program-level write to ProgramAdmin; they may then maintain
    // restrictions on child degrees (inherited write access)
    const grant = await fetch(`${base}/programs/${program.id}/access`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ userId: programAdmin.id, role: 'write' }),
    })
    assert(grant.status === 201, 'admin grants program access')
    const childByProgramAdmin = await fetch(`${base}/degrees/${degree.id}/restrictions`, {
      method: 'POST', headers: auth(programAdminCookie),
      body: JSON.stringify({ ruleType: 'fixed_day', params: { weekday: 'tuesday' }, weight: 4 }),
    })
    assert(childByProgramAdmin.status === 201, 'parent-entity write role can add restrictions to child entity')
    const createdChild = await childByProgramAdmin.json() as any
    assert(createdChild.weight === 4, 'soft restriction keeps provided priority')

    const outsiderDeg = await fetch(`${base}/degrees/${degree.id}/restrictions/effective`, { headers: auth(outsiderCookie) })
    assert(outsiderDeg.status === 403, 'outsider cannot read effective restrictions')

    // reader can read the department but not write restrictions
    const readGrant = await fetch(`${base}/departments/${department.id}/access`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ userId: reader.id, role: 'read' }),
    })
    assert(readGrant.status === 201, 'admin grants read on department')
    const readerList = await fetch(`${base}/departments/${department.id}/restrictions`, { headers: auth(readerCookie) })
    assert(readerList.status === 200, 'reader can list restrictions')
    const readerDel = await fetch(`${base}/departments/${department.id}/restrictions/${created.id}`, {
      method: 'DELETE', headers: auth(readerCookie),
    })
    assert(readerDel.status === 403, 'reader cannot delete restrictions')

    // ── Delete ──────────────────────────────────────────────────────────
    const delRes = await fetch(`${base}/departments/${department.id}/restrictions/${created.id}`, {
      method: 'DELETE', headers: auth(adminCookie),
    })
    assert(delRes.status === 200, 'deletes restriction')
    const delAgain = await fetch(`${base}/departments/${department.id}/restrictions/${created.id}`, {
      method: 'DELETE', headers: auth(adminCookie),
    })
    assert(delAgain.status === 404, 'deleting a missing restriction returns 404')

    // ── Unknown table / entity ──────────────────────────────────────────
    const unknownTable = await fetch(`${base}/nope/${department.id}/restrictions`, { headers: auth(adminCookie) })
    assert(unknownTable.status === 404, 'unknown table returns 404')
    const unknownEntity = await fetch(`${base}/departments/uw_missing/restrictions`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ ruleType: 'fixed_day', params: { weekday: 'monday' } }),
    })
    assert(unknownEntity.status === 404, 'unknown entity returns 404')

    // ── Cleanup test data ───────────────────────────────────────────────
    const pool = getPool()
    await pool.query(`DELETE FROM entity_restrictions WHERE entity_id IN ($1, $2, $3, $4)`, [department.id, program.id, degree.id, mod.id])
    await pool.query(`DELETE FROM entity_access WHERE table_name IN ('departments','programs') AND entity_id IN ($1, $2)`, [department.id, program.id])
    await pool.query(`DELETE FROM modules WHERE id = $1`, [mod.id])
    await pool.query(`DELETE FROM degrees WHERE id = $1`, [degree.id])
    await pool.query(`DELETE FROM programs WHERE id = $1`, [program.id])
    await pool.query(`DELETE FROM departments WHERE id = $1`, [department.id])
    await pool.query(`DELETE FROM curriculums WHERE id = $1`, [curriculum.id])
    await pool.query(`DELETE FROM local_users WHERE id IN ('rstr_global_admin','rstr_program_admin','rstr_reader','rstr_outsider')`)

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (failed > 0) throw new Error('Some tests failed')

    server.close(() => {
      closeDb().catch(() => {}).finally(() => process.exit(0))
    })
  } catch (err) {
    console.error('Test execution failed:', err)
    server.close(() => {
      closeDb().catch(() => {}).finally(() => process.exit(1))
    })
  }
}

main().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})