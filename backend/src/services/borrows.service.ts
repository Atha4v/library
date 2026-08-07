import { getDb } from '../db'
import { mapBorrow } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { DbDriver, User } from '../types'

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

async function markOverdue(db: DbDriver = getDb()) {
  await db.query(
    `UPDATE borrowed_books
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'borrowed' AND due_date < CURRENT_DATE`,
  )
}

export async function borrowBook(userId: string, bookId?: string) {
  if (!bookId) throw new AppError('bookId is required', 400, 'VALIDATION')

  const db = getDb()
  const loan = await db.transaction(async (tx) => {
    const bookRes = await tx.query<{ available: number }>(
      'SELECT * FROM books WHERE id = $1 FOR UPDATE',
      [bookId],
    )
    const book = bookRes.rows[0]
    if (!book) throw new AppError('Book not found', 404, 'NOT_FOUND')
    if (book.available < 1) throw new AppError('No copies available', 400, 'OUT_OF_STOCK')

    const existing = await tx.query(
      `SELECT id FROM borrowed_books
       WHERE user_id = $1 AND book_id = $2 AND status IN ('borrowed', 'overdue')
       LIMIT 1`,
      [userId, bookId],
    )
    if (existing.rows[0]) {
      throw new AppError('You already have an active loan for this book', 400, 'ALREADY_BORROWED')
    }

    await tx.query(
      'UPDATE books SET available = available - 1, updated_at = NOW() WHERE id = $1',
      [bookId],
    )

    const insert = await tx.query<{ id: string }>(
      `INSERT INTO borrowed_books (id, user_id, book_id, borrow_date, due_date, status)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'borrowed')
       RETURNING id`,
      [newId(), userId, bookId],
    )

    const full = await tx.query(`${LOAN_SELECT} WHERE bb.id = $1`, [insert.rows[0].id])
    return full.rows[0]
  })

  return mapBorrow(loan)!
}

export async function listAllLoans(status?: string) {
  const db = getDb()
  await markOverdue(db)

  const params: unknown[] = []
  let where = ''
  if (status) {
    params.push(status)
    where = 'WHERE bb.status = $1'
  }

  const result = await db.query(
    `${LOAN_SELECT} ${where} ORDER BY bb.borrow_date DESC`,
    params,
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

export async function listMyLoans(userId: string) {
  const db = getDb()
  await markOverdue(db)
  const result = await db.query(
    `${LOAN_SELECT} WHERE bb.user_id = $1 ORDER BY bb.borrow_date DESC`,
    [userId],
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

export async function listOverdue() {
  const db = getDb()
  await markOverdue(db)
  const result = await db.query(
    `${LOAN_SELECT}
     WHERE bb.status = 'overdue' OR (bb.status = 'borrowed' AND bb.due_date < CURRENT_DATE)
     ORDER BY bb.due_date ASC`,
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

export async function getLoanById(id: string, user: User) {
  const db = getDb()
  const result = await db.query(`${LOAN_SELECT} WHERE bb.id = $1`, [id])
  const loan = result.rows[0] as Record<string, unknown> | undefined
  if (!loan) throw new AppError('Loan not found', 404, 'NOT_FOUND')
  if (user.role !== 'admin' && loan.user_id !== user.id) {
    throw new AppError('Not allowed', 403, 'FORBIDDEN')
  }
  return mapBorrow(loan)!
}

export async function returnLoan(id: string, user: User) {
  const db = getDb()
  const loan = await db.transaction(async (tx) => {
    const current = await tx.query<{
      user_id: string
      status: string
      book_id: string
    }>('SELECT * FROM borrowed_books WHERE id = $1 FOR UPDATE', [id])
    const row = current.rows[0]
    if (!row) throw new AppError('Loan not found', 404, 'NOT_FOUND')
    if (user.role !== 'admin' && row.user_id !== user.id) {
      throw new AppError('Not allowed', 403, 'FORBIDDEN')
    }
    if (row.status === 'returned') {
      throw new AppError('Loan already returned', 400, 'ALREADY_RETURNED')
    }

    await tx.query(
      `UPDATE borrowed_books
       SET status = 'returned', return_date = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1`,
      [id],
    )
    await tx.query(
      `UPDATE books SET available = available + 1, updated_at = NOW() WHERE id = $1`,
      [row.book_id],
    )

    const full = await tx.query(`${LOAN_SELECT} WHERE bb.id = $1`, [id])
    return full.rows[0]
  })

  return mapBorrow(loan)!
}

export async function renewLoan(id: string, user: User) {
  const db = getDb()
  const current = await db.query<{ user_id: string; status: string }>(
    'SELECT * FROM borrowed_books WHERE id = $1',
    [id],
  )
  const row = current.rows[0]
  if (!row) throw new AppError('Loan not found', 404, 'NOT_FOUND')
  if (user.role !== 'admin' && row.user_id !== user.id) {
    throw new AppError('Not allowed', 403, 'FORBIDDEN')
  }
  if (row.status !== 'borrowed' && row.status !== 'overdue') {
    throw new AppError('Only active loans can be renewed', 400, 'VALIDATION')
  }

  const result = await db.query<{ id: string }>(
    `UPDATE borrowed_books
     SET due_date = GREATEST(due_date, CURRENT_DATE) + INTERVAL '14 days',
         status = 'borrowed',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id],
  )

  const full = await db.query(`${LOAN_SELECT} WHERE bb.id = $1`, [result.rows[0].id])
  return mapBorrow(full.rows[0])!
}
