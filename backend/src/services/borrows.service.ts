import { getDb } from '../db'
import { mapBorrow } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { DbDriver, User } from '../types'

// ---------------------------------------------------------------------------
// Shared JOIN SELECT
// loans → book_copies → books → authors
// loans → members → users
// ---------------------------------------------------------------------------

const LOAN_SELECT = `
  SELECT
    l.*,
    bc.book_id,
    b.title        AS book_title,
    b.cover_color  AS book_cover_color,
    b.isbn_13      AS book_isbn_13,
    b.isbn_10      AS book_isbn_10,
    STRING_AGG(DISTINCT a.full_name, ', ' ORDER BY a.full_name) AS book_authors_text,
    l.member_id,
    m.membership_number,
    u.id           AS member_user_id,
    u.full_name    AS member_full_name,
    u.email        AS member_email
  FROM loans l
  JOIN book_copies bc    ON bc.id    = l.copy_id
  JOIN books b           ON b.id     = bc.book_id
  LEFT JOIN book_authors ba ON ba.book_id = b.id
  LEFT JOIN authors a    ON a.id     = ba.author_id
  JOIN members m         ON m.id     = l.member_id
  JOIN users u           ON u.id     = m.user_id
`
const LOAN_GROUP = `
  GROUP BY l.id, bc.book_id, b.title, b.cover_color, b.isbn_13, b.isbn_10,
           l.member_id, m.membership_number, u.id, u.full_name, u.email
`

// ---------------------------------------------------------------------------
// Mark overdue loans (called before any list query)
// ---------------------------------------------------------------------------

async function markOverdue(db: DbDriver = getDb()) {
  await db.query(
    `UPDATE loans
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'active' AND due_at < NOW()`,
  )
}

// ---------------------------------------------------------------------------
// Resolve user_id → member_id
// ---------------------------------------------------------------------------

async function getMemberId(userId: string): Promise<string> {
  const db = getDb()
  const result = await db.query<{ id: string }>(
    `SELECT id FROM members WHERE user_id = $1`,
    [userId],
  )
  if (!result.rows[0]) {
    throw new AppError('Member profile not found for this user', 404, 'MEMBER_NOT_FOUND')
  }
  return result.rows[0].id
}

// ---------------------------------------------------------------------------
// borrowBook
// ---------------------------------------------------------------------------

export async function borrowBook(userId: string, bookId?: string) {
  if (!bookId) throw new AppError('bookId is required', 400, 'VALIDATION')

  const db = getDb()
  const memberId = await getMemberId(userId)

  const loan = await db.transaction(async (tx) => {
    // Lock an available copy of this book
    const copyRes = await tx.query<{ id: string; branch_id: string }>(
      `SELECT id, branch_id FROM book_copies
       WHERE book_id = $1 AND status = 'available'
       ORDER BY id
       LIMIT 1
       FOR UPDATE`,
      [bookId],
    )
    const copy = copyRes.rows[0]
    if (!copy) throw new AppError('No copies available', 400, 'OUT_OF_STOCK')

    // Check member has no active loan for this book (any copy)
    const existing = await tx.query(
      `SELECT l.id FROM loans l
       JOIN book_copies bc ON bc.id = l.copy_id
       WHERE bc.book_id = $1 AND l.member_id = $2
         AND l.status IN ('active', 'overdue')
       LIMIT 1`,
      [bookId, memberId],
    )
    if (existing.rows[0]) {
      throw new AppError('You already have an active loan for this book', 400, 'ALREADY_BORROWED')
    }

    // Mark copy as on_loan
    await tx.query(
      `UPDATE book_copies SET status = 'on_loan', updated_at = NOW() WHERE id = $1`,
      [copy.id],
    )

    // Create loan (due_at = now + 14 days)
    const loanId = newId()
    await tx.query(
      `INSERT INTO loans (id, copy_id, member_id, branch_id, borrowed_at, due_at, issued_by)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '14 days', $5)`,
      [loanId, copy.id, memberId, copy.branch_id, userId],
    )

    const full = await tx.query(
      `${LOAN_SELECT} WHERE l.id = $1 ${LOAN_GROUP}`,
      [loanId],
    )
    return full.rows[0]
  })

  return mapBorrow(loan)!
}

// ---------------------------------------------------------------------------
// listAllLoans — admin/librarian
// ---------------------------------------------------------------------------

export async function listAllLoans(status?: string) {
  const db = getDb()
  await markOverdue(db)

  const params: unknown[] = []
  let where = ''
  if (status) {
    params.push(status)
    where = `WHERE l.status = $1`
  }

  const result = await db.query(
    `${LOAN_SELECT} ${where} ${LOAN_GROUP} ORDER BY l.borrowed_at DESC`,
    params,
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

// ---------------------------------------------------------------------------
// listMyLoans — current member
// ---------------------------------------------------------------------------

export async function listMyLoans(userId: string) {
  const db = getDb()
  await markOverdue(db)
  const memberId = await getMemberId(userId)

  const result = await db.query(
    `${LOAN_SELECT} WHERE l.member_id = $1 ${LOAN_GROUP} ORDER BY l.borrowed_at DESC`,
    [memberId],
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

// ---------------------------------------------------------------------------
// listOverdue
// ---------------------------------------------------------------------------

export async function listOverdue() {
  const db = getDb()
  await markOverdue(db)
  const result = await db.query(
    `${LOAN_SELECT}
     WHERE l.status = 'overdue'
     ${LOAN_GROUP}
     ORDER BY l.due_at ASC`,
  )
  return result.rows.map((row) => mapBorrow(row)!)
}

// ---------------------------------------------------------------------------
// getLoanById
// ---------------------------------------------------------------------------

export async function getLoanById(id: string, user: User) {
  const db = getDb()
  const result = await db.query(
    `${LOAN_SELECT} WHERE l.id = $1 ${LOAN_GROUP}`,
    [id],
  )
  const row = result.rows[0] as Record<string, unknown> | undefined
  if (!row) throw new AppError('Loan not found', 404, 'NOT_FOUND')

  // Member can only see their own loan
  if (user.role === 'member') {
    const memberId = await getMemberId(user.id)
    if (row.member_id !== memberId) {
      throw new AppError('Not allowed', 403, 'FORBIDDEN')
    }
  }

  return mapBorrow(row)!
}

// ---------------------------------------------------------------------------
// returnLoan
// ---------------------------------------------------------------------------

export async function returnLoan(id: string, user: User) {
  const db = getDb()

  const loan = await db.transaction(async (tx) => {
    const current = await tx.query<{
      member_id: string
      status: string
      copy_id: string
    }>('SELECT member_id, status, copy_id FROM loans WHERE id = $1 FOR UPDATE', [id])
    const row = current.rows[0]
    if (!row) throw new AppError('Loan not found', 404, 'NOT_FOUND')

    if (user.role === 'member') {
      const memberId = await getMemberId(user.id)
      if (row.member_id !== memberId) throw new AppError('Not allowed', 403, 'FORBIDDEN')
    }
    if (row.status === 'returned') {
      throw new AppError('Loan already returned', 400, 'ALREADY_RETURNED')
    }

    await tx.query(
      `UPDATE loans
       SET status = 'returned', returned_at = NOW(), returned_to = $1, updated_at = NOW()
       WHERE id = $2`,
      [user.id, id],
    )

    // Free the physical copy
    await tx.query(
      `UPDATE book_copies SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [row.copy_id],
    )

    const full = await tx.query(`${LOAN_SELECT} WHERE l.id = $1 ${LOAN_GROUP}`, [id])
    return full.rows[0]
  })

  return mapBorrow(loan)!
}

// ---------------------------------------------------------------------------
// renewLoan
// ---------------------------------------------------------------------------

export async function renewLoan(id: string, user: User) {
  const db = getDb()

  const current = await db.query<{ member_id: string; status: string }>(
    'SELECT member_id, status FROM loans WHERE id = $1',
    [id],
  )
  const row = current.rows[0]
  if (!row) throw new AppError('Loan not found', 404, 'NOT_FOUND')

  if (user.role === 'member') {
    const memberId = await getMemberId(user.id)
    if (row.member_id !== memberId) throw new AppError('Not allowed', 403, 'FORBIDDEN')
  }
  if (row.status !== 'active' && row.status !== 'overdue') {
    throw new AppError('Only active loans can be renewed', 400, 'VALIDATION')
  }

  const result = await db.query<{ id: string }>(
    `UPDATE loans
     SET due_at = GREATEST(due_at, NOW()) + INTERVAL '14 days',
         status = 'active',
         renewal_count = renewal_count + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id],
  )

  // Record in loan_renewals
  await db.query(
    `INSERT INTO loan_renewals (id, loan_id, renewed_by, previous_due_at, new_due_at)
     SELECT $1, $2, $3, due_at - INTERVAL '14 days', due_at
     FROM loans WHERE id = $2`,
    [newId(), result.rows[0].id, user.id],
  )

  const full = await db.query(`${LOAN_SELECT} WHERE l.id = $1 ${LOAN_GROUP}`, [result.rows[0].id])
  return mapBorrow(full.rows[0])!
}
