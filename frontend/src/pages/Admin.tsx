import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState, type FormEvent } from 'react'
import { booksApi, borrowsApi, statsApi } from '../api/client'
import type { Book, BookCreatePayload, Loan, OverviewStats } from '../types'

type BookDraft = Omit<BookCreatePayload, 'authors' | 'categories'> & {
  authors: string
  categories: string
}

const emptyDraft = (): BookDraft => ({
  title: '',
  authors: '',
  isbn13: '',
  categories: 'General',
  quantity: 1,
  description: '',
})

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [inventory, setInventory] = useState<Book[]>([])
  const [stats, setStats] = useState<OverviewStats>({ books: 0, members: 0, activeLoans: 0 })
  const [loans, setLoans] = useState<Loan[]>([])
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<BookDraft>(emptyDraft())

  const load = async () => {
    try {
      const [booksRes, statsRes, loansRes] = await Promise.all([
        booksApi.list(),
        statsApi.overview(),
        borrowsApi.all('active'),          // schema status 'active' (not 'borrowed')
      ])
      setInventory(booksRes.data.items || [])
      setStats(statsRes.data || {})
      setLoans(loansRes.data || [])
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    }
  }

  useEffect(() => {
    if (user && isAdmin) void load()
  }, [user, isAdmin])

  if (authLoading) return <div className="container page-hero"><div className="empty">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await booksApi.create({
        ...draft,
        quantity: Number(draft.quantity),
        // pass as strings — backend parseList handles comma-separated
        authors: draft.authors,
        categories: draft.categories,
      })
      setDraft(emptyDraft())
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add book')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await booksApi.remove(id)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete book')
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
          onSubmit={(e) => void onAdd(e)}
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
            Author(s) <small style={{ opacity: 0.6 }}>(comma-separated)</small>
            <input
              className="field"
              value={draft.authors}
              onChange={(e) => setDraft({ ...draft, authors: e.target.value })}
              placeholder="e.g. Jane Austen, John Smith"
              required
            />
          </label>
          <label>
            ISBN-13
            <input
              className="field"
              value={draft.isbn13 ?? ''}
              onChange={(e) => setDraft({ ...draft, isbn13: e.target.value })}
              placeholder="978-..."
              required
            />
          </label>
          <label>
            Copies
            <input
              className="field"
              type="number"
              min="1"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
              required
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Description
            <input
              className="field"
              value={draft.description ?? ''}
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
              <th>Author(s)</th>
              <th>ISBN-13</th>
              <th>Total copies</th>
              <th>Available</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {inventory.map((book) => (
              <tr key={book.id}>
                <td>{book.title}</td>
                <td>{book.authors.map((a) => a.fullName).join(', ')}</td>
                <td>{book.isbn13 ?? book.isbn10 ?? '—'}</td>
                <td>{book.totalCopies}</td>
                <td>{book.availableCopies}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.7rem' }}
                    onClick={() => void onDelete(book.id)}
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
                  <td>{loan.member?.fullName ?? '—'}</td>
                  <td>{loan.book?.title ?? '—'}</td>
                  <td>{String(loan.borrowedAt).slice(0, 10)}</td>
                  <td>{String(loan.dueAt).slice(0, 10)}</td>
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
