import type {
  ApiResponse,
  AuthPayload,
  Book,
  BookCreatePayload,
  BookListData,
  Loan,
  LoginPayload,
  MemberStats,
  OverviewStats,
  RegisterPayload,
  User,
} from '../types'
import { ApiError } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function getToken(): string | null {
  return localStorage.getItem('shelfmark_token')
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('shelfmark_token', token)
  else localStorage.removeItem('shelfmark_token')
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  let body: ApiResponse<T>
  try {
    body = (await res.json()) as ApiResponse<T>
  } catch {
    body = {
      data: null as T,
      message: 'Invalid server response',
      error: 'BAD_RESPONSE',
    }
  }

  if (!res.ok) {
    throw new ApiError(
      body.message || 'Request failed',
      res.status,
      body.error,
      body as ApiResponse,
    )
  }

  return body
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  /** Login with email + password */
  login: (payload: LoginPayload) =>
    api<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Register — sends fullName (maps to users.full_name) */
  register: (payload: RegisterPayload) =>
    api<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Fetch the current authenticated user */
  me: () => api<User>('/auth/me'),
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

export interface BookListParams {
  q?: string
  category?: string   // category slug
  page?: number
  limit?: number
}

export const booksApi = {
  list: (params: BookListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.category && params.category !== 'all') qs.set('category', params.category)
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return api<BookListData>(`/books${query ? `?${query}` : ''}`)
  },

  get: (id: string) => api<Book>(`/books/${id}`),

  create: (payload: BookCreatePayload) =>
    api<Book>('/books', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<BookCreatePayload>) =>
    api<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id: string) =>
    api(`/books/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Borrows / Loans
// ---------------------------------------------------------------------------

export const borrowsApi = {
  /** Borrow a book — sends bookId (UUID string) */
  create: (bookId: string) =>
    api<Loan>('/borrows', { method: 'POST', body: JSON.stringify({ bookId }) }),

  /** My loan history */
  mine: () => api<Loan[]>('/borrows/me'),

  /** All loans (admin/librarian) — optionally filtered by status */
  all: (status?: string) =>
    api<Loan[]>(`/borrows${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  /** Return a loan */
  returnLoan: (id: string) => api(`/borrows/${id}/return`, { method: 'POST' }),

  /** Renew a loan */
  renew: (id: string) => api(`/borrows/${id}/renew`, { method: 'POST' }),
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const statsApi = {
  overview: () => api<OverviewStats>('/stats/overview'),
  me: () => api<MemberStats>('/stats/me'),
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersApi = {
  list: () => api<User[]>('/users'),
  getById: (id: string) => api<User>(`/users/${id}`),
  update: (id: string, payload: { fullName?: string; role?: string }) =>
    api<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => api(`/users/${id}`, { method: 'DELETE' }),
}
