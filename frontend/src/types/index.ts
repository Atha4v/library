export type UserRole = 'member' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface Book {
  id: number
  title: string
  author: string
  isbn: string
  category: string
  quantity: number
  available: number
  description?: string
  coverColor: string
}

export type LoanStatus = 'borrowed' | 'returned' | 'overdue'

export interface Loan {
  id: number
  borrowDate: string
  dueDate: string
  returnDate?: string | null
  status: LoanStatus | string
  book?: Pick<Book, 'id' | 'title' | 'author'> | null
  user?: Pick<User, 'id' | 'name' | 'email'> | null
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

export interface BookListData {
  items: Book[]
  categories?: string[]
}

export interface MemberStats {
  activeLoans: number
  returned: number
}

export interface OverviewStats {
  books?: number
  members?: number
  activeLoans?: number
}

export interface BookCreatePayload {
  title: string
  author: string
  isbn: string
  category?: string
  quantity: number
  description?: string
}

export interface RegisterPayload {
  name: string
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
