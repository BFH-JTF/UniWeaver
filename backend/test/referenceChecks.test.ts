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
  console.log('Starting UniWeaver reference check tests...')
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SESSION_SECRET

  const dbReady = await initDb()
  assert(dbReady, 'database is connected')
  if (!dbReady) process.exit(1)

  const server = (await startServer(3458)) as Server
  const base = 'http://localhost:3458/api'

  const globalAdmin = makeUser('user_ref_admin', true)

  const adminCookie = await cookieFor(globalAdmin)

  function auth(): Record<string, string> {
    return { 'Content-Type': 'application/json', Cookie: adminCookie }
  }

  const pool = getPool()

  async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: auth(), body: JSON.stringify(body) })
    const json = await res.json()
    if (res.status >= 400) console.error(`  [${res.status}] POST ${path}:`, JSON.stringify(json))
    return { status: res.status, json }
  }
  async function del(path: string): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: auth() })
    return { status: res.status, json: await res.json() }
  }
  async function get(path: string): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${path}`, { headers: auth() })
    return { status: res.status, json: await res.json().catch(() => ({})) }
  }

  try {
    const seedUser = globalAdmin
    await pool.query(
      `INSERT INTO local_users (id, oidc_issuer, oidc_subject, name, email, is_admin, roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
      [seedUser.id, seedUser.oidc_issuer, seedUser.oidc_subject, seedUser.name, seedUser.email, seedUser.is_admin, JSON.stringify(seedUser.roles)],
    )

    // ── Department referenced by a program (JSONB array) ─────────────────
    console.log('Department referenced by program...')
    const deptRes = await post('/departments', { name: 'Referenced Dept' })
    assert(deptRes.status === 201, 'department created')
    const dept = deptRes.json

    const currRes = await post('/curriculums', { name: 'RefCheck Curriculum' })
    assert(currRes.status === 201, 'curriculum created')
    const curriculum = currRes.json

    const progRes = await post('/programs', {
      name: 'RefCheck Prog', curriculumId: curriculum.id, departmentIds: [dept.id],
    })
    assert(progRes.status === 201, 'program created with department reference')
    const program = progRes.json

    const lecturerId = `uw_reflect_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const lecturerInsert = await pool.query(
      `INSERT INTO lecturers (id, name, department_id) VALUES ($1, 'RefCheck Lecturer', $2) RETURNING id`,
      [lecturerId, dept.id],
    )
    assert(lecturerInsert.rows.length === 1, 'lecturer created with department reference')
    const lecturer = { id: lecturerInsert.rows[0].id, name: 'RefCheck Lecturer' }

    const refsRes = await get(`/departments/${dept.id}/references`)
    assert(refsRes.status === 200, 'references endpoint returns 200')
    const refs = refsRes.json.references as any[]
    const progRef = refs.find(r => r.key === 'programs.departmentIds')
    const lectRef = refs.find(r => r.key === 'lecturers.departmentId')
    assert(!!progRef && progRef.count === 1 && progRef.severity === 'breaks', 'program array reference detected as breaks')
    assert(!!progRef && progRef.sampleNames.includes('RefCheck Prog'), 'program reference sample names resolved')
    assert(!!lectRef && lectRef.count === 1, 'lecturer FK reference detected')

    const delBlocked = await del(`/departments/${dept.id}`)
    assert(delBlocked.status === 409, 'delete without confirm is blocked with 409')
    assert(Array.isArray(delBlocked.json.references), '409 body carries reference list')

    const delConfirmed = await del(`/departments/${dept.id}?confirm=true`)
    assert(delConfirmed.status === 200, 'delete with confirm=true succeeds')

    const progAfter = await get(`/programs/${program.id}`)
    assert(progAfter.status === 200, 'program survives department deletion')
    assert(Array.isArray(progAfter.json.departmentIds) && progAfter.json.departmentIds.length === 0, 'program.departmentIds auto-cleaned')
    const lectAfter = await get(`/lecturers/${lecturer.id}`)
    assert(lectAfter.status === 200, 'lecturer survives')
    assert(!lectAfter.json.departmentId, 'lecturer departmentId cleared (SET NULL)')
    const accessGone = await pool.query(
      `SELECT count(*)::int AS count FROM entity_access WHERE entity_id = $1`, [dept.id],
    )
    assert(accessGone.rows[0].count === 0, 'department ACL rows removed')
    const deptGone = await get(`/departments/${dept.id}`)
    assert(deptGone.status === 404, 'department gone after delete')

    // ── Curriculum deletion cascades to versions/modules ─────────────────
    console.log('Curriculum cascade...')
    const versionsRes = await get('/curriculum_versions')
    const version = (versionsRes.json as any[]).find(v => v.curriculumId === curriculum.id)
    assert(!!version, 'curriculum has a V1 version')

    const degRes = await post('/degrees', { name: 'RefCheck Degree', programIds: [program.id] })
    assert(degRes.status === 201, 'degree created')
    const degree = degRes.json

    const modRes = await post('/modules', {
      name: 'RefCheck Module', code: 'RC-1', degreeIds: [degree.id], curriculumVersionId: version.id, creditPoints: 5,
    })
    assert(modRes.status === 201, 'module created')
    const mod = modRes.json

    const clsRes = await post('/classes', {
      name: 'RefCheck Class', curriculumVersionId: version.id, degreeId: degree.id, moduleIds: [mod.id],
    })
    assert(clsRes.status === 201, 'class created with module reference')
    const cls = clsRes.json

    const modRefs = await get(`/modules/${mod.id}/references`)
    const modRefList = modRefs.json.references as any[]
    const clsModRef = modRefList.find(r => r.key === 'class_entities.moduleIds')
    assert(!!clsModRef && clsModRef.count === 1, 'module referenced by class detected')
    const lessonInsert = await pool.query(
      `INSERT INTO lessons (id, module_id, name) VALUES ($1, $2, 'RefCheck Lesson') RETURNING id`,
      [`uw_reflesson_${Date.now()}`, mod.id],
    )
    assert(lessonInsert.rowCount === 1, 'lesson row inserted for cascade test')
    const lessonId = lessonInsert.rows[0].id

    const modDelBlocked = await del(`/modules/${mod.id}`)
    assert(modDelBlocked.status === 409, 'module delete blocked while referenced by class')

    const currRefs = await get(`/curriculums/${curriculum.id}/references`)
    const currRefList = currRefs.json.references as any[]
    const currVersions = currRefList.find(r => r.key === 'curriculum_versions')
    const currModules = currRefList.find(r => r.key === 'modules')
    const currLessons = currRefList.find(r => r.key === 'lessons')
    assert(!!currVersions && currVersions.count === 1 && currVersions.severity === 'cascade', 'curriculum version cascade detected')
    assert(!!currModules && currModules.count === 1 && currModules.severity === 'cascade', 'module cascade detected')
    assert(!!currLessons && currLessons.count === 1 && currLessons.severity === 'cascade', 'lesson cascade detected')

    const currDelBlocked = await del(`/curriculums/${curriculum.id}`)
    assert(currDelBlocked.status === 409, 'curriculum delete blocked while in use')

    const currDel = await del(`/curriculums/${curriculum.id}?confirm=true`)
    assert(currDel.status === 200, 'curriculum delete with confirm succeeds')
    const modGone = await get(`/modules/${mod.id}`)
    assert(modGone.status === 404, 'module cascaded away')
    const versionGone = await get(`/curriculum_versions/${version.id}`)
    assert(versionGone.status === 404, 'version cascaded away')
    const versionRows = await pool.query(`SELECT count(*)::int AS count FROM curriculum_versions WHERE id = $1`, [version.id])
    assert(versionRows.rows[0].count === 0, 'version row removed')
    const lessonRows = await pool.query(`SELECT count(*)::int AS count FROM lessons WHERE id = $1`, [lessonId])
    assert(lessonRows.rows[0].count === 0, 'lesson row cascaded away')
    const progAfterCurr = await get(`/programs/${program.id}`)
    // the program belonged to the curriculum; SET NULL cleared the link
    assert(progAfterCurr.status === 200 && !progAfterCurr.json.curriculumId, 'program curriculum link cleared (SET NULL)')

    // ── Degree delete cleans module.degreeIds ────────────────────────────
    console.log('Degree delete cleans modules...')
    const modRows = await pool.query(`SELECT degree_ids FROM modules WHERE id = $1`, [mod.id])
    assert(modRows.rows.length === 0, 'module already removed with curriculum')

    const mod2 = await post('/modules', {
      name: 'RefCheck Module 2', code: 'RC-2', degreeIds: [degree.id], curriculumVersionId: null,
    })
    assert(mod2.status === 400, 'module without curriculum version still rejected')

    const degDelBlocked = await del(`/degrees/${degree.id}`)
    assert(degDelBlocked.status === 409, 'degree delete blocked (referenced by classes via FK)')
    const degDel = await del(`/degrees/${degree.id}?confirm=true`)
    assert(degDel.status === 200, 'degree delete with confirm succeeds')
    const clsAfter = await get(`/classes/${cls.id}`)
    assert(clsAfter.status === 200 && !clsAfter.json.degreeId, 'class degreeId cleared')

    // ── Semester cascade destroys weeks and rules ────────────────────────
    console.log('Semester cascade...')
    const semRes = await post('/semesters', { name: 'RefCheck Semester' })
    assert(semRes.status === 201, 'semester created')
    const sem = semRes.json
    await pool.query(
      `INSERT INTO weeks (id, semester_id, semester_week) VALUES ($1, $2, 1)`,
      [`uw_refweek_${Date.now()}`, sem.id],
    )
    await pool.query(
      `INSERT INTO scheduling_rules (id, rule_type, semester_id) VALUES ($1, 'no-friday-afternoon', $2)`,
      [`uw_refrule_${Date.now()}`, sem.id],
    )
    const semRefs = await get(`/semesters/${sem.id}/references`)
    const semRefList = semRefs.json.references as any[]
    const weekRef = semRefList.find(r => r.key === 'weeks')
    const ruleRef = semRefList.find(r => r.key === 'scheduling_rules')
    assert(!!weekRef && weekRef.count === 1 && weekRef.severity === 'cascade', 'week cascade detected')
    assert(!!ruleRef && ruleRef.count === 1 && ruleRef.severity === 'cascade', 'scheduling rule cascade detected')
    const semDel = await del(`/semesters/${sem.id}?confirm=true`)
    assert(semDel.status === 200, 'semester delete with confirm succeeds')
    const weekRows = await pool.query(`SELECT count(*)::int AS count FROM weeks WHERE semester_id = $1`, [sem.id])
    const ruleRows = await pool.query(`SELECT count(*)::int AS count FROM scheduling_rules WHERE semester_id = $1`, [sem.id])
    assert(weekRows.rows[0].count === 0, 'weeks destroyed with semester')
    assert(ruleRows.rows[0].count === 0, 'scheduling rules destroyed with semester')

    // ── Unknown table references endpoint ────────────────────────────────
    console.log('Unknown collections...')
    const unknownRefs = await get(`/not_a_table/xyz/references`)
    assert(unknownRefs.status === 404, 'references on unknown collection returns 404')
    const unknownDel = await del(`/not_a_table/xyz`)
    assert(unknownDel.status === 404, 'delete on unknown collection returns 404')

    // ── Locations referenced by rooms (SET NULL) ─────────────────────────
    console.log('Location referenced by room...')
    const locId = `uw_refloc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await pool.query(`INSERT INTO locations (id, name) VALUES ($1, 'RefCheck Location')`, [locId])
    const roomId = `uw_refroom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await pool.query(`INSERT INTO rooms (id, name, location_id) VALUES ($1, 'RefCheck Room', $2)`, [roomId, locId])
    const locRefs = await get(`/scheduling/locations/${locId}/references`)
    const locRefList = locRefs.json.references as any[]
    const roomRef = locRefList.find(r => r.key === 'rooms.locationId')
    assert(!!roomRef && roomRef.count === 1, 'room FK reference on location detected')
    const locDelBlocked = await del(`/scheduling/locations/${locId}`)
    assert(locDelBlocked.status === 409, 'location delete blocked while referenced by room')
    const locDel = await del(`/scheduling/locations/${locId}?confirm=true`)
    assert(locDel.status === 200, 'location delete with confirm succeeds')
    const roomAfter = await pool.query(`SELECT location_id FROM rooms WHERE id = $1`, [roomId])
    assert(roomAfter.rows.length === 1 && roomAfter.rows[0].location_id === null, 'room location link cleared')
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId])

    // ── Cleanup test data ────────────────────────────────────────────────
    await pool.query(`DELETE FROM entity_access WHERE user_id = 'user_ref_admin'`)
    await pool.query(`DELETE FROM lessons WHERE name = 'RefCheck Lesson'`)
    await pool.query(`DELETE FROM module_lecturers`)
    await pool.query(`DELETE FROM entity_restrictions WHERE entity_id LIKE 'uw_%'`)
    await pool.query(`DELETE FROM modules WHERE name LIKE 'RefCheck%'`)
    await pool.query(`DELETE FROM class_entities WHERE name LIKE 'RefCheck%'`)
    await pool.query(`DELETE FROM degrees WHERE name LIKE 'RefCheck%'`)
    await pool.query(`DELETE FROM programs WHERE name LIKE 'RefCheck%'`)
    await pool.query(`DELETE FROM curriculum_versions WHERE curriculum_id IN (SELECT id FROM curriculums WHERE name = 'RefCheck Curriculum')`)
    await pool.query(`DELETE FROM curriculums WHERE name = 'RefCheck Curriculum'`)
    await pool.query(`DELETE FROM lecturers WHERE name = 'RefCheck Lecturer'`)
    await pool.query(`DELETE FROM semesters WHERE name = 'RefCheck Semester'`)
    await pool.query(`DELETE FROM weeks WHERE semester_week = 1 AND id LIKE 'uw_refweek%'`)
    await pool.query(`DELETE FROM scheduling_rules WHERE rule_type = 'no-friday-afternoon' AND id LIKE 'uw_refrule%'`)
    await pool.query(`DELETE FROM locations WHERE name = 'RefCheck Location'`)
    await pool.query(`DELETE FROM entity_access WHERE entity_id IN (SELECT id FROM departments WHERE name = 'Referenced Dept')`)
    await pool.query(`DELETE FROM departments WHERE name = 'Referenced Dept'`)
    await pool.query(`DELETE FROM local_users WHERE id = 'user_ref_admin'`)

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