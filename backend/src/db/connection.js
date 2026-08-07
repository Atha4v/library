const fs = require('fs')
const path = require('path')
const config = require('../config')
const { seedIfEmpty } = require('../sql/seed')

let driver = null
let mode = 'pglite'

async function createPostgresDriver(databaseUrl) {
  const { Pool } = require('pg')
  const pool = new Pool({
    connectionString: databaseUrl,
    // Fail fast instead of hanging when credentials/host are wrong
    connectionTimeoutMillis: 5000,
  })

  // Verify credentials immediately
  try {
    await pool.query('SELECT 1')
  } catch (err) {
    await pool.end().catch(() => {})
    if (err.code === '28P01') {
      throw new Error(
        'Postgres password authentication failed. Check DATABASE_URL in backend/.env ' +
          '(user/password), or leave DATABASE_URL empty to use local PGlite.',
      )
    }
    if (err.code === 'ECONNREFUSED') {
      throw new Error(
        'Could not connect to Postgres at DATABASE_URL. Is Postgres running? ' +
          'Or leave DATABASE_URL empty to use local PGlite.',
      )
    }
    throw err
  }

  return {
    query: (text, params) => pool.query(text, params),
    exec: async (text) => {
      await pool.query(text)
    },
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn({
          query: (text, params) => client.query(text, params),
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

async function createPgliteDriver(dataDir) {
  const { PGlite } = require('@electric-sql/pglite')
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new PGlite(dataDir)
  await db.waitReady

  return {
    query: async (text, params = []) => {
      const result = await db.query(text, params)
      return {
        rows: result.rows ?? [],
        rowCount: result.affectedRows ?? result.rows?.length ?? 0,
      }
    },
    exec: async (text) => {
      await db.exec(text)
    },
    transaction: async (fn) => {
      await db.query('BEGIN')
      try {
        const result = await fn({
          query: async (text, params = []) => {
            const res = await db.query(text, params)
            return {
              rows: res.rows ?? [],
              rowCount: res.affectedRows ?? res.rows?.length ?? 0,
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

async function connectDb() {
  if (config.db.databaseUrl) {
    // External Postgres — assume schema already applied (database/schema.sql)
    driver = await createPostgresDriver(config.db.databaseUrl)
    mode = 'postgres'
    console.log('Connected to PostgreSQL via DATABASE_URL')
  } else {
    // Local embedded DB for the current API (v1 tables in src/sql)
    driver = await createPgliteDriver(config.db.dataDir)
    mode = 'pglite'
    const schemaPath = path.join(config.sqlDir, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    await driver.exec(schema)
    await seedIfEmpty(driver)
    console.log(`Using embedded PGlite at ${config.db.dataDir}`)
  }

  return { mode }
}

function getDb() {
  if (!driver) throw new Error('Database not initialized. Call connectDb() first.')
  return driver
}

function getDbMode() {
  return mode
}

module.exports = { connectDb, getDb, getDbMode }
