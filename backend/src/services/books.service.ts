import { getDb } from '../db'
import { mapBook } from '../utils/mappers'
import { newId } from '../utils/id'
import { AppError } from '../utils/errors'
import type { Book, BookListQuery, BookPayload } from '../types'

const COLORS = ['#1F6F78', '#C46B3A', '#2E4057', '#E09F3E', '#4A6C6F', '#8B3A3A']

// ---------------------------------------------------------------------------
// Shared SELECT that aggregates authors, categories, and copy counts
// ---------------------------------------------------------------------------

const BOOK_SELECT = `
  SELECT
    b.*,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id', a.id,
        'full_name', a.full_name,
        'author_order', ba.author_order,
        'contribution', ba.contribution
      )) FILTER (WHERE a.id IS NOT NULL),
      '[]'::json
    ) AS authors_json,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id', cat.id,
        'name', cat.name,
        'slug', cat.slug
      )) FILTER (WHERE cat.id IS NOT NULL),
      '[]'::json
    ) AS categories_json,
    COUNT(bc.id) FILTER (WHERE bc.status <> 'retired') AS total_copies,
    COUNT(bc.id) FILTER (WHERE bc.status = 'available')  AS available_copies,
    COUNT(bc.id) FILTER (WHERE bc.status = 'on_loan')    AS on_loan_copies,
    COUNT(bc.id) FILTER (WHERE bc.status = 'reserved')   AS reserved_copies
  FROM books b
  LEFT JOIN book_authors ba   ON ba.book_id = b.id
  LEFT JOIN authors a         ON a.id = ba.author_id
  LEFT JOIN book_categories bc_cat ON bc_cat.book_id = b.id
  LEFT JOIN categories cat    ON cat.id = bc_cat.category_id
  LEFT JOIN book_copies bc    ON bc.book_id = b.id
`
const BOOK_GROUP = `GROUP BY b.id`

// ---------------------------------------------------------------------------
// Helper: parse author names from payload (string or array)
// ---------------------------------------------------------------------------

function parseList(input: string | string[] | undefined): string[] {
  if (!input) return []
  if (Array.isArray(input)) return input.map((s) => s.trim()).filter(Boolean)
  return input.split(',').map((s) => s.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Helper: upsert author by full_name → return id
// ---------------------------------------------------------------------------

async function upsertAuthor(db: Awaited<ReturnType<typeof getDb>>, fullName: string): Promise<string> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM authors WHERE LOWER(full_name) = LOWER($1)`,
    [fullName],
  )
  if (existing.rows[0]) return existing.rows[0].id
  const result = await db.query<{ id: string }>(
    `INSERT INTO authors (id, full_name) VALUES ($1, $2) RETURNING id`,
    [newId(), fullName],
  )
  return result.rows[0].id
}

// ---------------------------------------------------------------------------
// Helper: upsert category by name → return id (slug = lower-kebab)
// ---------------------------------------------------------------------------

async function upsertCategory(db: Awaited<ReturnType<typeof getDb>>, name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1`,
    [slug],
  )
  if (existing.rows[0]) return existing.rows[0].id
  const result = await db.query<{ id: string }>(
    `INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
    [newId(), name, slug],
  )
  return result.rows[0].id
}

// ---------------------------------------------------------------------------
// Helper: get the default branch_id (MAIN branch or first branch)
// ---------------------------------------------------------------------------

async function getDefaultBranchId(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM branches WHERE is_active = TRUE ORDER BY code ASC LIMIT 1`,
  )
  if (!result.rows[0]) {
    // Create a default MAIN branch if none exist
    const branchId = newId()
    await db.query(
      `INSERT INTO branches (id, code, name) VALUES ($1, 'MAIN', 'Main Branch')
       ON CONFLICT (code) DO NOTHING`,
      [branchId],
    )
    const b = await db.query<{ id: string }>(`SELECT id FROM branches WHERE code = 'MAIN'`)
    return b.rows[0].id
  }
  return result.rows[0].id
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

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
  const having: string[] = []

  // Full-text / ILIKE on title, isbn, or author name
  if (q.trim()) {
    params.push(`%${q.trim()}%`)
    having.push(
      `(b.title ILIKE $${params.length}
        OR b.isbn_13 ILIKE $${params.length}
        OR b.isbn_10 ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM book_authors ba2
          JOIN authors a2 ON a2.id = ba2.author_id
          WHERE ba2.book_id = b.id AND a2.full_name ILIKE $${params.length}
        ))`,
    )
  }

  // Category slug filter
  if (category.trim() && category !== 'all') {
    params.push(category.trim())
    having.push(
      `EXISTS (
         SELECT 1 FROM book_categories bc2
         JOIN categories cat2 ON cat2.id = bc2.category_id
         WHERE bc2.book_id = b.id AND (cat2.slug = $${params.length} OR cat2.name ILIKE $${params.length})
       )`,
    )
  }

  const havingSql = having.length ? `HAVING ${having.join(' AND ')}` : ''
  const db = getDb()

  // Count (wrap in subquery to apply HAVING correctly)
  const countSql = `
    SELECT COUNT(*)::int AS count FROM (
      ${BOOK_SELECT}
      WHERE b.is_active = TRUE
      ${BOOK_GROUP}
      ${havingSql}
    ) sub
  `
  const countResult = await db.query<{ count: number }>(countSql, params)

  params.push(limitNum, offset)
  const dataSql = `
    ${BOOK_SELECT}
    WHERE b.is_active = TRUE
    ${BOOK_GROUP}
    ${havingSql}
    ORDER BY b.title ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `
  const result = await db.query(dataSql, params)

  // All active category names for filter UI
  const categoriesResult = await db.query<{ name: string; slug: string }>(
    `SELECT name, slug FROM categories ORDER BY name ASC`,
  )

  return {
    items: result.rows.map((row) => mapBook(row)!),
    total: countResult.rows[0].count,
    page: pageNum,
    limit: limitNum,
    categories: categoriesResult.rows,
  }
}

export async function getBookById(id: string): Promise<Book> {
  const db = getDb()
  const result = await db.query(
    `${BOOK_SELECT} WHERE b.id = $1 ${BOOK_GROUP}`,
    [id],
  )
  const book = mapBook(result.rows[0])
  if (!book) throw new AppError('Book not found', 404, 'NOT_FOUND')
  return book
}

export async function createBook(payload: BookPayload): Promise<Book> {
  const {
    title,
    authors: authorsRaw,
    isbn13,
    isbn10,
    categories: categoriesRaw,
    description = '',
    publishedYear,
    edition,
    languageCode = 'en',
    coverColor,
    coverUrl,
    quantity = 1,
  } = payload

  if (!title?.trim()) {
    throw new AppError('Title is required', 400, 'VALIDATION')
  }
  if (!isbn13?.trim() && !isbn10?.trim()) {
    throw new AppError('At least one ISBN (isbn13 or isbn10) is required', 400, 'VALIDATION')
  }

  const authorNames = parseList(authorsRaw)
  if (authorNames.length === 0) {
    throw new AppError('At least one author is required', 400, 'VALIDATION')
  }

  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)
  const color = coverColor || COLORS[Math.floor(Math.random() * COLORS.length)]
  const db = getDb()

  const bookId = newId()

  await db.transaction(async (tx) => {
    // 1. Insert book
    await tx.query(
      `INSERT INTO books
         (id, title, isbn_13, isbn_10, description, published_year, edition,
          language_code, cover_color, cover_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        bookId,
        title.trim(),
        isbn13?.trim() || null,
        isbn10?.trim() || null,
        description.trim() || null,
        publishedYear ? parseInt(String(publishedYear), 10) : null,
        edition?.trim() || null,
        languageCode,
        color,
        coverUrl?.trim() || null,
      ],
    )

    // 2. Upsert authors + link
    for (let i = 0; i < authorNames.length; i++) {
      const authorId = await upsertAuthorTx(tx, authorNames[i])
      await tx.query(
        `INSERT INTO book_authors (book_id, author_id, author_order)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [bookId, authorId, i + 1],
      )
    }

    // 3. Upsert categories + link
    const categoryNames = parseList(categoriesRaw)
    for (const catName of categoryNames) {
      const categoryId = await upsertCategoryTx(tx, catName)
      await tx.query(
        `INSERT INTO book_categories (book_id, category_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [bookId, categoryId],
      )
    }

    // 4. Get default branch
    const branchResult = await tx.query<{ id: string }>(
      `SELECT id FROM branches WHERE is_active = TRUE ORDER BY code ASC LIMIT 1`,
    )
    let branchId: string
    if (branchResult.rows[0]) {
      branchId = branchResult.rows[0].id
    } else {
      branchId = newId()
      await tx.query(
        `INSERT INTO branches (id, code, name) VALUES ($1, 'MAIN', 'Main Branch')
         ON CONFLICT (code) DO NOTHING`,
        [branchId],
      )
      const b = await tx.query<{ id: string }>(`SELECT id FROM branches WHERE code = 'MAIN'`)
      branchId = b.rows[0].id
    }

    // 5. Insert N physical copies
    for (let i = 0; i < qty; i++) {
      const barcode = `${bookId}-${String(i + 1).padStart(3, '0')}`
      await tx.query(
        `INSERT INTO book_copies (id, book_id, branch_id, barcode)
         VALUES ($1, $2, $3, $4)`,
        [newId(), bookId, branchId, barcode],
      )
    }
  })

  return getBookById(bookId)
}

export async function updateBook(id: string, payload: BookPayload): Promise<Book> {
  const db = getDb()
  const existing = await db.query<{ id: string }>('SELECT id FROM books WHERE id = $1', [id])
  if (!existing.rows[0]) throw new AppError('Book not found', 404, 'NOT_FOUND')

  const {
    title,
    isbn13,
    isbn10,
    description,
    publishedYear,
    edition,
    languageCode,
    coverColor,
    coverUrl,
    authors: authorsRaw,
    categories: categoriesRaw,
  } = payload

  await db.transaction(async (tx) => {
    // Update books row — only provided fields
    await tx.query(
      `UPDATE books SET
         title          = COALESCE($1, title),
         isbn_13        = COALESCE($2, isbn_13),
         isbn_10        = COALESCE($3, isbn_10),
         description    = COALESCE($4, description),
         published_year = COALESCE($5, published_year),
         edition        = COALESCE($6, edition),
         language_code  = COALESCE($7, language_code),
         cover_color    = COALESCE($8, cover_color),
         cover_url      = COALESCE($9, cover_url),
         updated_at     = NOW()
       WHERE id = $10`,
      [
        title?.trim() || null,
        isbn13?.trim() || null,
        isbn10?.trim() || null,
        description !== undefined ? (description.trim() || null) : null,
        publishedYear ? parseInt(String(publishedYear), 10) : null,
        edition?.trim() || null,
        languageCode || null,
        coverColor || null,
        coverUrl?.trim() || null,
        id,
      ],
    )

    // Replace authors if provided
    if (authorsRaw !== undefined) {
      const authorNames = parseList(authorsRaw)
      if (authorNames.length > 0) {
        await tx.query(`DELETE FROM book_authors WHERE book_id = $1`, [id])
        for (let i = 0; i < authorNames.length; i++) {
          const authorId = await upsertAuthorTx(tx, authorNames[i])
          await tx.query(
            `INSERT INTO book_authors (book_id, author_id, author_order)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [id, authorId, i + 1],
          )
        }
      }
    }

    // Replace categories if provided
    if (categoriesRaw !== undefined) {
      const categoryNames = parseList(categoriesRaw)
      await tx.query(`DELETE FROM book_categories WHERE book_id = $1`, [id])
      for (const catName of categoryNames) {
        const categoryId = await upsertCategoryTx(tx, catName)
        await tx.query(
          `INSERT INTO book_categories (book_id, category_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, categoryId],
        )
      }
    }
  })

  return getBookById(id)
}

export async function deleteBook(id: string) {
  const db = getDb()

  // Check for active loans on any copy of this book
  const active = await db.query(
    `SELECT l.id FROM loans l
     JOIN book_copies bc ON bc.id = l.copy_id
     WHERE bc.book_id = $1 AND l.status IN ('active', 'overdue')
     LIMIT 1`,
    [id],
  )
  if (active.rows[0]) {
    throw new AppError('Cannot delete book with active loans', 400, 'HAS_ACTIVE_LOANS')
  }

  // Soft-delete: mark is_active = false (preserves history)
  const result = await db.query(
    `UPDATE books SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [id],
  )
  if (!result.rows[0]) throw new AppError('Book not found', 404, 'NOT_FOUND')
  return { id }
}

// ---------------------------------------------------------------------------
// Tx-scoped helpers (use DbClient not DbDriver)
// ---------------------------------------------------------------------------

import type { DbClient } from '../types'

async function upsertAuthorTx(tx: DbClient, fullName: string): Promise<string> {
  const existing = await tx.query<{ id: string }>(
    `SELECT id FROM authors WHERE LOWER(full_name) = LOWER($1)`,
    [fullName],
  )
  if (existing.rows[0]) return existing.rows[0].id
  const result = await tx.query<{ id: string }>(
    `INSERT INTO authors (id, full_name) VALUES ($1, $2) RETURNING id`,
    [newId(), fullName],
  )
  return result.rows[0].id
}

async function upsertCategoryTx(tx: DbClient, name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const existing = await tx.query<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1`,
    [slug],
  )
  if (existing.rows[0]) return existing.rows[0].id
  const result = await tx.query<{ id: string }>(
    `INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
    [newId(), name, slug],
  )
  return result.rows[0].id
}

