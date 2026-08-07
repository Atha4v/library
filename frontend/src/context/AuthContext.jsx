import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { authApi, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
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

  const login = useCallback(async (email, password) => {
    try {
      const res = await authApi.login(email, password)
      setToken(res.data.token)
      setUser(res.data.user)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err.message || 'Login failed' }
    }
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    try {
      const res = await authApi.register({ name, email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err.message || 'Registration failed' }
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
    }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
