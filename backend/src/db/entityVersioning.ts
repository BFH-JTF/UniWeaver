import type { Pool } from 'pg'
import { genEntityId, EntityHttpError } from './entities'
import { fetchEntity } from './entityService'

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
            `INSERT INTO modules (id, name, code, description, degree_ids, curriculum_version_id, competency_ids, proof_ids, credit_points, timeslots, installments, contact, url, extra, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
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
              module.installments,
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