/** Test-only exports + pool helpers for the scheduler unit tests. */

import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { getDbConfig } from '../db/migrate'

export { foldSessions } from '../scheduler/orchestrator'
export { complementAgainstGrid as complementAgainstGridExport, buildGridSpans as buildGridSpansExport } from '../scheduler/assemble'

export const pool = new pg.Pool(getDbConfig())

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Applies pending migrations directly (bypassing the init-once guard of initDb). */
export async function migrateForTests(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '..', 'src', 'migrations')
  if (!existsSync(migrationsDir)) return
  await pool.query(`CREATE SCHEMA IF NOT EXISTS public`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  const appliedRes = await pool.query('SELECT name FROM schema_migrations')
  const applied = new Set<string>((appliedRes.rows as Array<{ name: string }>).map((r) => r.name))
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    } catch (err) {
      // Table already exists from a previous partial run: treat as applied.
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('already exists')) {
        await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        continue
      }
      throw err
    }
  }
}

export async function closeDb(): Promise<void> {
  await pool.end()
}