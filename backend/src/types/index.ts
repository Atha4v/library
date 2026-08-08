export type UserRole = 'admin' | 'member'
export type LoanStatus = 'borrowed' | 'returned' | 'overdue' | 'lost'
export type DbMode = 'pglite' | 'postgres'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface Book {
  id: string
  title: string
  author: string
  isbn: string
  category: string
  description: string | null
  quantity: number
  available: number
  coverColor: string
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface Borrow {
  id: string
  userId: string
  bookId: string
  borrowDate: Date | string
  dueDate: Date | string
  returnDate: Date | string | null
  status: LoanStatus
  createdAt?: Date | string
  updatedAt?: Date | string
  book?: {
    id: string
    title: string
    author: string
    coverColor: string
  }
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

export interface DbClient {
  query: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>
}

export interface DbDriver extends DbClient {
  exec: (text: string) => Promise<void>
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>
}

export interface AuthPayload {
  name?: string
  email?: string
  password?: string
}

export interface BookPayload {
  title?: string
  subtitle?: string
  isbn13?: string
  isbn10?: string
  publisherId?: string
  publishedYear?: number
  edition?: string
  languageCode?: string
  pageCount?: number
  description?: string
  coverUrl?: string
  coverColor?: string
  deweyCode?: string
  isActive?: boolean
  authorIds?: string[]      // UUIDs from authors table
  categoryIds?: string[]    // UUIDs from categories table
}

export interface BookListQuery {
  q?: string
  category?: string        // category SLUG, not name
  page?: string
  limit?: string
}
