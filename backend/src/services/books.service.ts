import { getDb } from '../db'
import { mapBook } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { BookListQuery, BookPayload } from '../types'

const COLORS = ['#1F6F78', '#C46B3A', '#2E4057', '#E09F3E', '#4A6C6F', '#8B3A3A']

// =============================================================================
// LIST BOOKS — with proper joins for categories, authors, availability
// =============================================================================
export async function listBooks({
  q = '',
  category = '',
  page = '1',
  limit = '50',
}: BookListQuery = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  const offset = (pageNum - 1) * limitNum

  const params: unknown[] = []
  const where: string[] = ['b.is_active = TRUE']

  // Text search across title, author name, or ISBN
  if (q.trim()) {
    params.push(`%${q.trim()}%`)
    where.push(
      `(b.title ILIKE $${params.length} OR a.full_name ILIKE $${params.length} OR b.isbn_13 ILIKE $${params.length} OR b.isbn_10 ILIKE $${params.length})`,
    )
  }

  // Filter by category slug (via book_categories junction)
  if (category.trim() && category !== 'all') {
    params.push(category.trim())
    where.push(`c.slug = $${params.length}`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const db = getDb()

  // Count distinct books matching filters
  const countResult = await db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT b.id)::int AS count
     FROM books b
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     LEFT JOIN book_categories bc ON bc.book_id = b.id
     LEFT JOIN categories c ON c.id = bc.category_id
     ${whereSql}`,
    params,
  )

  // Fetch paginated books with aggregated authors, categories, and availability
  params.push(limitNum, offset)
  const result = await db.query(
    `SELECT
       b.*,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', a.id,
           'fullName', a.full_name,
           'sortName', a.sort_name,
           'order', ba.author_order,
           'contribution', ba.contribution
         )) FILTER (WHERE a.id IS NOT NULL),
         '[]'::jsonb
       ) AS authors,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.id,
           'name', c.name,
           'slug', c.slug
         )) FILTER (WHERE c.id IS NOT NULL),
         '[]'::jsonb
       ) AS categories,
       COALESCE(av.total_copies, 0) AS total_copies,
       COALESCE(av.available_copies, 0) AS available_copies
     FROM books b
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     LEFT JOIN book_categories bc ON bc.book_id = b.id
     LEFT JOIN categories c ON c.id = bc.category_id
     LEFT JOIN book_availability av ON av.book_id = b.id
     ${whereSql}
     GROUP BY b.id, av.total_copies, av.available_copies
     ORDER BY b.title ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  // Fetch all category slugs for the filter dropdown
  const categories = await db.query<{ slug: string; name: string }>(
    `SELECT slug, name FROM categories ORDER BY name ASC`,
  )

  return {
    items: result.rows.map((row) => mapBook(row)!),
    total: countResult.rows[0].count,
    page: pageNum,
    limit: limitNum,
    categories: categories.rows,
  }
}

// =============================================================================
// GET SINGLE BOOK — with full relations
// =============================================================================
export async function getBookById(id: string) {
  const db = getDb()
  const result = await db.query(
    `SELECT
       b.*,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', a.id,
           'fullName', a.full_name,
           'sortName', a.sort_name,
           'order', ba.author_order,
           'contribution', ba.contribution
         )) FILTER (WHERE a.id IS NOT NULL),
         '[]'::jsonb
       ) AS authors,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.id,
           'name', c.name,
           'slug', c.slug
         )) FILTER (WHERE c.id IS NOT NULL),
         '[]'::jsonb
       ) AS categories,
       COALESCE(av.total_copies, 0) AS total_copies,
       COALESCE(av.available_copies, 0) AS available_copies,
       jsonb_build_object(
         'id', p.id,
         'name', p.name,
         'website', p.website,
         'country', p.country
       ) AS publisher
     FROM books b
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     LEFT JOIN book_categories bc ON bc.book_id = b.id
     LEFT JOIN categories c ON c.id = bc.category_id
     LEFT JOIN publishers p ON p.id = b.publisher_id
     LEFT JOIN book_availability av ON av.book_id = b.id
     WHERE b.id = $1
     GROUP BY b.id, p.id, av.total_copies, av.available_copies`,
    [id],
  )

  const book = mapBook(result.rows[0])
  if (!book) throw new AppError('Book not found', 404, 'NOT_FOUND')
  return book
}

// =============================================================================
// CREATE BOOK — insert into books, then link authors & categories
// =============================================================================
export async function createBook(payload: BookPayload) {
  const {
    title,
    subtitle,
    isbn13,
    isbn10,
    publisherId,
    publishedYear,
    edition,
    languageCode = 'en',
    pageCount,
    description,
    coverUrl,
    coverColor,
    deweyCode,
    authorIds = [],
    categoryIds = [],
  } = payload

  if (!title?.trim()) {
    throw new AppError('Title is required', 400, 'VALIDATION')
  }
  if (!isbn13?.trim() && !isbn10?.trim()) {
    throw new AppError('ISBN-13 or ISBN-10 is required', 400, 'VALIDATION')
  }
  if (authorIds.length === 0) {
    throw new AppError('At least one author is required', 400, 'VALIDATION')
  }

  const color = coverColor || COLORS[Math.floor(Math.random() * COLORS.length)]
  const db = getDb()

  // Insert book
  const bookResult = await db.query<{ id: string }>(
    `INSERT INTO books
      (id, title, subtitle, isbn_13, isbn_10, publisher_id, published_year,
       edition, language_code, page_count, description, cover_url,
       cover_color, dewey_code, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
     RETURNING id`,
    [
      newId(),
      title.trim(),
      subtitle?.trim() || null,
      isbn13?.trim() || null,
      isbn10?.trim() || null,
      publisherId || null,
      publishedYear || null,
      edition?.trim() || null,
      languageCode,
      pageCount || null,
      description?.trim() || null,
      coverUrl?.trim() || null,
      color,
      deweyCode?.trim() || null,
    ],
  )

  const bookId = bookResult.rows[0].id

  // Link authors (with default order)
  for (let i = 0; i < authorIds.length; i++) {
    await db.query(
      `INSERT INTO book_authors (book_id, author_id, author_order, contribution)
       VALUES ($1, $2, $3, 'author')`,
      [bookId, authorIds[i], i + 1],
    )
  }

  // Link categories
  for (const catId of categoryIds) {
    await db.query(
      `INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)`,
      [bookId, catId],
    )
  }

  return getBookById(bookId);
}

// =============================================================================
// UPDATE BOOK — update book, then sync authors & categories
// =============================================================================
export async function updateBook(id: string, payload: BookPayload) {
  const db = getDb()

  const existing = await db.query('SELECT id FROM books WHERE id = $1', [id])
  if (!existing.rows[0]) {
    throw new AppError('Book not found', 404, 'NOT_FOUND')
  }

  const {
    title,
    subtitle,
    isbn13,
    isbn10,
    publisherId,
    publishedYear,
    edition,
    languageCode,
    pageCount,
    description,
    coverUrl,
    coverColor,
    deweyCode,
    isActive,
    authorIds,
    categoryIds,
  } = payload

  // Update book fields
  const result = await db.query(
    `UPDATE books SET
       title = COALESCE($1, title),
       subtitle = COALESCE($2, subtitle),
       isbn_13 = COALESCE($3, isbn_13),
       isbn_10 = COALESCE($4, isbn_10),
       publisher_id = COALESCE($5, publisher_id),
       published_year = COALESCE($6, published_year),
       edition = COALESCE($7, edition),
       language_code = COALESCE($8, language_code),
       page_count = COALESCE($9, page_count),
       description = COALESCE($10, description),
       cover_url = COALESCE($11, cover_url),
       cover_color = COALESCE($12, cover_color),
       dewey_code = COALESCE($13, dewey_code),
       is_active = COALESCE($14, is_active),
       updated_at = NOW()
     WHERE id = $15
     RETURNING *`,
    [
      title?.trim(),
      subtitle?.trim(),
      isbn13?.trim(),
      isbn10?.trim(),
      publisherId,
      publishedYear,
      edition?.trim(),
      languageCode,
      pageCount,
      description !== undefined ? description : null,
      coverUrl?.trim(),
      coverColor,
      deweyCode?.trim(),
      isActive,
      id,
    ],
  )

  // Sync authors if provided
  if (authorIds !== undefined) {
    await db.query('DELETE FROM book_authors WHERE book_id = $1', [id])
    for (let i = 0; i < authorIds.length; i++) {
      await db.query(
        `INSERT INTO book_authors (book_id, author_id, author_order, contribution)
         VALUES ($1, $2, $3, 'author')`,
        [id, authorIds[i], i + 1],
      )
    }
  }

  // Sync categories if provided
  if (categoryIds !== undefined) {
    await db.query('DELETE FROM book_categories WHERE book_id = $1', [id])
    for (const catId of categoryIds) {
      await db.query(
        `INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)`,
        [id, catId],
      )
    }
  }

  return getBookById(id)
}

// =============================================================================
// DELETE BOOK — check for active loans on copies, not old borrowed_books table
// =============================================================================
export async function deleteBook(id: string) {
  const db = getDb()

  // Check for active loans on any copy of this book
  const active = await db.query(
    `SELECT l.id
     FROM loans l
     JOIN book_copies bc ON bc.id = l.copy_id
     WHERE bc.book_id = $1 AND l.status IN ('active', 'overdue')
     LIMIT 1`,
    [id],
  )

  if (active.rows[0]) {
    throw new AppError('Cannot delete book with active loans', 400, 'HAS_ACTIVE_LOANS')
  }

  // Cascades will handle book_authors, book_categories via ON DELETE CASCADE
  const result = await db.query('DELETE FROM books WHERE id = $1 RETURNING id', [id])
  if (!result.rows[0]) throw new AppError('Book not found', 404, 'NOT_FOUND')
  return { id }
}

// =============================================================================
// DEPRECATED: updateQuantity — now handled via book_copies table
// Use inventory/copies service instead for physical copy management
// =============================================================================
export async function updateQuantity(
  id: string,
  { quantity, available }: { quantity?: number | string; available?: number | string },
) {
  throw new AppError(
    'Use the copies/inventory service to manage physical copies. ' +
    'Books no longer have quantity/available columns in schema v2.',
    400,
    'DEPRECATED_OPERATION',
  )
}