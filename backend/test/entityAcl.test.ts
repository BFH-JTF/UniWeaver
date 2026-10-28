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
  console.log('Starting UniWeaver entity ACL tests...')
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SESSION_SECRET

  const dbReady = await initDb()
  assert(dbReady, 'database is connected')
  if (!dbReady) process.exit(1)

  const server = (await startServer(3457)) as Server
  const base = 'http://localhost:3457/api'

  const globalAdmin = makeUser('user_global_admin', true)
  const creator = makeUser('user_creator', false)
  const writer = makeUser('user_writer', false)
  const reader = makeUser('user_reader', false)
  const outsider = makeUser('user_outsider', false)

  const adminCookie = await cookieFor(globalAdmin)
  const creatorCookie = await cookieFor(creator)
  const writerCookie = await cookieFor(writer)
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
    for (const u of [globalAdmin, creator, writer, reader, outsider]) await seedUser(u)

    // ── Auth required ────────────────────────────────────────────────────
    console.log('Auth guards...')
    const anon = await fetch(`${base}/programs`)
    assert(anon.status === 401, 'list programs without session returns 401')

    // ── Program creation (global admin only) ────────────────────────────
    console.log('Curriculums + containment...')
    const currRes = await fetch(`${base}/curriculums`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'ACL Curriculum' }),
    })
    assert(currRes.status === 201, 'global admin creates curriculum (with V1)')
    const curriculum = await currRes.json() as any
    assert(!!curriculum.id, 'curriculum has id')

    const progByUserNoCurr = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Nope' }),
    })
    assert(progByUserNoCurr.status === 400, 'program without curriculum is rejected')

    console.log('Programs...')
    const progByUser = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({ name: 'Nope', curriculumId: curriculum.id }),
    })
    assert(progByUser.status === 403, 'non-admin cannot create program')

    const progRes = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'BSc Inf', description: 'x', curriculumId: curriculum.id }),
    })
    assert(progRes.status === 201, 'global admin creates program')
    const program = await progRes.json() as any
    assert(!!program.id, 'program has id')
    assert(program._isAdmin === true, 'creator gets admin flag on created program')

    // ── Reference existence validation (program -> departments) ─────────
    console.log('Reference existence checks...')
    const deptRes = await fetch(`${base}/departments`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Existence Dept' }),
    })
    assert(deptRes.status === 201, 'global admin creates department')
    const dept = await deptRes.json() as any

    const progBadRef = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'BSc Ref', curriculumId: curriculum.id, departmentIds: ['uw_missing_dept_id'] }),
    })
    assert(progBadRef.status === 400, 'program with unknown department id is rejected')

    const progGoodRef = await fetch(`${base}/programs`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'BSc Ref', curriculumId: curriculum.id, departmentIds: [dept.id] }),
    })
    assert(progGoodRef.status === 201, 'program with existing department id is created')
    const refProgram = await progGoodRef.json() as any
    assert(Array.isArray(refProgram.departmentIds) && refProgram.departmentIds.includes(dept.id), 'program persists department ids')

    const refUpdSame = await fetch(`${base}/programs/${refProgram.id}`, {
      method: 'PUT', headers: auth(adminCookie), body: JSON.stringify({ description: 'same references' }),
    })
    assert(refUpdSame.status === 200, 'program update without changed references succeeds')

    const refUpdBad = await fetch(`${base}/programs/${refProgram.id}`, {
      method: 'PUT', headers: auth(adminCookie), body: JSON.stringify({ departmentIds: ['uw_missing_dept_id'] }),
    })
    assert(refUpdBad.status === 400, 'program update introducing unknown department id is rejected')

    // ── ACL on program: grant reader/writer to others ───────────────────
    console.log('Access management on program...')
    const grantReader = await fetch(`${base}/programs/${program.id}/access`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ userId: reader.id, role: 'read' }),
    })
    assert(grantReader.status === 201, 'admin grants read access')

    const grantWriter = await fetch(`${base}/programs/${program.id}/access`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ userId: writer.id, role: 'write' }),
    })
    assert(grantWriter.status === 201, 'admin grants write access')

    const grantByWriter = await fetch(`${base}/programs/${program.id}/access`, {
      method: 'POST', headers: auth(writerCookie), body: JSON.stringify({ userId: outsider.id, role: 'read' }),
    })
    assert(grantByWriter.status === 403, 'write user cannot manage access')

    const accessList = await fetch(`${base}/programs/${program.id}/access`, { headers: auth(adminCookie) })
    assert(accessList.status === 200, 'object admin reads access list')
    const accessEntries = await accessList.json() as any[]
    assert(accessEntries.length === 3, 'access list contains 3 entries')

    // ── Visibility: reader sees the program, outsider does not ─────────
    console.log('Visibility filtering...')
    const readerList = await fetch(`${base}/programs`, { headers: auth(readerCookie) })
    const readerPrograms = await readerList.json() as any[]
    assert(readerPrograms.length === 1, 'reader sees exactly the shared program')
    assert(readerPrograms[0]._canEdit === false, 'reader cannot edit')
    const outsiderList = await fetch(`${base}/programs`, { headers: auth(outsiderCookie) })
    const outsiderPrograms = await outsiderList.json() as any[]
    assert(outsiderPrograms.length === 0, 'outsider sees no programs')

    // ── Write vs admin rights ───────────────────────────────────────────
    console.log('Write vs admin rights...')
    const updByWriter = await fetch(`${base}/programs/${program.id}`, {
      method: 'PUT', headers: auth(writerCookie), body: JSON.stringify({ description: 'changed' }),
    })
    assert(updByWriter.status === 200, 'write user updates program')
    const delByWriter = await fetch(`${base}/programs/${program.id}`, { method: 'DELETE', headers: auth(writerCookie) })
    assert(delByWriter.status === 403, 'write user cannot delete')
    const delByReader = await fetch(`${base}/programs/${program.id}`, { method: 'PUT', headers: auth(readerCookie), body: JSON.stringify({ description: 'nope' }) })
    assert(delByReader.status === 403, 'read user cannot update')

    // ── Degree creation tied to administered program ────────────────────
    console.log('Degree creation rules...')
    const degByOutsider = await fetch(`${base}/degrees`, {
      method: 'POST', headers: auth(outsiderCookie), body: JSON.stringify({ name: 'X', programIds: [program.id] }),
    })
    assert(degByOutsider.status === 403, 'non-admin of program cannot create degree')
    const degUntied = await fetch(`${base}/degrees`, {
      method: 'POST', headers: auth(writerCookie), body: JSON.stringify({ name: 'X', programIds: [] }),
    })
    assert(degUntied.status === 400, 'untied degree creation is rejected for non-global-admin')
    const degRes = await fetch(`${base}/degrees`, {
      method: 'POST', headers: auth(writerCookie), body: JSON.stringify({ name: 'BSc Inf (writer)', programIds: [program.id] }),
    })
    assert(degRes.status === 403, 'write user cannot create degree (needs program admin)')
    const degAdmin = await fetch(`${base}/programs/${program.id}/access`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ userId: creator.id, role: 'admin' }),
    })
    assert(degAdmin.status === 201, 'admin grants program admin to creator-user')
    const degRes2 = await fetch(`${base}/degrees`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({ name: 'Minor Inf', programIds: [program.id] }),
    })
    assert(degRes2.status === 201, 'program admin creates tied degree')
    const degree = await degRes2.json() as any
    assert(degree._isAdmin === true, 'degree creator becomes degree admin')

    // ── Module creation tied to administered degree ─────────────────────
    console.log('Module creation rules...')
    const versionsAcl = await fetch(`${base}/curriculum_versions`, { headers: auth(adminCookie) })
    const aclVersions = await versionsAcl.json() as any[]
    const aclVersion = aclVersions.find(v => v.curriculumId === curriculum.id)
    const modRes = await fetch(`${base}/modules`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({
        name: 'Algo', code: 'INF-01', degreeIds: [degree.id], creditPoints: 6, curriculumVersionId: aclVersion.id,
      }),
    })
    assert(modRes.status === 201, 'degree admin creates tied module')
    const mod = await modRes.json() as any
    assert(mod.degreeIds.includes(degree.id), 'module persisted with degreeIds')
    assert(mod.creditPoints === 6, 'module creditPoints persisted')

    const modNoVersion = await fetch(`${base}/modules`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'NoVer', degreeIds: [degree.id] }),
    })
    assert(modNoVersion.status === 400, 'module without curriculum version is rejected')

    // ── Batch import ─────────────────────────────────────────────────────
    console.log('Batch import...')
    const batchAnon = await fetch(`${base}/degrees/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [{ name: 'X' }] }),
    })
    assert(batchAnon.status === 401, 'batch import without session returns 401')

    const batchOk = await fetch(`${base}/degrees/import`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({ rows: [
        { name: 'Import Batch BSc', programIds: [program.id] },
        { name: 'Import Batch MSc', programIds: [program.id], description: 'desc' },
      ] }),
    })
    assert(batchOk.status === 201, 'batch import creates tied degrees')
    const batchCreated = await batchOk.json() as any[]
    assert(Array.isArray(batchCreated) && batchCreated.length === 2, 'batch import returns created entities')
    assert(batchCreated.every(d => d.id), 'batch import entities have ids')
    assert(batchCreated.every(d => d._isAdmin === true), 'batch creator gets admin flags')

    const batchBad = await fetch(`${base}/degrees/import`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({ rows: [
        { name: 'Import Fail A', programIds: [program.id] },
        { name: 'Import Fail B', programIds: ['uw_missing_program'] },
        { name: 'Import Fail C', programIds: [] },
      ] }),
    })
    assert(batchBad.status === 400, 'batch import with invalid rows is rejected wholesale')
    const batchBadBody = await batchBad.json() as any
    assert(Array.isArray(batchBadBody.details) && batchBadBody.details.length === 2, 'batch import aggregates failing rows')
    assert(batchBadBody.details.some((d: any) => d.row === 1), 'batch import reports row indices')
    assert(batchBadBody.details.some((d: any) => String(d.message).includes('Unknown program')), 'batch import reports unknown parents')

    const listAfterBatch = await fetch(`${base}/degrees`, { headers: auth(adminCookie) })
    const degreesAfterBatch = await listAfterBatch.json() as any[]
    assert(!degreesAfterBatch.some((d: any) => d.name === 'Import Fail A'), 'failed batch import leaves no partial rows')
    assert(degreesAfterBatch.some((d: any) => d.name === 'Import Batch BSc'), 'successful batch rows persist')

    // ── Class reference existence validation ─────────────────────────────
    console.log('Class reference existence checks...')
    const refSemRes = await fetch(`${base}/semesters`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Ref Existence Semester' }),
    })
    assert(refSemRes.status === 201, 'global admin creates semester')
    const refSemester = await refSemRes.json() as any

    const clsBadSem = await fetch(`${base}/classes`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Ref Existence Class', curriculumVersionId: aclVersion.id, semesterId: 'uw_missing_semester' }),
    })
    assert(clsBadSem.status === 400 && String(((await clsBadSem.json()) as any).error).includes('Unknown semester'), 'class with unknown semester id is rejected')

    const clsBadMod = await fetch(`${base}/classes`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Ref Existence Class', curriculumVersionId: aclVersion.id, moduleIds: ['uw_missing_module'] }),
    })
    assert(clsBadMod.status === 400 && String(((await clsBadMod.json()) as any).error).includes('Unknown module'), 'class with unknown module id is rejected')

    const clsOk = await fetch(`${base}/classes`, {
      method: 'POST', headers: auth(adminCookie), body: JSON.stringify({ name: 'Ref Existence Class', curriculumVersionId: aclVersion.id, semesterId: refSemester.id, degreeId: degree.id, moduleIds: [mod.id] }),
    })
    assert(clsOk.status === 201, 'class with existing references is created')
    const refClass = await clsOk.json() as any

    const clsUpdBad = await fetch(`${base}/classes/${refClass.id}`, {
      method: 'PUT', headers: auth(adminCookie), body: JSON.stringify({ moduleIds: ['uw_missing_module'] }),
    })
    assert(clsUpdBad.status === 400, 'class update introducing unknown module id is rejected')

    // ── Last-admin protection (degree: creator is its only admin) ───────
    console.log('Last-admin protection...')
    const degRemoveLast = await fetch(`${base}/degrees/${degree.id}/access/${creator.id}`, {
      method: 'DELETE', headers: auth(creatorCookie),
    })
    assert(degRemoveLast.status === 409, 'last degree admin cannot remove their own access')
    const degDemoteSelf = await fetch(`${base}/degrees/${degree.id}/access/${creator.id}`, {
      method: 'PUT', headers: auth(creatorCookie), body: JSON.stringify({ role: 'write' }),
    })
    assert(degDemoteSelf.status === 409, 'last degree admin cannot demote themselves')

    // ── Demotion works once a second admin exists ───────────────────────
    await fetch(`${base}/degrees/${degree.id}/access`, {
      method: 'POST', headers: auth(creatorCookie), body: JSON.stringify({ userId: outsider.id, role: 'admin' }),
    })
    const demote2 = await fetch(`${base}/degrees/${degree.id}/access/${creator.id}`, {
      method: 'PUT', headers: auth(creatorCookie), body: JSON.stringify({ role: 'read' }),
    })
    assert(demote2.status === 200, 'demotion succeeds once a second admin exists')

    // ── users/search now accessible to non-global-admins ────────────────
    console.log('User search for object admins...')
    const search = await fetch(`${base}/users/search?q=writer`, { headers: auth(writerCookie) })
    assert(search.status === 200, 'authenticated user can search users')
    const results = await search.json() as any[]
    assert(results.length === 1 && results[0].id === 'user_writer', 'search returns minimal fields')
    assert(!('oidc_subject' in results[0]), 'search hides OIDC subject')

    // ── Cleanup test data ───────────────────────────────────────────────
    const pool = getPool()
    await pool.query(`DELETE FROM entity_access WHERE user_id IN ('user_creator','user_writer','user_reader','user_outsider','user_global_admin')`)
    await pool.query(`DELETE FROM modules WHERE degree_ids::text LIKE '%' || (SELECT id FROM degrees WHERE name = 'Minor Inf') || '%'`)
    await pool.query(`DELETE FROM degrees WHERE name = 'Minor Inf'`)
    await pool.query(`DELETE FROM programs WHERE name = 'BSc Inf'`)
    await pool.query(`DELETE FROM curriculums WHERE name = 'ACL Curriculum'`)
    await pool.query(`DELETE FROM local_users WHERE id IN ('user_creator','user_writer','user_reader','user_outsider','user_global_admin')`)

    // Reference-existence test rows
    await pool.query(`DELETE FROM entity_access WHERE table_name = 'programs' AND entity_id IN (SELECT id FROM programs WHERE name = 'BSc Ref')`)
    await pool.query(`DELETE FROM programs WHERE name = 'BSc Ref'`)
    await pool.query(`DELETE FROM entity_access WHERE table_name = 'departments' AND entity_id IN (SELECT id FROM departments WHERE name = 'Existence Dept')`)
    await pool.query(`DELETE FROM departments WHERE name = 'Existence Dept'`)

    // Batch-import test rows
    await pool.query(`DELETE FROM entity_access WHERE table_name = 'degrees' AND entity_id IN (SELECT id FROM degrees WHERE name LIKE 'Import Batch%')`)
    await pool.query(`DELETE FROM degrees WHERE name LIKE 'Import Batch%'`)

    // Class reference-existence test rows
    await pool.query(`DELETE FROM entity_access WHERE table_name = 'classes' AND entity_id IN (SELECT id FROM class_entities WHERE name = 'Ref Existence Class')`)
    await pool.query(`DELETE FROM class_entities WHERE name = 'Ref Existence Class'`)
    await pool.query(`DELETE FROM entity_access WHERE table_name = 'semesters' AND entity_id IN (SELECT id FROM semesters WHERE name = 'Ref Existence Semester')`)
    await pool.query(`DELETE FROM semesters WHERE name = 'Ref Existence Semester'`)

    // Remove leftovers from crashed earlier runs so tests are repeatable.
    await pool.query(`DELETE FROM entity_access WHERE entity_id IN (SELECT id FROM programs WHERE name = 'BSc Inf')`)
    await pool.query(`DELETE FROM entity_restrictions WHERE entity_id IN (SELECT id FROM programs WHERE name = 'BSc Inf')`)
    await pool.query(`DELETE FROM modules WHERE curriculum_version_id IN (SELECT id FROM curriculum_versions WHERE curriculum_id IN (SELECT id FROM curriculums WHERE name = 'ACL Curriculum'))`)
    await pool.query(`DELETE FROM class_entities WHERE curriculum_version_id IN (SELECT id FROM curriculum_versions WHERE curriculum_id IN (SELECT id FROM curriculums WHERE name = 'ACL Curriculum'))`)
    await pool.query(`DELETE FROM degrees WHERE program_ids::text LIKE '%BSc Inf%' OR name = 'Minor Inf'`)
    await pool.query(`DELETE FROM programs WHERE name = 'BSc Inf'`)
    await pool.query(`DELETE FROM curriculum_versions WHERE curriculum_id IN (SELECT id FROM curriculums WHERE name = 'ACL Curriculum')`)
    await pool.query(`DELETE FROM curriculums WHERE name = 'ACL Curriculum'`)

    // ── Unknown table ───────────────────────────────────────────────────
    const unknown = await fetch(`${base}/not_a_table`, { headers: auth(adminCookie) })
    assert(unknown.status === 404, 'unknown collection returns 404')

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