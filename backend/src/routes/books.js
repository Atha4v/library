const express = require('express')
const { getDb } = require('../db')
const { ok, fail } = require('../utils/response')
const { mapBook } = require('../utils/mappers')
const { authenticate, requireAdmin } = require('../middleware/auth')
const { newId } = require('../utils/id')

const router = express.Router()

const COLORS = ['#1F6F78', '#C46B3A', '#2E4057', '#E09F3E', '#4A6C6F', '#8B3A3A']

router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = '', page = '1', limit = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
    const offset = (pageNum - 1) * limitNum

    const params = []
    const where = []

    if (q.trim()) {
      params.push(`%${q.trim()}%`)
      where.push(
        `(title ILIKE $${params.length} OR author ILIKE $${params.length} OR isbn ILIKE $${params.length})`,
      )
    }
    if (category.trim() && category !== 'all') {
      params.push(category.trim())
      where.push(`category = $${params.length}`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const db = getDb()

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM books ${whereSql}`,
      params,
    )

    params.push(limitNum, offset)
    const result = await db.query(
      `SELECT * FROM books ${whereSql}
       ORDER BY title ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    const categories = await db.query(
      `SELECT DISTINCT category FROM books ORDER BY category ASC`,
    )

    return ok(res, {
      items: result.rows.map(mapBook),
      total: countResult.rows[0].count,
      page: pageNum,
      limit: limitNum,
      categories: categories.rows.map((r) => r.category),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb()
    const result = await db.query('SELECT * FROM books WHERE id = $1', [
      req.params.id,
    ])
    if (!result.rows[0]) return fail(res, 404, 'Book not found', 'NOT_FOUND')
    return ok(res, mapBook(result.rows[0]), 'Book detail')
  } catch (err) {
    next(err)
  }
})

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const {
      title,
      author,
      isbn,
      category = 'General',
      description = '',
      quantity = 1,
      coverColor,
    } = req.body

    if (!title?.trim() || !author?.trim() || !isbn?.trim()) {
      return fail(res, 400, 'Title, author, and ISBN are required', 'VALIDATION')
    }

    const qty = Math.max(0, parseInt(quantity, 10) || 0)
    const color =
      coverColor || COLORS[Math.floor(Math.random() * COLORS.length)]

    const db = getDb()
    const result = await db.query(
      `INSERT INTO books
        (id, title, author, isbn, category, description, quantity, available, cover_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8)
       RETURNING *`,
      [
        newId(),
        title.trim(),
        author.trim(),
        isbn.trim(),
        category.trim() || 'General',
        description.trim(),
        qty,
        color,
      ],
    )
    return ok(res, mapBook(result.rows[0]), 'Book created', 201)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const {
      title,
      author,
      isbn,
      category,
      description,
      quantity,
      available,
      coverColor,
    } = req.body

    const db = getDb()
    const existing = await db.query('SELECT * FROM books WHERE id = $1', [
      req.params.id,
    ])
    if (!existing.rows[0]) return fail(res, 404, 'Book not found', 'NOT_FOUND')

    const current = existing.rows[0]
    const nextQty =
      quantity !== undefined ? Math.max(0, parseInt(quantity, 10) || 0) : current.quantity
    let nextAvailable =
      available !== undefined
        ? Math.max(0, parseInt(available, 10) || 0)
        : current.available

    if (nextAvailable > nextQty) nextAvailable = nextQty

    const result = await db.query(
      `UPDATE books SET
         title = $1,
         author = $2,
         isbn = $3,
         category = $4,
         description = $5,
         quantity = $6,
         available = $7,
         cover_color = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title?.trim() || current.title,
        author?.trim() || current.author,
        isbn?.trim() || current.isbn,
        category?.trim() || current.category,
        description !== undefined ? description : current.description,
        nextQty,
        nextAvailable,
        coverColor || current.cover_color,
        req.params.id,
      ],
    )
    return ok(res, mapBook(result.rows[0]), 'Book updated')
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/quantity', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { quantity, available } = req.body
    if (quantity === undefined && available === undefined) {
      return fail(res, 400, 'Provide quantity and/or available', 'VALIDATION')
    }

    const db = getDb()
    const existing = await db.query('SELECT * FROM books WHERE id = $1', [
      req.params.id,
    ])
    if (!existing.rows[0]) return fail(res, 404, 'Book not found', 'NOT_FOUND')

    const current = existing.rows[0]
    const nextQty =
      quantity !== undefined ? Math.max(0, parseInt(quantity, 10) || 0) : current.quantity
    let nextAvailable =
      available !== undefined
        ? Math.max(0, parseInt(available, 10) || 0)
        : Math.min(current.available, nextQty)

    if (nextAvailable > nextQty) {
      return fail(res, 400, 'Available cannot exceed quantity', 'VALIDATION')
    }

    const result = await db.query(
      `UPDATE books
       SET quantity = $1, available = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [nextQty, nextAvailable, req.params.id],
    )
    return ok(res, mapBook(result.rows[0]), 'Quantity updated')
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const db = getDb()
    const active = await db.query(
      `SELECT id FROM borrowed_books
       WHERE book_id = $1 AND status IN ('borrowed', 'overdue')
       LIMIT 1`,
      [req.params.id],
    )
    if (active.rows[0]) {
      return fail(
        res,
        400,
        'Cannot delete book with active loans',
        'HAS_ACTIVE_LOANS',
      )
    }

    const result = await db.query(
      'DELETE FROM books WHERE id = $1 RETURNING id',
      [req.params.id],
    )
    if (!result.rows[0]) return fail(res, 404, 'Book not found', 'NOT_FOUND')
    return ok(res, { id: req.params.id }, 'Book deleted')
  } catch (err) {
    next(err)
  }
})

module.exports = router
