const express = require('express')
const { getDb } = require('../db')
const { ok } = require('../utils/response')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.get('/overview', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const db = getDb()
    await db.query(
      `UPDATE borrowed_books
       SET status = 'overdue', updated_at = NOW()
       WHERE status = 'borrowed' AND due_date < CURRENT_DATE`,
    )

    const [books, members, active, overdue] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM books'),
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'member'`),
      db.query(
        `SELECT COUNT(*)::int AS count FROM borrowed_books WHERE status IN ('borrowed', 'overdue')`,
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM borrowed_books WHERE status = 'overdue'`,
      ),
    ])

    return ok(res, {
      books: books.rows[0].count,
      members: members.rows[0].count,
      activeLoans: active.rows[0].count,
      overdueLoans: overdue.rows[0].count,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDb()
    const [active, returned, overdue] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count FROM borrowed_books
         WHERE user_id = $1 AND status IN ('borrowed', 'overdue')`,
        [req.user.id],
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM borrowed_books
         WHERE user_id = $1 AND status = 'returned'`,
        [req.user.id],
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM borrowed_books
         WHERE user_id = $1 AND status = 'overdue'`,
        [req.user.id],
      ),
    ])

    return ok(res, {
      activeLoans: active.rows[0].count,
      returned: returned.rows[0].count,
      overdue: overdue.rows[0].count,
      role: req.user.role,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
