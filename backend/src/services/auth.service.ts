import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../config'
import { getDb } from '../db'
import { mapUser } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { AuthPayload, User } from '../types'

function signToken(user: User): string {
  return jwt.sign(
    { role: user.role, email: user.email },
    config.jwt.secret,
    { subject: user.id, expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] },
  )
}

export async function register({ name, email, password }: AuthPayload) {
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
  if (!user) throw new AppError('Failed to create user', 500)
  return { user, token: signToken(user) }
}

export async function login({ email, password }: AuthPayload) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION')
  }

  const db = getDb()
  const result = await db.query<{
    id: string
    name: string
    email: string
    role: string
    password_hash: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, full_name, email, role_id, password_hash, created_at, updated_at
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
  if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  return { user, token: signToken(user) }
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDb()
  const result = await db.query(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
    [id],
  )
  return mapUser(result.rows[0])
}

export { signToken }
