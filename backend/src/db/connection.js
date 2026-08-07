const fs = require('fs')
const path = require('path')
const config = require('../config')
const { seedIfEmpty } = require('../sql/seed')

let driver = null
let mode = 'pglite'

async function createPostgresDriver(databaseUrl) {
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: databaseUrl })

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
    driver = await createPostgresDriver(config.db.databaseUrl)
    mode = 'postgres'
  } else {
    driver = await createPgliteDriver(config.db.dataDir)
    mode = 'pglite'
  }

  const schemaPath = path.join(config.sqlDir, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  await driver.exec(schema)
  await seedIfEmpty(driver)

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
