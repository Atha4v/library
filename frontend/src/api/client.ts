import type {
  ApiResponse,
  AuthPayload,
  Book,
  BookCreatePayload,
  BookListData,
  Loan,
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

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: RegisterPayload) =>
    api<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => api<User>('/auth/me'),
}

export interface BookListParams {
  q?: string
  category?: string
}

export const booksApi = {
  list: (params: BookListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.category && params.category !== 'all') qs.set('category', params.category)
    const query = qs.toString()
    return api<BookListData>(`/books${query ? `?${query}` : ''}`)
  },
  get: (id: string | number) => api<Book>(`/books/${id}`),
  create: (payload: BookCreatePayload) =>
    api<Book>('/books', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string | number, payload: Partial<BookCreatePayload>) =>
    api<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string | number) =>
    api(`/books/${id}`, { method: 'DELETE' }),
}

export const borrowsApi = {
  create: (bookId: number) =>
    api<Loan>('/borrows', { method: 'POST', body: JSON.stringify({ bookId }) }),
  mine: () => api<Loan[]>('/borrows/me'),
  all: (status?: string) =>
    api<Loan[]>(`/borrows${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  returnLoan: (id: number) => api(`/borrows/${id}/return`, { method: 'POST' }),
  renew: (id: number) => api(`/borrows/${id}/renew`, { method: 'POST' }),
}

export const statsApi = {
  overview: () => api<OverviewStats>('/stats/overview'),
  me: () => api<MemberStats>('/stats/me'),
}

export const usersApi = {
  list: () => api<User[]>('/users'),
}
