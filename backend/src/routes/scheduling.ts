import { Router, Response } from 'express'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { requireScheduler } from '../auth/middleware'

export const schedulingRouter = Router()

/**
 * Module <-> Lecturer mapping. These endpoints bypass the per-entity ACL of
 * the generic entity router deliberately: schedulers need read access to all
 * lecturers/modules and write access to the mapping join table only.
 *
 * Every active user account is considered a lecturer by default; accounts with
 * is_not_lecturer are excluded. Guest lecturers (rows without user_id) stay
 * as-is. For each included account lacking a lecturers row, one is created.
 */

schedulingRouter.get(
  '/mapping',
  requireScheduler,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getPool()

      // Provision: one lecturer per active, opted-in user account that has no
      // linked lecturer row yet. Idempotent; runs inside a transaction.
      const provision = await pool.query(
        `WITH eligible AS (
           SELECT u.id,
                  COALESCE(NULLIF(u.display_name, ''), NULLIF(u.local_name, ''), u.name, u.id) AS lecturer_name
           FROM local_users u
           WHERE u.is_active
             AND NOT u.is_not_lecturer
             AND NOT EXISTS (SELECT 1 FROM lecturers l WHERE l.user_id = u.id)
         )
         INSERT INTO lecturers (id, name, user_id)
         SELECT 'uw_lec_' || md5(u.id::text || random()::text),
                u.lecturer_name,
                u.id
         FROM eligible u
         RETURNING user_id, name`,
      )
      if (provision.rows.length > 0) {
        console.log(`[Scheduling] Provisioned ${provision.rows.length} lecturer row(s) from user accounts`)
      }

      const lecturersRes = await pool.query(
        `SELECT l.id, l.name, l.department_id, l.contact,
                u.display_name AS user_display_name, u.name AS user_name,
                u.email AS user_email, u.is_not_lecturer,
                d.name AS department_name
         FROM lecturers l
         LEFT JOIN local_users u ON u.id = l.user_id
         LEFT JOIN departments d ON d.id = l.department_id
         -- Exclude lecturers whose linked account has opted out.
         WHERE l.user_id IS NULL OR NOT COALESCE(u.is_not_lecturer, false)
         ORDER BY l.name ASC`,
      )

      const departmentsRes = await pool.query(
        `SELECT d.id, d.name,
                (SELECT jsonb_agg(p.id ORDER BY p.name)
                 FROM programs p
                 WHERE p.department_ids @> to_jsonb(ARRAY[d.id]::text[])) AS program_ids
         FROM departments d
         ORDER BY d.name ASC`,
      )

      const programsRes = await pool.query(
        `SELECT p.id, p.name, p.department_ids, p.curriculum_id
         FROM programs p
         ORDER BY p.name ASC`,
      )

      const degreesRes = await pool.query(
        `SELECT g.id, g.name, g.program_ids
         FROM degrees g
         ORDER BY g.name ASC`,
      )

      const modulesRes = await pool.query(
        `SELECT m.id, m.code, m.name, m.degree_ids, m.curriculum_version_id
         FROM modules m
         ORDER BY m.code ASC, m.name ASC`,
      )

      const versionsRes = await pool.query(
        `SELECT v.id, v.name, v.program_id
         FROM curriculum_versions v
         ORDER BY v.name ASC`,
      )

      const pairsRes = await pool.query(
        `SELECT lecturer_id, module_id FROM module_lecturers`,
      )

      res.json({
        lecturers: lecturersRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          departmentId: r.department_id || '',
          departmentName: r.department_name || '',
          displayLabel: r.user_display_name || r.user_name || '',
          contact: r.contact || r.user_email || '',
          /** True for lecturer rows auto-provisioned from a user account. */
          isAccountBased: !!r.user_name || !!r.user_display_name,
        })),
        departments: departmentsRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          programIds: r.program_ids || [],
        })),
        programs: programsRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          departmentIds: r.department_ids || [],
          curriculumId: r.curriculum_id || '',
        })),
        degrees: degreesRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          programIds: r.program_ids || [],
        })),
        modules: modulesRes.rows.map((r: any) => ({
          id: r.id,
          code: r.code || '',
          name: r.name,
          degreeIds: r.degree_ids || [],
          curriculumVersionId: r.curriculum_version_id || '',
        })),
        curriculumVersions: versionsRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          programId: r.program_id || '',
        })),
        pairs: pairsRes.rows.map((r: any) => ({
          lecturerId: r.lecturer_id,
          moduleId: r.module_id,
        })),
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load mapping' })
    }
  },
)

interface MappingPairInput {
  lecturerId: string
  moduleId: string
  value: 0 | 1
}

schedulingRouter.post(
  '/mapping/pairs',
  requireScheduler,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body || {}
      const rawPairs = Array.isArray(body.pairs) ? body.pairs : []
      if (rawPairs.length === 0) {
        res.status(400).json({ error: 'pairs must be a non-empty array' })
        return
      }
      if (rawPairs.length > 20000) {
        res.status(413).json({ error: 'Too many pairs in one request (max 20000)' })
        return
      }

      const pairs: MappingPairInput[] = []
      for (const raw of rawPairs) {
        const lecturerId = String(raw?.lecturerId ?? raw?.lecturer_id ?? '')
        const moduleId = String(raw?.moduleId ?? raw?.module_id ?? '')
        if (!lecturerId || !moduleId) {
          res.status(400).json({ error: 'Each pair requires lecturerId and moduleId' })
          return
        }
        pairs.push({ lecturerId, moduleId, value: raw.value ? 1 : 0 })
      }

      // Apply atomically in one transaction.
      const pool = getPool()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const toSet = pairs.filter(p => p.value === 1)
        const toClear = pairs.filter(p => p.value === 0)

        if (toSet.length > 0) {
          const params: unknown[] = []
          const tuples = toSet.map((p, i) => {
            params.push(p.lecturerId, p.moduleId, req.sessionUser!.id)
            const b = i * 3
            return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 3}, NOW(), NOW())`
          })
          await client.query(
            `INSERT INTO module_lecturers (lecturer_id, module_id, created_by, created_at, updated_at)
             VALUES ${tuples.join(', ')}
             ON CONFLICT (lecturer_id, module_id) DO NOTHING`,
            params,
          )
        }

        if (toClear.length > 0) {
          const params: unknown[] = []
          const tuples = toClear.map((p, i) => {
            params.push(p.lecturerId, p.moduleId)
            const b = i * 2
            return `($${b + 1}, $${b + 2})`
          })
          await client.query(
            `DELETE FROM module_lecturers
             WHERE (lecturer_id, module_id) IN (VALUES ${tuples.join(', ')})`,
            params,
          )
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }

      res.json({ applied: pairs.map(p => ({ lecturerId: p.lecturerId, moduleId: p.moduleId, value: p.value })) })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to apply mapping changes' })
    }
  },
)