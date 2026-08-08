import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, setToken } from '../api/client'
import type { AuthResult, RegisterPayload, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (payload: RegisterPayload) => Promise<AuthResult>
  logout: () => void
  isAdmin: boolean
  isStaff: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('shelfmark_token')
    if (!token) {
      setLoading(false)
      return
    }

    authApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await authApi.login({ email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      return { ok: false, message }
    }
  }, [])

  const register = useCallback(async ({ fullName, email, password }: RegisterPayload): Promise<AuthResult> => {
    try {
      const res = await authApi.register({ fullName, email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      return { ok: false, message }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'admin' || user?.role === 'librarian',
    }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
