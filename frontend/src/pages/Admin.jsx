import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { booksApi, borrowsApi, statsApi } from '../api/client'

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [inventory, setInventory] = useState([])
  const [stats, setStats] = useState({ books: 0, members: 0, activeLoans: 0 })
  const [loans, setLoans] = useState([])
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'General',
    quantity: 1,
    description: '',
  })

  const load = async () => {
    try {
      const [booksRes, statsRes, loansRes] = await Promise.all([
        booksApi.list(),
        statsApi.overview(),
        borrowsApi.all('borrowed'),
      ])
      setInventory(booksRes.data.items || [])
      setStats(statsRes.data || {})
      setLoans(loansRes.data || [])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load admin data')
    }
  }

  useEffect(() => {
    if (user && isAdmin) load()
  }, [user, isAdmin])

  if (authLoading) return <div className="container page-hero"><div className="empty">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const onAdd = async (e) => {
    e.preventDefault()
    try {
      await booksApi.create({
        ...draft,
        quantity: Number(draft.quantity),
      })
      setDraft({
        title: '',
        author: '',
        isbn: '',
        category: 'General',
        quantity: 1,
        description: '',
      })
      await load()
    } catch (err) {
      setError(err.message || 'Could not add book')
    }
  }

  const onDelete = async (id) => {
    try {
      await booksApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message || 'Could not delete book')
    }
  }

  return (
    <div className="container page-hero">
      <span className="eyebrow">Staff console</span>
      <h1>Admin desk</h1>
      <p>Manage inventory and keep an eye on circulation.</p>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className="stats">
        <div className="stat">
          <span>Titles</span>
          <strong>{stats.books ?? inventory.length}</strong>
        </div>
        <div className="stat">
          <span>Active loans</span>
          <strong>{stats.activeLoans ?? loans.length}</strong>
        </div>
        <div className="stat">
          <span>Members</span>
          <strong>{stats.members ?? 0}</strong>
        </div>
      </div>

      <div className="panel wide" style={{ margin: '0 0 1.5rem' }}>
        <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Add a title</h2>
        <form
          className="form"
          onSubmit={onAdd}
          style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}
        >
          <label>
            Title
            <input
              className="field"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </label>
          <label>
            Author
            <input
              className="field"
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              required
            />
          </label>
          <label>
            ISBN
            <input
              className="field"
              value={draft.isbn}
              onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
              required
            />
          </label>
          <label>
            Quantity
            <input
              className="field"
              type="number"
              min="1"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              required
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Description
            <input
              className="field"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn-primary">
              Add to inventory
            </button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>ISBN</th>
              <th>Qty</th>
              <th>Available</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {inventory.map((book) => (
              <tr key={book.id}>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.isbn}</td>
                <td>{book.quantity}</td>
                <td>{book.available}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.7rem' }}
                    onClick={() => onDelete(book.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Active loans</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Title</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={5}><div className="empty">No active loans.</div></td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.user?.name ?? '—'}</td>
                  <td>{loan.book?.title ?? '—'}</td>
                  <td>{String(loan.borrowDate).slice(0, 10)}</td>
                  <td>{String(loan.dueDate).slice(0, 10)}</td>
                  <td><span className="pill ok">{loan.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
