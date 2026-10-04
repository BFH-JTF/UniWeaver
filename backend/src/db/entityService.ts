import type { Pool } from 'pg'
import {
  TABLE_SPECS,
  genEntityId,
  payloadToRowPayload,
  rowToEntity,
  assertAdminOfAll,
  EntityHttpError,
} from './entities'
import type { TableSpec } from './entities'
import { grantEntityAccess, countEntityAdmins } from './access'
import type { AccessRole } from './access'

export { EntityHttpError, TABLE_SPECS }
export type { TableSpec, AccessRole }

export async function requireTable(tableName: string): Promise<TableSpec> {
  const spec = TABLE_SPECS[tableName]
  if (!spec) throw new EntityHttpError(404, `Unknown collection: ${tableName}`)
  return spec
}

/** Create-time validation for columns that must be present and non-empty. */
function assertRequiredColumns(spec: TableSpec, payload: Record<string, unknown>): void {
  for (const camel of spec.requiredColumns ?? []) {
    const value = payload[camel]
    if (value === undefined || value === null || value === '') {
      const label = camel.charAt(0).toUpperCase() + camel.slice(1)
      throw new EntityHttpError(400, `${label} is required`)
    }
  }
}

export async function fetchEntities(
  pool: Pool,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const spec = await requireTable(tableName)
  const res = await pool.query(`SELECT * FROM ${spec.dbTable} ORDER BY created_at ASC`)
  const rows = res.rows.map(r => rowToEntity(spec, r))
  await resolveCreatedByNames(pool, rows)
  return rows
}

export async function fetchEntity(
  pool: Pool,
  tableName: string,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const spec = await requireTable(tableName)
  const res = await pool.query(`SELECT * FROM ${spec.dbTable} WHERE id = $1`, [entityId])
  const rows = res.rows.map(r => rowToEntity(spec, r))
  await resolveCreatedByNames(pool, rows)
  return rows.length > 0 ? rows[0] : null
}

/** Resolves `created_by` user ids to display names (`createdByName`). */
async function resolveCreatedByNames(
  pool: Pool,
  rows: Record<string, unknown>[],
): Promise<void> {
  const ids = [...new Set(rows.map(r => r.createdBy).filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (ids.length === 0) return
  const res = await pool.query<{ id: string; display_name: string | null; local_name: string | null; name: string | null }>(
    `SELECT id, display_name, local_name, name FROM local_users WHERE id = ANY($1)`,
    [ids],
  )
  const names = new Map<string, string>()
  for (const u of res.rows) {
    names.set(u.id, u.display_name || u.local_name || u.name || u.id)
  }
  for (const r of rows) {
    if (typeof r.createdBy === 'string') {
      r.createdByName = names.get(r.createdBy) ?? r.createdBy
    }
  }
}

export async function createEntity(
  pool: Pool,
  tableName: string,
  payload: Record<string, unknown>,
  creatorUserId: string,
  isGlobalAdmin: boolean,
): Promise<Record<string, unknown>> {
  const spec = await requireTable(tableName)

  if (spec.nameRequired) {
    const name = payload.name
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new EntityHttpError(400, 'Name is required')
    }
  }
  assertRequiredColumns(spec, payload)

  // The creator of an entity is recorded server-side; client-supplied values
  // are ignored. Only tables whose schema has a created_by column get it.
  const { row: mappedRow, extra, parentIds } = payloadToRowPayload(spec, payload)
  const hasCreatedBy = spec.columns.some(c => c.column === 'created_by')
  const row = hasCreatedBy ? { ...mappedRow, created_by: creatorUserId } : mappedRow

  // Creation authority follows the object hierarchy:
  // - shared tables (semesters, curriculum versions), departments and programs
  //   are reserved for global administrators;
  // - degrees must be tied to administered programs;
  // - modules must be tied to administered degrees.
  if (!spec.parentKey || !spec.parentTable) {
    if (!isGlobalAdmin) {
      throw new EntityHttpError(403, 'Administrator access required')
    }
  } else {
    if (parentIds.length === 0) {
      throw new EntityHttpError(400, `At least one ${spec.parentLabel} is required`)
    }
    await assertAdminOfAll(pool, spec.parentTable, spec.parentLabel ?? 'parent', parentIds, creatorUserId, isGlobalAdmin)
  }

  // Curriculum containment: programs only exist as part of a curriculum.
  const curriculumId = typeof row.curriculum_id === 'string' ? row.curriculum_id : ''
  if (spec.dbTable === 'programs' && !curriculumId) {
    throw new EntityHttpError(400, 'A curriculum is required: programs cannot exist without a curriculum')
  }
  if (curriculumId) {
    const curriculum = await pool.query(`SELECT id FROM curriculums WHERE id = $1`, [curriculumId])
    if (curriculum.rows.length === 0) {
      throw new EntityHttpError(400, 'Unknown curriculum')
    }
    if (!spec.parentTable && !isGlobalAdmin) {
      const admin = await pool.query(
        `SELECT 1 FROM entity_access WHERE table_name = 'curriculums' AND entity_id = $1 AND user_id = $2 AND role = 'admin'`,
        [curriculumId, creatorUserId],
      )
      if (admin.rows.length === 0) {
        throw new EntityHttpError(403, 'Administrator access required for the referenced curriculum')
      }
    }
  }

  // Modules and classes only exist within a curriculum version.
  const versionId = typeof row.curriculum_version_id === 'string' ? row.curriculum_version_id : ''
  if ((spec.dbTable === 'modules' || spec.dbTable === 'class_entities') && !versionId) {
    throw new EntityHttpError(400, 'A curriculum version is required')
  }
  if (versionId) {
    const version = await pool.query(`SELECT id FROM curriculum_versions WHERE id = $1`, [versionId])
    if (version.rows.length === 0) {
      throw new EntityHttpError(400, 'Unknown curriculum version')
    }
  }

  const id = genEntityId()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (spec.kind === 'audited') {
      const cols = ['id', ...Object.keys(row), 'extra', 'created_at', 'updated_at']
      const extraPlaceholder = `$${Object.keys(row).length + 2}::jsonb`
      const placeholders = [
        '$1',
        ...Object.keys(row).map((_, i) => `$${i + 2}`),
        extraPlaceholder,
        'NOW()',
        'NOW()',
      ]
      await client.query(
        `INSERT INTO ${spec.dbTable} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        [id, ...Object.values(row), JSON.stringify(extra)],
      )
    } else {
      const cols = ['id', ...Object.keys(row)]
      const placeholders = ['$1', ...Object.keys(row).map((_, i) => `$${i + 2}`)]
      await client.query(
        `INSERT INTO ${spec.dbTable} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        [id, ...Object.values(row)],
      )
    }
    await grantEntityAccess(client, tableName, id, creatorUserId, 'admin')
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  const saved = await fetchEntity(pool, tableName, id)
  if (!saved) throw new EntityHttpError(500, 'Entity vanished after insert')
  return saved
}

export async function updateEntity(
  pool: Pool,
  tableName: string,
  entityId: string,
  payload: Record<string, unknown>,
  actingUserId: string,
  isGlobalAdmin: boolean,
): Promise<Record<string, unknown> | null> {
  const spec = await requireTable(tableName)
  const { row, extra, parentIds } = payloadToRowPayload(spec, payload)

  // createdBy is maintained server-side only; ignore client-supplied values.
  delete row.created_by

  // Required columns cannot be cleared by an update.
  for (const camel of spec.requiredColumns ?? []) {
    const c = spec.columns.find(cc => cc.camel === camel)
    if (c && (row[c.column] === '' || row[c.column] === null)) {
      throw new EntityHttpError(400, `${camel.charAt(0).toUpperCase()}${camel.slice(1)} is required`)
    }
  }

  // Parent re-ties must be administered by the acting user (global admins
  // bypass). An update that leaves the parent list unchanged is a plain
  // field edit, which write users are allowed to do.
  if (spec.parentKey && spec.parentTable && parentIds.length > 0) {
    const current = await fetchEntity(pool, tableName, entityId)
    if (!current) {
      throw new EntityHttpError(404, 'Entity not found')
    }
    const camelKey = spec.parentKey
    const currentIds = Array.isArray(current[camelKey]) ? (current[camelKey] as string[]) : []
    const changed =
      currentIds.length !== parentIds.length ||
      parentIds.some(id => !currentIds.includes(id))
    if (changed) {
      await assertAdminOfAll(pool, spec.parentTable, spec.parentLabel ?? 'parent', parentIds, actingUserId, isGlobalAdmin)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query(`SELECT id FROM ${spec.dbTable} WHERE id = $1 FOR UPDATE`, [entityId])
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1
    for (const [colName, value] of Object.entries(row)) {
      sets.push(`${colName} = $${idx++}`)
      values.push(value)
    }
    if (spec.kind === 'audited') {
      const extraRes = await client.query<{ extra: unknown }>(
        `SELECT extra FROM ${spec.dbTable} WHERE id = $1`,
        [entityId],
      )
      const currentExtra = (extraRes.rows[0]?.extra ?? {}) as Record<string, unknown>
      for (const key of Object.keys(row)) {
        const c = spec.columns.find(cc => cc.column === key)
        for (const alias of [c?.camel, ...(c?.aliases ?? [])]) {
          if (alias) delete currentExtra[alias]
        }
      }
      const mergedExtra = { ...currentExtra, ...extra }
      sets.push(`extra = $${idx++}::jsonb`)
      values.push(JSON.stringify(mergedExtra))
      sets.push('updated_at = NOW()')
    } else {
      sets.push('updated_at = NOW()')
    }
    values.push(entityId)
    await client.query(`UPDATE ${spec.dbTable} SET ${sets.join(', ')} WHERE id = $${idx}`, values)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  return fetchEntity(pool, tableName, entityId)
}

export async function removeEntity(pool: Pool, tableName: string, entityId: string): Promise<boolean> {
  const spec = await requireTable(tableName)
  void spec
  const res = await pool.query(`DELETE FROM ${spec.dbTable} WHERE id = $1`, [entityId])
  return (res.rowCount ?? 0) > 0
}

export { countEntityAdmins }

export async function copyCurriculumVersion(
  pool: Pool,
  sourceVersionId: string,
  targetCurriculumId: string,
  newVersionNumber: number,
): Promise<Record<string, unknown>> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const sourceRes = await client.query(
      `SELECT * FROM curriculum_versions WHERE id = $1`,
      [sourceVersionId],
    )
    if (sourceRes.rows.length === 0) {
      throw new EntityHttpError(404, 'Source version not found')
    }
    const source = sourceRes.rows[0]

    const newVersionId = genEntityId()
    await client.query(
      `INSERT INTO curriculum_versions (id, name, description, version_number, semester_id, curriculum_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        newVersionId,
        source.name,
        source.description,
        newVersionNumber,
        source.semester_id,
        targetCurriculumId,
        source.created_by,
      ],
    )

    const programsRes = await client.query(
      `SELECT * FROM programs WHERE curriculum_id = $1`,
      [targetCurriculumId],
    )

    for (const program of programsRes.rows) {
      const newProgramId = genEntityId()
      await client.query(
        `INSERT INTO programs (id, name, description, department_ids, curriculum_id, contact, url, extra, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          newProgramId,
          program.name,
          program.description,
          program.department_ids,
          targetCurriculumId,
          program.contact,
          program.url,
          program.extra,
        ],
      )

      const degreesRes = await client.query(
        `SELECT * FROM degrees WHERE program_ids @> $1::jsonb`,
        [JSON.stringify([program.id])],
      )

      for (const degree of degreesRes.rows) {
        const newDegreeId = genEntityId()
        await client.query(
          `INSERT INTO degrees (id, name, description, program_ids, contact, url, extra, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            newDegreeId,
            degree.name,
            degree.description,
            JSON.stringify([newProgramId]),
            degree.contact,
            degree.url,
            degree.extra,
          ],
        )

        const modulesRes = await client.query(
          `SELECT * FROM modules WHERE degree_ids @> $1::jsonb AND curriculum_version_id = $2`,
          [JSON.stringify([degree.id]), sourceVersionId],
        )

        for (const module of modulesRes.rows) {
          const newModuleId = genEntityId()
          await client.query(
            `INSERT INTO modules (id, name, code, description, degree_ids, curriculum_version_id, competency_ids, proof_ids, credit_points, timeslots, contact, url, extra, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
            [
              newModuleId,
              module.name,
              module.code,
              module.description,
              JSON.stringify([newDegreeId]),
              newVersionId,
              module.competency_ids,
              module.proof_ids,
              module.credit_points,
              module.timeslots,
              module.contact,
              module.url,
              module.extra,
            ],
          )

          const classesRes = await client.query(
            `SELECT * FROM class_entities WHERE module_ids @> $1::jsonb AND curriculum_version_id = $2`,
            [JSON.stringify([module.id]), sourceVersionId],
          )

          for (const cls of classesRes.rows) {
            await client.query(
              `INSERT INTO class_entities (id, name, code, description, semester_id, curriculum_version_id, degree_id, module_ids, size, contact, url, extra, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
              [
                genEntityId(),
                cls.name,
                cls.code,
                cls.description,
                cls.semester_id,
                newVersionId,
                newDegreeId,
                JSON.stringify([newModuleId]),
                cls.size,
                cls.contact,
                cls.url,
                cls.extra,
              ],
            )
          }
        }
      }
    }

    await client.query('COMMIT')

    const saved = await fetchEntity(pool, 'curriculum_versions', newVersionId)
    if (!saved) throw new EntityHttpError(500, 'Version vanished after copy')
    return saved
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}