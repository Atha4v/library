import { getDb } from '../db'
import { mapUser } from '../utils/mappers'
import { AppError } from '../utils/errors'
import type { UserRole } from '../types'

const USER_SELECT = `
  SELECT u.id, u.role_id, r.code AS role_code, u.email, u.full_name,
         u.phone, u.is_active, u.email_verified, u.last_login_at,
         u.created_at, u.updated_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
`

export async function listUsers() {
  const db = getDb()
  const result = await db.query(
    `${USER_SELECT}
     WHERE u.deleted_at IS NULL
     ORDER BY u.created_at DESC`,
  )
  return result.rows.map((row) => mapUser(row)!).filter(Boolean)
}

export async function getUserById(id: string) {
  const db = getDb()
  const result = await db.query(
    `${USER_SELECT} WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  )
  const user = mapUser(result.rows[0])
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')
  return user
}

export async function updateUser(
  id: string,
  { fullName, role }: { fullName?: string; role?: UserRole },
) {
  if (!fullName && !role) {
    throw new AppError('Nothing to update', 400, 'VALIDATION')
  }
  if (role && !['admin', 'librarian', 'member'].includes(role)) {
    throw new AppError('Role must be admin, librarian, or member', 400, 'VALIDATION')
  }

  const db = getDb()

  // Resolve new role_id if role is changing
  let roleId: string | null = null
  if (role) {
    const roleResult = await db.query<{ id: string }>(
      `SELECT id FROM roles WHERE code = $1`,
      [role],
    )
    if (!roleResult.rows[0]) throw new AppError(`Role '${role}' not found`, 400, 'VALIDATION')
    roleId = roleResult.rows[0].id
  }

  const result = await db.query(
    `UPDATE users
     SET full_name  = COALESCE($1, full_name),
         role_id    = COALESCE($2, role_id),
         updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id`,
    [fullName?.trim() || null, roleId, id],
  )
  if (!result.rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND')

  return getUserById(id)
}

export async function deleteUser(id: string, currentUserId: string) {
  if (currentUserId === id) {
    throw new AppError('Cannot delete your own account', 400, 'VALIDATION')
  }
  const db = getDb()
  // Soft delete — set deleted_at
  const result = await db.query(
    `UPDATE users SET deleted_at = NOW(), is_active = FALSE
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  )
  if (!result.rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND')
  return { id }
}
