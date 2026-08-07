import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await register(form)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/catalog')
  }

  return (
    <div className="auth-wrap">
      <span className="eyebrow">Membership</span>
      <h1>Join Shelfmark</h1>
      <p className="hint">Create a member account to borrow titles from the catalog.</p>

      <form className="form" onSubmit={onSubmit}>
        <label>
          Full name
          <input
            className="field"
            name="name"
            value={form.name}
            onChange={onChange}
            required
          />
        </label>
        <label>
          Email
          <input
            className="field"
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
          />
        </label>
        <label>
          Password
          <input
            className="field"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
