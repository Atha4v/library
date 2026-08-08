import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../config'
import { getDb } from '../db'
import { mapUser } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { AuthPayload, User } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SELECT with roles join — returns a fully-populated User */
const USER_SELECT = `
  SELECT u.id, u.role_id, r.code AS role_code, u.email, u.full_name,
         u.phone, u.is_active, u.email_verified, u.last_login_at,
         u.created_at, u.updated_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
`

function signToken(user: User): string {
  return jwt.sign(
    { role: user.role, email: user.email },
    config.jwt.secret,
    { subject: user.id, expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] },
  )
}

/** Look up role_id by code (admin | librarian | member) */
async function getRoleId(code: string): Promise<string> {
  const db = getDb()
  const result = await db.query<{ id: string }>(
    `SELECT id FROM roles WHERE code = $1`,
    [code],
  )
  if (!result.rows[0]) {
    throw new AppError(`Role '${code}' not found — run schema seed first`, 500, 'CONFIG_ERROR')
  }
  return result.rows[0].id
}

/** Generate a unique membership number like LIB-00001 */
async function nextMembershipNumber(): Promise<string> {
  const db = getDb()
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM members`,
  )
  const seq = (result.rows[0].count ?? 0) + 1
  return `LIB-${String(seq).padStart(5, '0')}`
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

export async function register({ fullName, email, password }: AuthPayload) {
  if (!fullName?.trim() || !email?.trim() || !password) {
    throw new AppError('Full name, email, and password are required', 400, 'VALIDATION')
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
  const memberRoleId = await getRoleId('member')
  const membershipNumber = await nextMembershipNumber()
  const userId = newId()
  const memberId = newId()

  // Create user + member profile in a transaction
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO users (id, role_id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, memberRoleId, normalizedEmail, passwordHash, fullName.trim()],
    )
    await tx.query(
      `INSERT INTO members (id, user_id, membership_number)
       VALUES ($1, $2, $3)`,
      [memberId, userId, membershipNumber],
    )
  })

  const result = await db.query(`${USER_SELECT} WHERE u.id = $1`, [userId])
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
    role_id: string
    role_code: string
    email: string
    full_name: string
    phone: string | null
    is_active: boolean
    email_verified: boolean
    last_login_at: Date | null
    created_at: Date
    updated_at: Date
    password_hash: string
  }>(
    `SELECT u.id, u.role_id, r.code AS role_code, u.email, u.full_name,
            u.phone, u.is_active, u.email_verified, u.last_login_at,
            u.created_at, u.updated_at, u.password_hash
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [email.toLowerCase().trim()],
  )
  const row = result.rows[0]
  if (!row) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  }
  if (!row.is_active) {
    throw new AppError('Account is inactive', 403, 'INACTIVE')
  }

  const match = await bcrypt.compare(password, row.password_hash)
  if (!match) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  }

  // Update last_login_at
  await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [row.id])

  const user = mapUser(row)
  if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
  return { user, token: signToken(user) }
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDb()
  const result = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id])
  return mapUser(result.rows[0])
}

export { signToken }
