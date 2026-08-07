import type { Book, Borrow, User } from '../types'

type Row = Record<string, unknown>

export function mapUser(row?: Row | null): User | null {
  if (!row) return null
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as User['role'],
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
  }
}

export function mapBook(row?: Row | null): Book | null {
  if (!row) return null
  return {
    id: String(row.id),
    title: String(row.title),
    author: String(row.author),
    isbn: String(row.isbn),
    category: String(row.category),
    description: (row.description as string | null) ?? null,
    quantity: Number(row.quantity),
    available: Number(row.available),
    coverColor: String(row.cover_color ?? '#1F6F78'),
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
  }
}

export function mapBorrow(row?: Row | null): Borrow | null {
  if (!row) return null
  return {
    id: String(row.id),
    userId: String(row.user_id),
    bookId: String(row.book_id),
    borrowDate: row.borrow_date as Date | string,
    dueDate: row.due_date as Date | string,
    returnDate: (row.return_date as Date | string | null) ?? null,
    status: row.status as Borrow['status'],
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
    book: row.book_title
      ? {
          id: String(row.book_id),
          title: String(row.book_title),
          author: String(row.book_author),
          coverColor: String(row.book_cover_color),
        }
      : undefined,
    user: row.user_name
      ? {
          id: String(row.user_id),
          name: String(row.user_name),
          email: String(row.user_email),
        }
      : undefined,
  }
}
