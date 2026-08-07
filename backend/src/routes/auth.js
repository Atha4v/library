const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getDb } = require('../db')
const { ok, fail } = require('../utils/response')
const { mapUser } = require('../utils/mappers')
const { authenticate } = require('../middleware/auth')
const { newId } = require('../utils/id')

const router = express.Router()

function signToken(user) {
  return jwt.sign(
    { role: user.role, email: user.email },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  )
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name?.trim() || !email?.trim() || !password) {
      return fail(res, 400, 'Name, email, and password are required', 'VALIDATION')
    }
    if (password.length < 6) {
      return fail(res, 400, 'Password must be at least 6 characters', 'VALIDATION')
    }

    const db = getDb()
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ])
    if (existing.rows[0]) {
      return fail(res, 409, 'Email already registered', 'EMAIL_TAKEN')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const id = newId()
    const result = await db.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'member')
       RETURNING id, name, email, role, created_at, updated_at`,
      [id, name.trim(), email.toLowerCase().trim(), passwordHash],
    )

    const user = mapUser(result.rows[0])
    const token = signToken(user)
    return ok(res, { user, token }, 'Registered successfully', 201)
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return fail(res, 400, 'Email and password are required', 'VALIDATION')
    }

    const db = getDb()
    const result = await db.query(
      `SELECT id, name, email, role, password_hash, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()],
    )
    const row = result.rows[0]
    if (!row) {
      return fail(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const match = await bcrypt.compare(password, row.password_hash)
    if (!match) {
      return fail(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const user = mapUser(row)
    const token = signToken(user)
    return ok(res, { user, token }, 'Logged in successfully')
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req, res) => {
  return ok(res, req.user, 'Current user')
})

module.exports = router
