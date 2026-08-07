import { getDb } from '../db'
import type { User } from '../types'

export async function getOverview() {
  const db = getDb()
  await db.query(
    `UPDATE borrowed_books
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'borrowed' AND due_date < CURRENT_DATE`,
  )

  const [books, members, active, overdue] = await Promise.all([
    db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM books'),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = 'member'`,
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM borrowed_books WHERE status IN ('borrowed', 'overdue')`,
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM borrowed_books WHERE status = 'overdue'`,
    ),
  ])

  return {
    books: books.rows[0].count,
    members: members.rows[0].count,
    activeLoans: active.rows[0].count,
    overdueLoans: overdue.rows[0].count,
  }
}

export async function getMyStats(user: User) {
  const db = getDb()
  const [active, returned, overdue] = await Promise.all([
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM borrowed_books
       WHERE user_id = $1 AND status IN ('borrowed', 'overdue')`,
      [user.id],
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM borrowed_books
       WHERE user_id = $1 AND status = 'returned'`,
      [user.id],
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM borrowed_books
       WHERE user_id = $1 AND status = 'overdue'`,
      [user.id],
    ),
  ])

  return {
    activeLoans: active.rows[0].count,
    returned: returned.rows[0].count,
    overdue: overdue.rows[0].count,
    role: user.role,
  }
}
