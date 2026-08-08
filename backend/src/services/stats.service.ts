import { getDb } from '../db'
import type { User } from '../types'

export async function getOverview() {
  const db = getDb()

  // Mark overdue loans first
  await db.query(
    `UPDATE loans
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'active' AND due_at < NOW()`,
  )

  const [books, members, active, overdue] = await Promise.all([
    // Total active books in catalog
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM books WHERE is_active = TRUE`,
    ),
    // Total members (library profiles)
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM members WHERE status = 'active'`,
    ),
    // Active loans (active + overdue)
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM loans WHERE status IN ('active', 'overdue')`,
    ),
    // Overdue loans
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM loans WHERE status = 'overdue'`,
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

  // Resolve member_id from user_id
  const memberResult = await db.query<{ id: string }>(
    `SELECT id FROM members WHERE user_id = $1`,
    [user.id],
  )
  const member = memberResult.rows[0]
  if (!member) {
    return { activeLoans: 0, returned: 0, overdue: 0, role: user.role }
  }

  const [active, returned, overdue] = await Promise.all([
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM loans
       WHERE member_id = $1 AND status IN ('active', 'overdue')`,
      [member.id],
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM loans
       WHERE member_id = $1 AND status = 'returned'`,
      [member.id],
    ),
    db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM loans
       WHERE member_id = $1 AND status = 'overdue'`,
      [member.id],
    ),
  ])

  return {
    activeLoans: active.rows[0].count,
    returned: returned.rows[0].count,
    overdue: overdue.rows[0].count,
    role: user.role,
  }
}
