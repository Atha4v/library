const express = require('express')
const { getDb } = require('../db')
const { ok, fail } = require('../utils/response')
const { mapBorrow } = require('../utils/mappers')
const { authenticate, requireAdmin } = require('../middleware/auth')
const { newId } = require('../utils/id')

const router = express.Router()

const LOAN_SELECT = `
  SELECT bb.*,
         b.title AS book_title,
         b.author AS book_author,
         b.cover_color AS book_cover_color,
         u.name AS user_name,
         u.email AS user_email
  FROM borrowed_books bb
  JOIN books b ON b.id = bb.book_id
  JOIN users u ON u.id = bb.user_id
`

async function markOverdue(db) {
  await db.query(
    `UPDATE borrowed_books
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'borrowed' AND due_date < CURRENT_DATE`,
  )
}

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { bookId } = req.body
    if (!bookId) return fail(res, 400, 'bookId is required', 'VALIDATION')

    const db = getDb()
    const loan = await db.transaction(async (tx) => {
      const bookRes = await tx.query(
        'SELECT * FROM books WHERE id = $1 FOR UPDATE',
        [bookId],
      )
      const book = bookRes.rows[0]
      if (!book) {
        const err = new Error('Book not found')
        err.status = 404
        err.code = 'NOT_FOUND'
        throw err
      }
      if (book.available < 1) {
        const err = new Error('No copies available')
        err.status = 400
        err.code = 'OUT_OF_STOCK'
        throw err
      }

      const existing = await tx.query(
        `SELECT id FROM borrowed_books
         WHERE user_id = $1 AND book_id = $2 AND status IN ('borrowed', 'overdue')
         LIMIT 1`,
        [req.user.id, bookId],
      )
      if (existing.rows[0]) {
        const err = new Error('You already have an active loan for this book')
        err.status = 400
        err.code = 'ALREADY_BORROWED'
        throw err
      }

      await tx.query(
        'UPDATE books SET available = available - 1, updated_at = NOW() WHERE id = $1',
        [bookId],
      )

      const insert = await tx.query(
        `INSERT INTO borrowed_books (id, user_id, book_id, borrow_date, due_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'borrowed')
         RETURNING id`,
        [newId(), req.user.id, bookId],
      )

      const full = await tx.query(`${LOAN_SELECT} WHERE bb.id = $1`, [
        insert.rows[0].id,
      ])
      return full.rows[0]
    })

    return ok(res, mapBorrow(loan), 'Book borrowed successfully', 201)
  } catch (err) {
    next(err)
  }
})

router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const db = getDb()
    await markOverdue(db)

    const params = []
    let where = ''
    if (req.query.status) {
      params.push(req.query.status)
      where = `WHERE bb.status = $1`
    }

    const result = await db.query(
      `${LOAN_SELECT} ${where} ORDER BY bb.borrow_date DESC`,
      params,
    )
    return ok(res, result.rows.map(mapBorrow), 'All loans')
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDb()
    await markOverdue(db)
    const result = await db.query(
      `${LOAN_SELECT} WHERE bb.user_id = $1 ORDER BY bb.borrow_date DESC`,
      [req.user.id],
    )
    return ok(res, result.rows.map(mapBorrow), 'My loans')
  } catch (err) {
    next(err)
  }
})

router.get('/overdue', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const db = getDb()
    await markOverdue(db)
    const result = await db.query(
      `${LOAN_SELECT}
       WHERE bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.due_date < CURRENT_DATE)
       ORDER BY bb.due_date ASC`,
    )
    return ok(res, result.rows.map(mapBorrow), 'Overdue loans')
  } catch (err) {
    next(err)
  }
})

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDb()
    const result = await db.query(`${LOAN_SELECT} WHERE bb.id = $1`, [
      req.params.id,
    ])
    const loan = result.rows[0]
    if (!loan) return fail(res, 404, 'Loan not found', 'NOT_FOUND')

    if (req.user.role !== 'admin' && loan.user_id !== req.user.id) {
      return fail(res, 403, 'Not allowed', 'FORBIDDEN')
    }
    return ok(res, mapBorrow(loan), 'Loan detail')
  } catch (err) {
    next(err)
  }
})

router.post('/:id/return', authenticate, async (req, res, next) => {
  try {
    const db = getDb()
    const loan = await db.transaction(async (tx) => {
      const current = await tx.query(
        'SELECT * FROM borrowed_books WHERE id = $1 FOR UPDATE',
        [req.params.id],
      )
      const row = current.rows[0]
      if (!row) {
        const err = new Error('Loan not found')
        err.status = 404
        err.code = 'NOT_FOUND'
        throw err
      }
      if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
        const err = new Error('Not allowed')
        err.status = 403
        err.code = 'FORBIDDEN'
        throw err
      }
      if (row.status === 'returned') {
        const err = new Error('Loan already returned')
        err.status = 400
        err.code = 'ALREADY_RETURNED'
        throw err
      }

      await tx.query(
        `UPDATE borrowed_books
         SET status = 'returned', return_date = CURRENT_DATE, updated_at = NOW()
         WHERE id = $1`,
        [req.params.id],
      )
      await tx.query(
        `UPDATE books
         SET available = available + 1, updated_at = NOW()
         WHERE id = $1`,
        [row.book_id],
      )

      const full = await tx.query(`${LOAN_SELECT} WHERE bb.id = $1`, [
        req.params.id,
      ])
      return full.rows[0]
    })

    return ok(res, mapBorrow(loan), 'Book returned successfully')
  } catch (err) {
    next(err)
  }
})

router.post('/:id/renew', authenticate, async (req, res, next) => {
  try {
    const db = getDb()
    const current = await db.query(
      'SELECT * FROM borrowed_books WHERE id = $1',
      [req.params.id],
    )
    const row = current.rows[0]
    if (!row) return fail(res, 404, 'Loan not found', 'NOT_FOUND')

    if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
      return fail(res, 403, 'Not allowed', 'FORBIDDEN')
    }
    if (row.status !== 'borrowed' && row.status !== 'overdue') {
      return fail(res, 400, 'Only active loans can be renewed', 'VALIDATION')
    }

    const result = await db.query(
      `UPDATE borrowed_books
       SET due_date = GREATEST(due_date, CURRENT_DATE) + INTERVAL '14 days',
           status = 'borrowed',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [req.params.id],
    )

    const full = await db.query(`${LOAN_SELECT} WHERE bb.id = $1`, [
      result.rows[0].id,
    ])
    return ok(res, mapBorrow(full.rows[0]), 'Loan renewed')
  } catch (err) {
    next(err)
  }
})

module.exports = router
