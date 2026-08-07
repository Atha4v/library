const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')
const { getDb } = require('../db')
const { mapUser } = require('../utils/mappers')
const { newId } = require('../utils/id')
const { AppError } = require('../utils/errors')

function signToken(user) {
  return jwt.sign(
    { role: user.role, email: user.email },
    config.jwt.secret,
    { subject: user.id, expiresIn: config.jwt.expiresIn },
  )
}

async function register({ name, email, password }) {
  if (!name?.trim() || !email?.trim() || !password) {
    throw new AppError('Name, email, and password are required', 400, 'VALIDATION')
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400, 'VALIDATION')
  }

  const db = getDb()
  const normalizedEmail = email.toLowerCase().trim()
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
  if (existing.rows[0]) {
    throw new AppError('Email already registered', 409, 'EMAIL_TAKEN')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const result = await db.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'member')
     RETURNING id, name, email, role, created_at, updated_at`,
    [newId(), name.trim(), normalizedEmail, passwordHash],
  )

  const user = mapUser(result.rows[0])
  return { user, token: signToken(user) }
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION')
  }

  const db = getDb()
  const result = await db.query(
    `SELECT id, name, email, role, password_hash, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  )
  const row = result.rows[0]
  if (!row) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  }

  const match = await bcrypt.compare(password, row.password_hash)
  if (!match) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  }

  const user = mapUser(row)
  return { user, token: signToken(user) }
}

async function findUserById(id) {
  const db = getDb()
  const result = await db.query(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
    [id],
  )
  return mapUser(result.rows[0])
}

module.exports = { register, login, findUserById, signToken }
