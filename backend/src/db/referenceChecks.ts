import type { Pool } from 'pg'
import { TABLE_SPECS, EntityHttpError } from './entities'

/**
 * Referential-integrity checks for entity deletion.
 *
 * References fall into three severities:
 * - `cascade`: dependent rows are destroyed together with the entity
 *   (DB-level ON DELETE CASCADE, e.g. semester → weeks/scheduling rules).
 * - `breaks`: references become dangling or silently nulled (JSONB id arrays
 *   with no DB constraint, FK columns with ON DELETE SET NULL).
 * - `cleanup`: join/restriction/access rows that are removed without data loss.
 *
 * The registry backs both the preflight endpoint (`findEntityReferences`) and
 * the guarded delete transaction (`deleteEntityWithCleanup`), which auto-cleans
 * JSONB arrays and ACL/restriction rows that the database schema cannot reach
 * (they reference entities by value, not by FK).
 */

export type ReferenceSeverity = 'cascade' | 'breaks' | 'cleanup'

export interface ReferenceFinding {
  key: string
  label: string
  severity: ReferenceSeverity
  count: number
  sampleNames: string[]
}

interface ArrayCleanup {
  table: string
  column: string
}

interface RefCheck {
  key: string
  label: string
  severity: ReferenceSeverity
  countSql: string
  sampleSql?: string
  /** JSONB array cleanup executed during the delete transaction. */
  clean?: ArrayCleanup
}

function arrayCount(table: string, column: string): string {
  return `SELECT count(*)::int AS count FROM ${table} WHERE ${column} @> to_jsonb($1::text)`
}

function arraySample(table: string, column: string): string {
  return `SELECT name FROM ${table} WHERE ${column} @> to_jsonb($1::text) ORDER BY name LIMIT 5`
}

function fkCount(table: string, column: string, where = ''): string {
  return `SELECT count(*)::int AS count FROM ${table} WHERE ${column} = $1${where}`
}

function fkSample(table: string, column: string, nameExpr = 'name'): string {
  return `SELECT ${nameExpr} AS name FROM ${table} WHERE ${column} = $1 ORDER BY 1 LIMIT 5`
}

function restrictionCount(...tableNames: string[]): string {
  const list = tableNames.map(t => `'${t}'`).join(', ')
  return `SELECT count(*)::int AS count FROM entity_restrictions WHERE table_name IN (${list}) AND entity_id = $1`
}

/** Extra entity ids that die together with the entity (curriculum cascades). */
interface ChildIdSource {
  table: string
  sql: string
}

const CHILD_IDS: Record<string, ChildIdSource[]> = {
  curriculums: [
    {
      table: 'curriculum_versions',
      sql: `SELECT id FROM curriculum_versions WHERE curriculum_id = $1`,
    },
    {
      table: 'modules',
      sql: `SELECT m.id FROM modules m JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1`,
    },
  ],
  curriculum_versions: [
    {
      table: 'modules',
      sql: `SELECT id FROM modules WHERE curriculum_version_id = $1`,
    },
  ],
}

const REGISTRY: Record<string, RefCheck[]> = {
  departments: [
    {
      key: 'programs.departmentIds',
      label: 'Programs',
      severity: 'breaks',
      countSql: arrayCount('programs', 'department_ids'),
      sampleSql: arraySample('programs', 'department_ids'),
      clean: { table: 'programs', column: 'department_ids' },
    },
    {
      key: 'lecturers.departmentId',
      label: 'Lecturers (department link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('lecturers', 'department_id'),
      sampleSql: fkSample('lecturers', 'department_id', 'COALESCE(NULLIF(name, \'\'), id)'),
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('departments'),
    },
  ],
  lecturers: [
    {
      key: 'schedule_entries.lecturerIds',
      label: 'Schedule entries',
      severity: 'breaks',
      countSql: arrayCount('schedule_entries', 'lecturer_ids'),
      sampleSql: fkSample('schedule_entries', 'id', `to_char(start_time, 'HH24:MI') || ' (' || weekday || ')'`),
      clean: { table: 'schedule_entries', column: 'lecturer_ids' },
    },
    {
      key: 'module_lecturers',
      label: 'Module assignments',
      severity: 'cleanup',
      countSql: fkCount('module_lecturers', 'lecturer_id'),
    },
    {
      key: 'lecturer_unavailability',
      label: 'Unavailability windows',
      severity: 'cleanup',
      countSql: fkCount('lecturer_unavailability', 'lecturer_id'),
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('lecturers'),
    },
  ],
  semesters: [
    {
      key: 'weeks',
      label: 'Semester weeks',
      severity: 'cascade',
      countSql: fkCount('weeks', 'semester_id'),
      sampleSql: fkSample('weeks', 'semester_id', `'Week ' || semester_week`),
    },
    {
      key: 'scheduling_rules',
      label: 'Scheduling rules',
      severity: 'cascade',
      countSql: fkCount('scheduling_rules', 'semester_id'),
      sampleSql: fkSample('scheduling_rules', 'semester_id', `COALESCE(NULLIF(description, ''), rule_type)`),
    },
    {
      key: 'schedule_runs',
      label: 'Schedule runs',
      severity: 'cascade',
      countSql: fkCount('schedule_runs', 'semester_id'),
      sampleSql: fkSample('schedule_runs', 'semester_id', 'name'),
    },
    {
      key: 'curriculum_versions.semesterId',
      label: 'Curriculum versions (semester link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('curriculum_versions', 'semester_id'),
      sampleSql: fkSample('curriculum_versions', 'semester_id', 'name'),
    },
    {
      key: 'class_entities.semesterId',
      label: 'Classes (semester link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('class_entities', 'semester_id'),
      sampleSql: fkSample('class_entities', 'semester_id', 'name'),
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('semesters'),
    },
  ],
  curriculums: [
    {
      key: 'curriculum_versions',
      label: 'Curriculum versions',
      severity: 'cascade',
      countSql: fkCount('curriculum_versions', 'curriculum_id'),
      sampleSql: fkSample('curriculum_versions', 'curriculum_id', 'name'),
    },
    {
      key: 'modules',
      label: 'Modules',
      severity: 'cascade',
      countSql: `SELECT count(*)::int AS count FROM modules m JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1`,
      sampleSql: `SELECT m.name AS name FROM modules m JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1 ORDER BY 1 LIMIT 5`,
    },
    {
      key: 'lessons',
      label: 'Lessons',
      severity: 'cascade',
      countSql: `SELECT count(*)::int AS count FROM lessons l JOIN modules m ON l.module_id = m.id JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1`,
      sampleSql: `SELECT l.name AS name FROM lessons l JOIN modules m ON l.module_id = m.id JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1 ORDER BY 1 LIMIT 5`,
    },
    {
      key: 'programs.curriculumId',
      label: 'Programs (curriculum link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('programs', 'curriculum_id'),
      sampleSql: fkSample('programs', 'curriculum_id', 'name'),
    },
    {
      key: 'class_entities.curriculumVersionId',
      label: 'Classes (curriculum version link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('class_entities', 'curriculum_version_id', ' AND curriculum_version_id IN (SELECT id FROM curriculum_versions WHERE curriculum_id = $1)'),
      sampleSql: `SELECT ce.name AS name FROM class_entities ce WHERE ce.curriculum_version_id IN (SELECT id FROM curriculum_versions WHERE curriculum_id = $1) ORDER BY 1 LIMIT 5`,
    },
    {
      key: 'module_lecturers',
      label: 'Module lecturer assignments',
      severity: 'cleanup',
      countSql: `SELECT count(*)::int AS count FROM module_lecturers ml JOIN modules m ON ml.module_id = m.id JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1`,
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: `SELECT count(*)::int AS count FROM entity_restrictions WHERE (table_name = 'curriculums' AND entity_id = $1) OR (table_name = 'curriculum_versions' AND entity_id IN (SELECT id FROM curriculum_versions WHERE curriculum_id = $1)) OR (table_name = 'modules' AND entity_id IN (SELECT m.id FROM modules m JOIN curriculum_versions cv ON m.curriculum_version_id = cv.id WHERE cv.curriculum_id = $1))`,
    },
  ],
  curriculum_versions: [
    {
      key: 'modules',
      label: 'Modules',
      severity: 'cascade',
      countSql: fkCount('modules', 'curriculum_version_id'),
      sampleSql: fkSample('modules', 'curriculum_version_id', 'name'),
    },
    {
      key: 'lessons',
      label: 'Lessons',
      severity: 'cascade',
      countSql: `SELECT count(*)::int AS count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.curriculum_version_id = $1`,
      sampleSql: `SELECT l.name AS name FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.curriculum_version_id = $1 ORDER BY 1 LIMIT 5`,
    },
    {
      key: 'class_entities.curriculumVersionId',
      label: 'Classes (version link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('class_entities', 'curriculum_version_id'),
      sampleSql: fkSample('class_entities', 'curriculum_version_id', 'name'),
    },
    {
      key: 'curriculums.activeVersionId',
      label: 'Curriculum active-version pointer will be cleared',
      severity: 'breaks',
      countSql: fkCount('curriculums', 'active_version_id'),
      sampleSql: fkSample('curriculums', 'active_version_id', 'name'),
    },
    {
      key: 'module_lecturers',
      label: 'Module lecturer assignments',
      severity: 'cleanup',
      countSql: `SELECT count(*)::int AS count FROM module_lecturers ml JOIN modules m ON ml.module_id = m.id WHERE m.curriculum_version_id = $1`,
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: `SELECT count(*)::int AS count FROM entity_restrictions WHERE (table_name = 'curriculum_versions' AND entity_id = $1) OR (table_name = 'modules' AND entity_id IN (SELECT id FROM modules WHERE curriculum_version_id = $1))`,
    },
  ],
  programs: [
    {
      key: 'degrees.programIds',
      label: 'Degrees',
      severity: 'breaks',
      countSql: arrayCount('degrees', 'program_ids'),
      sampleSql: arraySample('degrees', 'program_ids'),
      clean: { table: 'degrees', column: 'program_ids' },
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('programs'),
    },
  ],
  degrees: [
    {
      key: 'modules.degreeIds',
      label: 'Modules',
      severity: 'breaks',
      countSql: arrayCount('modules', 'degree_ids'),
      sampleSql: arraySample('modules', 'degree_ids'),
      clean: { table: 'modules', column: 'degree_ids' },
    },
    {
      key: 'class_entities.degreeId',
      label: 'Classes (degree link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('class_entities', 'degree_id'),
      sampleSql: fkSample('class_entities', 'degree_id', 'name'),
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('degrees'),
    },
  ],
  modules: [
    {
      key: 'lessons',
      label: 'Lessons',
      severity: 'cascade',
      countSql: fkCount('lessons', 'module_id'),
      sampleSql: fkSample('lessons', 'module_id', 'name'),
    },
    {
      key: 'class_entities.moduleIds',
      label: 'Classes',
      severity: 'breaks',
      countSql: arrayCount('class_entities', 'module_ids'),
      sampleSql: arraySample('class_entities', 'module_ids'),
      clean: { table: 'class_entities', column: 'module_ids' },
    },
    {
      key: 'schedule_entries.moduleIds',
      label: 'Schedule entries',
      severity: 'breaks',
      countSql: arrayCount('schedule_entries', 'module_ids'),
      sampleSql: fkSample('schedule_entries', 'id', `to_char(start_time, 'HH24:MI') || ' (' || weekday || ')'`),
      clean: { table: 'schedule_entries', column: 'module_ids' },
    },
    {
      key: 'module_lecturers',
      label: 'Lecturer assignments',
      severity: 'cleanup',
      countSql: fkCount('module_lecturers', 'module_id'),
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('modules'),
    },
  ],
  classes: [
    {
      key: 'schedule_entries.classIds',
      label: 'Schedule entries',
      severity: 'breaks',
      countSql: arrayCount('schedule_entries', 'class_ids'),
      sampleSql: fkSample('schedule_entries', 'id', `to_char(start_time, 'HH24:MI') || ' (' || weekday || ')'`),
      clean: { table: 'schedule_entries', column: 'class_ids' },
    },
    {
      key: 'entity_restrictions',
      label: 'Scheduling restrictions',
      severity: 'cleanup',
      countSql: restrictionCount('class_entities'),
    },
  ],
  locations: [
    {
      key: 'rooms.locationId',
      label: 'Rooms (location link will be cleared)',
      severity: 'breaks',
      countSql: fkCount('rooms', 'location_id'),
      sampleSql: fkSample('rooms', 'location_id', 'name'),
    },
  ],
  rooms: [
    {
      key: 'room_availability',
      label: 'Room availability',
      severity: 'cascade',
      countSql: fkCount('room_availability', 'room_id'),
      sampleSql: fkSample('room_availability', 'room_id', `weekday`),
    },
    {
      key: 'schedule_entries.roomIds',
      label: 'Schedule entries',
      severity: 'breaks',
      countSql: arrayCount('schedule_entries', 'room_ids'),
      sampleSql: fkSample('schedule_entries', 'id', `to_char(start_time, 'HH24:MI') || ' (' || weekday || ')'`),
      clean: { table: 'schedule_entries', column: 'room_ids' },
    },
  ],
}

/** Deletable collections including scheduling tables that live outside TABLE_SPECS. */
const DELETABLE_DB_TABLES: Record<string, string> = {} // collection name → db table
for (const [collection, spec] of Object.entries(TABLE_SPECS)) {
  DELETABLE_DB_TABLES[collection] = spec.dbTable
}
DELETABLE_DB_TABLES.locations = 'locations'
DELETABLE_DB_TABLES.rooms = 'rooms'

export function isReferenceChecked(table: string): boolean {
  return REGISTRY[table] !== undefined
}

export async function findEntityReferences(
  pool: Pool,
  tableName: string,
  entityId: string,
): Promise<ReferenceFinding[]> {
  const checks = REGISTRY[tableName]
  if (!checks) throw new EntityHttpError(404, `Unknown collection: ${tableName}`)
  const out: ReferenceFinding[] = []
  for (const check of checks) {
    const res = await pool.query(check.countSql, [entityId])
    const count = Number(res.rows[0]?.count ?? 0)
    if (count <= 0) continue
    let sampleNames: string[] = []
    if (check.sampleSql) {
      const sampleRes = await pool.query(check.sampleSql, [entityId])
      sampleNames = sampleRes.rows.map(r => String(r.name)).filter(Boolean)
    }
    out.push({ key: check.key, label: check.label, severity: check.severity, count, sampleNames })
  }
  return out
}

/**
 * Deletes an entity inside a transaction and cleans up everything the schema
 * cannot cascade on its own: entity_access + entity_restrictions rows of the
 * entity and its cascade-deleted children, and JSONB array references
 * (e.g. `modules.degree_ids`, `schedule_entries.room_ids`).
 * FK-based cascades (weeks, lessons, module_lecturers, ...) are left to the
 * `ON DELETE CASCADE` constraints.
 */
export async function deleteEntityWithCleanup(
  pool: Pool,
  tableName: string,
  entityId: string,
): Promise<boolean> {
  const dbTable = DELETABLE_DB_TABLES[tableName]
  const checks = REGISTRY[tableName]
  if (!dbTable || !checks) throw new EntityHttpError(404, `Unknown collection: ${tableName}`)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const exists = await client.query(`SELECT id FROM ${dbTable} WHERE id = $1`, [entityId])
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK')
      return false
    }

    if (TABLE_SPECS[tableName]) {
      const affectedIds = [entityId]
      for (const child of CHILD_IDS[tableName] ?? []) {
        const res = await client.query(child.sql, [entityId])
        affectedIds.push(...res.rows.map(r => String(r.id)))
      }
      await client.query(`DELETE FROM entity_access WHERE entity_id = ANY($1)`, [affectedIds])
      await client.query(`DELETE FROM entity_restrictions WHERE entity_id = ANY($1)`, [affectedIds])
    }

    for (const check of checks) {
      if (!check.clean) continue
      await client.query(
        `UPDATE ${check.clean.table} SET ${check.clean.column} = ${check.clean.column} - $1::text
         WHERE ${check.clean.column} @> to_jsonb($1::text)`,
        [entityId],
      )
    }

    await client.query(`DELETE FROM ${dbTable} WHERE id = $1`, [entityId])
    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}