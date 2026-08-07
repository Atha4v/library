import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('priya@shelfmark.local')
  const [password, setPassword] = useState('member123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message || 'Login failed')
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="auth-wrap">
      <span className="eyebrow">Welcome back</span>
      <h1>Sign in</h1>
      <p className="hint">
        Seed accounts — member: priya@shelfmark.local / member123 · admin:
        admin@shelfmark.local / admin123
      </p>

      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </div>
  )
}
