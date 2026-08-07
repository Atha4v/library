const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const { newId } = require('../utils/id')

let driver = null
let mode = 'pglite'

async function initDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (databaseUrl) {
    const { Pool } = require('pg')
    const pool = new Pool({ connectionString: databaseUrl })
    driver = {
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
    mode = 'postgres'
  } else {
    const { PGlite } = require('@electric-sql/pglite')
    const dataDir = path.join(__dirname, '..', '..', 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    const db = new PGlite(dataDir)
    await db.waitReady

    driver = {
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
    mode = 'pglite'
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await driver.exec(schema)
  await seedIfEmpty()

  return { mode }
}

async function seedIfEmpty() {
  const count = await driver.query('SELECT COUNT(*)::int AS count FROM users')
  if ((count.rows[0]?.count ?? 0) > 0) return

  const adminHash = await bcrypt.hash('admin123', 10)
  const memberHash = await bcrypt.hash('member123', 10)

  await driver.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES
      ($1, $2, $3, $4, 'admin'),
      ($5, $6, $7, $8, 'member')`,
    [
      newId(),
      'Admin User',
      'admin@shelfmark.local',
      adminHash,
      newId(),
      'Priya Sharma',
      'priya@shelfmark.local',
      memberHash,
    ],
  )

  const books = [
    [
      'The Silent Patient',
      'Alex Michaelides',
      '9781250301697',
      'Thriller',
      'A psychotherapist becomes obsessed with a famous painter who refuses to speak.',
      4,
      2,
      '#1F6F78',
    ],
    [
      'Project Hail Mary',
      'Andy Weir',
      '9780593135204',
      'Sci-Fi',
      'A lone astronaut must save Earth from extinction.',
      6,
      5,
      '#C46B3A',
    ],
    [
      'Klara and the Sun',
      'Kazuo Ishiguro',
      '9780593318171',
      'Literary',
      'An artificial friend observes love and loyalty.',
      3,
      1,
      '#2E4057',
    ],
    [
      'Atomic Habits',
      'James Clear',
      '9780735211292',
      'Nonfiction',
      'Tiny changes that compound into remarkable results.',
      8,
      6,
      '#E09F3E',
    ],
    [
      'Piranesi',
      'Susanna Clarke',
      '9781635577808',
      'Fantasy',
      'A man maps a house of endless halls and tides.',
      2,
      0,
      '#4A6C6F',
    ],
    [
      'Educated',
      'Tara Westover',
      '9780399590504',
      'Memoir',
      'A memoir of education as a path to a new self.',
      5,
      3,
      '#8B3A3A',
    ],
  ]

  for (const book of books) {
    await driver.query(
      `INSERT INTO books
        (id, title, author, isbn, category, description, quantity, available, cover_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), ...book],
    )
  }
}

function getDb() {
  if (!driver) throw new Error('Database not initialized')
  return driver
}

module.exports = { initDb, getDb }
