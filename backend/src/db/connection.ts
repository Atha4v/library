import fs from 'fs'
import path from 'path'
import config from '../config/index.js'
import type { DbClient, DbDriver, DbMode, QueryResult } from '../types/index.js'

let driver: DbDriver | null = null
let mode: DbMode = 'pglite'

async function createPostgresDriver(databaseUrl: string): Promise<DbDriver> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  })

  try {
    await pool.query('SELECT 1')
  } catch (err: unknown) {
    await pool.end().catch(() => {})
    const code = (err as { code?: string }).code
    if (code === '28P01') {
      throw new Error(
        'Postgres password authentication failed. Check DATABASE_URL in backend/.env ' +
          '(user/password), or leave DATABASE_URL empty to use local PGlite.',
      )
    }
    if (code === 'ECONNREFUSED') {
      throw new Error(
        'Could not connect to Postgres at DATABASE_URL. Is Postgres running? ' +
          'Or leave DATABASE_URL empty to use local PGlite.',
      )
    }
    throw err
  }

  return {
    query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
      const result = await pool.query(text, params)
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount ?? result.rows.length,
      } satisfies QueryResult<T>
    },
    exec: async (text: string) => {
      await pool.query(text)
    },
    transaction: async <T>(fn: (tx: DbClient) => Promise<T>) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn({
          query: async <R = Record<string, unknown>>(text: string, params: unknown[] = []) => {
            const res = await client.query(text, params)
            return {
              rows: res.rows as R[],
              rowCount: res.rowCount ?? res.rows.length,
            }
          },
        })
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },
  }
}

async function createPgliteDriver(dataDir: string): Promise<DbDriver> {
  const { PGlite } = await import('@electric-sql/pglite')
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new PGlite(dataDir)
  await db.waitReady

  return {
    query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
      const result = await db.query(text, params)
      const rows = (result.rows ?? []) as T[]
      return {
        rows,
        rowCount: (result as { affectedRows?: number }).affectedRows ?? rows.length,
      }
    },
    exec: async (text: string) => {
      await db.exec(text)
    },
    transaction: async <T>(fn: (tx: DbClient) => Promise<T>) => {
      await db.query('BEGIN')
      try {
        const result = await fn({
          query: async <R = Record<string, unknown>>(text: string, params: unknown[] = []) => {
            const res = await db.query(text, params)
            const rows = (res.rows ?? []) as R[]
            return {
              rows,
              rowCount: (res as { affectedRows?: number }).affectedRows ?? rows.length,
            }
          },
        })
        await db.query('COMMIT')
        return result
      } catch (err) {
        await db.query('ROLLBACK')
        throw err
      }
    },
  }
}

export async function connectDb(): Promise<{ mode: DbMode }> {
  if (config.db.databaseUrl) {
    driver = await createPostgresDriver(config.db.databaseUrl)
    mode = 'postgres'
    console.log('Connected to PostgreSQL via DATABASE_URL')
  } else {
    driver = await createPgliteDriver(config.db.dataDir)
    mode = 'pglite'
    const schemaPath = path.join(config.sqlDir, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    await driver.exec(schema)
    console.log(`Using embedded PGlite at ${config.db.dataDir}`)
  }

  return { mode }
}

export function getDb(): DbDriver {
  if (!driver) throw new Error('Database not initialized. Call connectDb() first.')
  return driver
}

export function getDbMode(): DbMode {
  return mode
}
