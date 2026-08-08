// =============================================================================
// Frontend types — aligned to schema.sql v2
// =============================================================================

export type UserRole = 'admin' | 'librarian' | 'member'

export interface User {
  id: string            // UUID
  fullName: string      // schema: full_name
  email: string
  role: UserRole        // joined from roles.code
  isActive?: boolean
  emailVerified?: boolean
}

export interface Author {
  id: string
  fullName: string
  authorOrder: number
  contribution: string
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Book {
  id: string            // UUID
  title: string
  subtitle?: string | null
  isbn13?: string | null
  isbn10?: string | null
  publishedYear?: number | null
  edition?: string | null
  languageCode: string
  pageCount?: number | null
  description?: string | null
  coverUrl?: string | null
  coverColor: string
  isActive: boolean
  authors: Author[]
  categories: Category[]
  // Derived from book_copies
  totalCopies: number
  availableCopies: number
  onLoanCopies: number
  reservedCopies: number
}

/** 'active' = schema status for active loan (was 'borrowed' in old flat schema) */
export type LoanStatus = 'active' | 'returned' | 'overdue' | 'lost'

export interface Loan {
  id: string            // UUID
  copyId: string
  memberId: string
  branchId: string
  borrowedAt: string    // schema: borrowed_at
  dueAt: string         // schema: due_at
  returnedAt?: string | null   // schema: returned_at
  renewalCount: number
  status: LoanStatus | string
  book?: {
    id: string
    title: string
    authors: string[]   // comma-joined names
    coverColor: string
    isbn13?: string | null
    isbn10?: string | null
  } | null
  member?: {
    id: string
    membershipNumber: string
    userId: string
    fullName: string
    email: string
  } | null
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  error?: string
}

export interface AuthPayload {
  token: string
  user: User
}

export interface CategoryMeta {
  name: string
  slug: string
}

export interface BookListData {
  items: Book[]
  total: number
  page: number
  limit: number
  categories?: CategoryMeta[]
}

export interface MemberStats {
  activeLoans: number
  returned: number
  overdue: number
  role: UserRole
}

export interface OverviewStats {
  books?: number
  members?: number
  activeLoans?: number
  overdueLoans?: number
}

export interface BookCreatePayload {
  title: string
  authors: string | string[]  // comma-separated or array
  isbn13?: string
  isbn10?: string
  categories?: string | string[]
  quantity?: number
  description?: string
  publishedYear?: number
  edition?: string
  languageCode?: string
  coverColor?: string
  coverUrl?: string
}

export interface RegisterPayload {
  fullName: string      // schema: full_name
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResult {
  ok: boolean
  message?: string
}

export class ApiError extends Error {
  status: number
  code?: string
  body?: ApiResponse

  constructor(
    message: string,
    status: number,
    code?: string,
    body?: ApiResponse,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}
