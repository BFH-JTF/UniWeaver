import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Pool, PoolClient } from 'pg'

export function getDbConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'uniweaver',
    user: process.env.POSTGRES_USER || 'uniweaver',
    password: process.env.POSTGRES_PASSWORD || 'uniweaver',
    connectionTimeoutMillis: 3000,
  }
}

function getMigrationsDir(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  // src/db -> src/migrations (migrations live next to the source, not under db/)
  const candidate = path.join(currentDir, '..', 'migrations')
  if (existsSync(candidate)) return candidate
  // compiled/fallback layout: repoRoot/backend/src/migrations
  return path.join(currentDir, 'migrations')
}

export async function runMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const applied = new Set<string>()
  const appliedRes = await client.query<{ name: string }>('SELECT name FROM schema_migrations')
  for (const row of appliedRes.rows) {
    applied.add(row.name)
  }

  const migrationsDir = getMigrationsDir()
  for (const file of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    console.log(`[Database] Applied migration ${file}`)
  }
}

export async function initDatabase(pool: Pool): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await runMigrations(client)
    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}