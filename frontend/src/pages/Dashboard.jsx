import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { borrowsApi, statsApi } from '../api/client'

function formatDate(value) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState({ activeLoans: 0, returned: 0 })
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    try {
      const [loanRes, statsRes] = await Promise.all([
        borrowsApi.mine(),
        statsApi.me(),
      ])
      setLoans(loanRes.data || [])
      setStats(statsRes.data || { activeLoans: 0, returned: 0 })
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load loans')
    }
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  if (authLoading) return <div className="container page-hero"><div className="empty">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />

  const onReturn = async (id) => {
    setBusyId(id)
    try {
      await borrowsApi.returnLoan(id)
      await load()
    } catch (err) {
      setError(err.message || 'Return failed')
    } finally {
      setBusyId(null)
    }
  }

  const onRenew = async (id) => {
    setBusyId(id)
    try {
      await borrowsApi.renew(id)
      await load()
    } catch (err) {
      setError(err.message || 'Renew failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="container page-hero">
      <span className="eyebrow">Member desk</span>
      <h1>Hi, {user.name.split(' ')[0]}</h1>
      <p>Your current loans and recent returns.</p>

      <div className="stats">
        <div className="stat">
          <span>Active loans</span>
          <strong>{stats.activeLoans}</strong>
        </div>
        <div className="stat">
          <span>Returned</span>
          <strong>{stats.returned}</strong>
        </div>
        <div className="stat">
          <span>Role</span>
          <strong style={{ fontSize: '1.2rem', textTransform: 'capitalize' }}>
            {user.role}
          </strong>
        </div>
      </div>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty">No loans yet. Browse the catalog to borrow a book.</div>
                </td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr key={loan.id}>
                  <td>
                    {loan.book ? (
                      <Link to={`/books/${loan.book.id}`}>{loan.book.title}</Link>
                    ) : (
                      'Unknown title'
                    )}
                  </td>
                  <td>{formatDate(loan.borrowDate)}</td>
                  <td>{formatDate(loan.dueDate)}</td>
                  <td>
                    <span
                      className={`pill ${
                        loan.status === 'borrowed'
                          ? 'ok'
                          : loan.status === 'overdue'
                            ? 'warn'
                            : ''
                      }`}
                    >
                      {loan.status}
                    </span>
                  </td>
                  <td>
                    {(loan.status === 'borrowed' || loan.status === 'overdue') && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.7rem' }}
                          disabled={busyId === loan.id}
                          onClick={() => onReturn(loan.id)}
                        >
                          Return
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.7rem' }}
                          disabled={busyId === loan.id}
                          onClick={() => onRenew(loan.id)}
                        >
                          Renew
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
