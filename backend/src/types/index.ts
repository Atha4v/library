// =============================================================================
// Types aligned to schema.sql v2
// =============================================================================

export type UserRole = 'admin' | 'librarian' | 'member'
export type LoanStatus = 'active' | 'returned' | 'overdue' | 'lost'
export type CopyStatus = 'available' | 'on_loan' | 'reserved' | 'lost' | 'damaged' | 'in_repair' | 'retired'
export type DbMode = 'pglite' | 'postgres'

// -----------------------------------------------------------------------------
// Identity & access
// -----------------------------------------------------------------------------

export interface User {
  id: string           // UUID
  roleId: string       // FK → roles.id
  role: UserRole       // joined from roles.code
  email: string
  fullName: string
  phone?: string | null
  isActive: boolean
  emailVerified: boolean
  lastLoginAt?: Date | string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

// -----------------------------------------------------------------------------
// Members (library profile, layered on users)
// -----------------------------------------------------------------------------

export interface Member {
  id: string           // UUID
  userId: string       // FK → users.id
  membershipNumber: string
  status: 'active' | 'suspended' | 'expired' | 'cancelled'
  joinedOn: string     // DATE
  expiresOn?: string | null
  preferredBranchId?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------

export interface Author {
  id: string
  fullName: string
  sortName?: string | null
  biography?: string | null
  birthYear?: number | null
  deathYear?: number | null
}

export interface Category {
  id: string
  parentId?: string | null
  name: string
  slug: string
  description?: string | null
}

export interface Book {
  id: string           // UUID
  title: string
  subtitle?: string | null
  isbn13?: string | null
  isbn10?: string | null
  publisherId?: string | null
  publishedYear?: number | null
  edition?: string | null
  languageCode: string
  pageCount?: number | null
  description?: string | null
  coverUrl?: string | null
  coverColor: string
  deweyCode?: string | null
  isActive: boolean
  // Joined/aggregated fields
  authors: { id: string; fullName: string; authorOrder: number; contribution: string }[]
  categories: { id: string; name: string; slug: string }[]
  // Derived from book_copies
  totalCopies: number
  availableCopies: number
  onLoanCopies: number
  reservedCopies: number
  createdAt?: Date | string
  updatedAt?: Date | string
}

// -----------------------------------------------------------------------------
// Circulation — loans
// -----------------------------------------------------------------------------

export interface Borrow {
  id: string           // UUID (loans.id)
  copyId: string       // FK → book_copies.id
  memberId: string     // FK → members.id
  branchId: string     // FK → branches.id
  issuedBy?: string | null
  returnedTo?: string | null
  borrowedAt: Date | string   // loans.borrowed_at
  dueAt: Date | string        // loans.due_at
  returnedAt?: Date | string | null  // loans.returned_at
  renewalCount: number
  status: LoanStatus
  notes?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  // Joined
  book?: {
    id: string
    title: string
    authors: string[]         // comma-joined author names for convenience
    coverColor: string
    isbn13?: string | null
    isbn10?: string | null
  }
  member?: {
    id: string
    membershipNumber: string
    userId: string
    fullName: string
    email: string
  }
}

// -----------------------------------------------------------------------------
// DB driver abstraction
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Service payloads (request bodies)
// -----------------------------------------------------------------------------

export interface AuthPayload {
  fullName?: string
  email?: string
  password?: string
}

export interface BookPayload {
  title?: string
  /** Comma-separated or array of author full names */
  authors?: string | string[]
  isbn13?: string
  isbn10?: string
  categories?: string | string[]   // category names or slugs
  description?: string
  publishedYear?: number | string
  edition?: string
  languageCode?: string
  coverColor?: string
  coverUrl?: string
  /** How many physical copies to create/target */
  quantity?: number | string
}

export interface BookListQuery {
  q?: string
  category?: string
  page?: string
  limit?: string
}
