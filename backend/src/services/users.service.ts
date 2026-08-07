import { getDb } from '../db'
import { mapUser } from '../utils/mappers'
import { AppError } from '../utils/errors'
import type { UserRole } from '../types'

export async function listUsers() {
  const db = getDb()
  const result = await db.query(
    `SELECT id, name, email, role, created_at, updated_at
     FROM users ORDER BY created_at DESC`,
  )
  return result.rows.map((row) => mapUser(row)!).filter(Boolean)
}

export async function getUserById(id: string) {
  const db = getDb()
  const result = await db.query(
    `SELECT id, name, email, role, created_at, updated_at
     FROM users WHERE id = $1`,
    [id],
  )
  const user = mapUser(result.rows[0])
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')
  return user
}

export async function updateUser(
  id: string,
  { name, role }: { name?: string; role?: UserRole },
) {
  if (!name && !role) {
    throw new AppError('Nothing to update', 400, 'VALIDATION')
  }
  if (role && !['admin', 'member'].includes(role)) {
    throw new AppError('Role must be admin or member', 400, 'VALIDATION')
  }

  const db = getDb()
  const result = await db.query(
    `UPDATE users
     SET name = COALESCE($1, name),
         role = COALESCE($2, role),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, email, role, created_at, updated_at`,
    [name?.trim() || null, role || null, id],
  )
  const user = mapUser(result.rows[0])
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')
  return user
}

export async function deleteUser(id: string, currentUserId: string) {
  if (currentUserId === id) {
    throw new AppError('Cannot delete your own account', 400, 'VALIDATION')
  }
  const db = getDb()
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id])
  if (!result.rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND')
  return { id }
}
