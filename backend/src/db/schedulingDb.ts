import type { Pool } from 'pg'

/**
 * Every active user account is considered a lecturer by default; accounts with
 * is_not_lecturer are excluded. Guest lecturers (rows without user_id) stay
 * as-is. For each included account lacking a lecturers row, one is created.
 */
export async function provisionLecturersFromUsers(pool: Pool): Promise<number> {
  const result = await pool.query(
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
  return result.rows.length
}