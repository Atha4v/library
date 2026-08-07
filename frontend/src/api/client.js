const API_BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('shelfmark_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('shelfmark_token', token)
  else localStorage.removeItem('shelfmark_token')
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  let body
  try {
    body = await res.json()
  } catch {
    body = { data: null, message: 'Invalid server response', error: 'BAD_RESPONSE' }
  }

  if (!res.ok) {
    const err = new Error(body.message || 'Request failed')
    err.status = res.status
    err.code = body.error
    err.body = body
    throw err
  }

  return body
}

export const authApi = {
  login: (email, password) =>
    api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload) =>
    api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => api('/auth/me'),
}

export const booksApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.category && params.category !== 'all') qs.set('category', params.category)
    const query = qs.toString()
    return api(`/books${query ? `?${query}` : ''}`)
  },
  get: (id) => api(`/books/${id}`),
  create: (payload) =>
    api('/books', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    api(`/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => api(`/books/${id}`, { method: 'DELETE' }),
}

export const borrowsApi = {
  create: (bookId) =>
    api('/borrows', { method: 'POST', body: JSON.stringify({ bookId }) }),
  mine: () => api('/borrows/me'),
  all: (status) =>
    api(`/borrows${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  returnLoan: (id) => api(`/borrows/${id}/return`, { method: 'POST' }),
  renew: (id) => api(`/borrows/${id}/renew`, { method: 'POST' }),
}

export const statsApi = {
  overview: () => api('/stats/overview'),
  me: () => api('/stats/me'),
}

export const usersApi = {
  list: () => api('/users'),
}
