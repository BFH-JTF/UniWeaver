import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { initDatabase, getDbConfig } from './migrate'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// src/db -> src -> backend -> repo root
export const appRoot = path.resolve(__dirname, '../../..')
export const reposRoot = path.resolve(appRoot, '..')

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      ...getDbConfig(),
      max: 10,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

export function isDbConnected(): boolean {
  return pool !== null
}

export async function initDb(): Promise<boolean> {
  try {
    const p = getPool()
    await initDatabase(p)
    const config = getDbConfig()
    console.log(`[Database] Connected to PostgreSQL at ${config.host}:${config.port}/${config.database}`)
    return true
  } catch (err: any) {
    console.error(`[Database] Connection or migration failed: ${err.message}`)
    pool = null
    return false
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}