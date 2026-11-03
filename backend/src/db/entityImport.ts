import type { Pool } from 'pg'
import { genEntityId, payloadToRowPayload, rowToEntity, assertAdminOfAll, assertExistenceOfAll, EntityHttpError } from './entities'
import { grantEntityAccess } from './access'
import { requireTable, assertRequiredColumns, resolveCreatedByNames } from './entityCommon'

export interface ImportRowError {
  /** zero-based index of the failing row in the request */
  row: number
  message: string
}

/** Validation failure of a batch import; carries one entry per failing row. */
export class EntityImportError extends EntityHttpError {
  details: ImportRowError[]
  constructor(message: string, details: ImportRowError[]) {
    super(400, message)
    this.details = details
  }
}

/** Memoizes admin-of-parent checks for repeated parent sets across rows. */
async function assertAdminOfAllCached(
  pool: Pool,
  parentTable: string,
  parentLabel: string,
  ids: string[],
  userId: string,
  isGlobalAdmin: boolean,
  cache: Map<string, { ok: boolean; status: number; message: string }>,
): Promise<void> {
  const key = `${parentTable}|${[...ids].sort().join(',')}|${userId}|${isGlobalAdmin ? 'g' : 'u'}`
  const hit = cache.get(key)
  if (hit) {
    if (hit.ok) return
    throw new EntityHttpError(hit.status, hit.message)
  }
  try {
    await assertAdminOfAll(pool, parentTable, parentLabel, ids, userId, isGlobalAdmin)
    cache.set(key, { ok: true, status: 0, message: '' })
  } catch (err) {
    const status = err instanceof EntityHttpError ? err.status : 400
    const message = err instanceof Error ? err.message : 'Parent check failed'
    cache.set(key, { ok: false, status, message })
    throw err
  }
}

/**
 * Creates many entities in one all-or-nothing transaction. Every row is
 * validated exactly like createEntity would (name, required columns, parent
 * authority, containment, referenced ids) before any write happens; failing
 * rows are collected into EntityImportError.details so callers can surface
 * all problems at once. Rows are never partially imported.
 */
export async function importEntities(
  pool: Pool,
  tableName: string,
  payloads: unknown,
  creatorUserId: string,
  isGlobalAdmin: boolean,
): Promise<Record<string, unknown>[]> {
  const spec = await requireTable(tableName)
  if (!Array.isArray(payloads)) {
    throw new EntityHttpError(400, 'rows must be an array')
  }
  const payloadRows = payloads as Record<string, unknown>[]
  if (payloadRows.length === 0) {
    throw new EntityHttpError(400, 'At least one row is required')
  }

  const hasCreatedBy = spec.columns.some(c => c.column === 'created_by')
  const errors: ImportRowError[] = []
  const prepared: { row: Record<string, unknown>; extra: Record<string, unknown> }[] = []
  const adminCache = new Map<string, { ok: boolean; status: number; message: string }>()

  for (let idx = 0; idx < payloadRows.length; idx++) {
    try {
      const payload = payloadRows[idx] ?? {}
      if (spec.nameRequired) {
        const name = payload.name
        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new EntityHttpError(400, 'Name is required')
        }
      }
      assertRequiredColumns(spec, payload)

      const { row: mappedRow, extra, parentIds, existenceIds } = payloadToRowPayload(spec, payload)
      const row = hasCreatedBy ? { ...mappedRow, created_by: creatorUserId } : mappedRow

      // Creation authority follows the object hierarchy (see createEntity).
      if (!spec.parentKey || !spec.parentTable) {
        if (!isGlobalAdmin) {
          throw new EntityHttpError(403, 'Administrator access required')
        }
      } else {
        if (parentIds.length === 0) {
          throw new EntityHttpError(400, `At least one ${spec.parentLabel} is required`)
        }
        await assertAdminOfAllCached(
          pool, spec.parentTable, spec.parentLabel ?? 'parent', parentIds, creatorUserId, isGlobalAdmin, adminCache,
        )
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

      // Referenced JSON-array ids must exist (e.g. programs -> departments).
      for (const ref of spec.existenceRefs ?? []) {
        const ids = existenceIds[ref.key] ?? []
        if (ids.length > 0) {
          await assertExistenceOfAll(pool, ref.table, ref.label, ids)
        }
      }

      prepared.push({ row, extra })
    } catch (err) {
      errors.push({
        row: idx,
        message: err instanceof Error ? err.message : 'Invalid row',
      })
    }
  }

  if (errors.length > 0) {
    throw new EntityImportError(`Import validation failed: ${errors.length} of ${payloadRows.length} rows invalid`, errors)
  }

  const ids = prepared.map(() => genEntityId())
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < prepared.length; i++) {
      const { row, extra } = prepared[i]
      const id = ids[i]
      if (spec.kind === 'audited') {
        const cols = ['id', ...Object.keys(row), 'extra', 'created_at', 'updated_at']
        const extraPlaceholder = `$${Object.keys(row).length + 2}::jsonb`
        const placeholders = [
          '$1',
          ...Object.keys(row).map((_, j) => `$${j + 2}`),
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
        const placeholders = ['$1', ...Object.keys(row).map((_, j) => `$${j + 2}`)]
        await client.query(
          `INSERT INTO ${spec.dbTable} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          [id, ...Object.values(row)],
        )
      }
      await grantEntityAccess(client, tableName, id, creatorUserId, 'admin')
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  const savedRes = await pool.query(`SELECT * FROM ${spec.dbTable} WHERE id = ANY($1)`, [ids])
  await resolveCreatedByNames(pool, savedRes.rows)
  const entities = savedRes.rows.map(r => rowToEntity(spec, r))
  const byId = new Map(entities.map(e => [String(e.id), e]))
  return ids.map(id => byId.get(id)).filter((e): e is Record<string, unknown> => !!e)
}

