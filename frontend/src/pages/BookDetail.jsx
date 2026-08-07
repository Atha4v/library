import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { booksApi, borrowsApi } from '../api/client'

export default function BookDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLoading(true)
    booksApi
      .get(id)
      .then((res) => {
        setBook(res.data)
        setError('')
      })
      .catch((err) => {
        setBook(null)
        setError(err.message || 'Book not found')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleBorrow = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await borrowsApi.create(book.id)
      const refreshed = await booksApi.get(id)
      setBook(refreshed.data)
      setMessage('Borrowed successfully. Check My loans for the due date.')
    } catch (err) {
      setMessage(err.message || 'Could not borrow this book')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="container page-hero"><div className="empty">Loading…</div></div>
  }

  if (!book) {
    return (
      <div className="container page-hero">
        <h1>Book not found</h1>
        <p>{error || "That title isn't in the catalog."}</p>
        <Link to="/catalog" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="container page-hero">
      <div className="detail">
        <div
          className="cover-large"
          style={{
            background: `linear-gradient(160deg, ${book.coverColor}, #102a32)`,
          }}
        >
          <span
            className="pill"
            style={{
              width: 'fit-content',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
            }}
          >
            {book.category}
          </span>
          <h2 style={{ marginTop: 'auto', fontSize: '1.6rem' }}>{book.title}</h2>
        </div>

        <div className="detail-body">
          <span className="eyebrow">Title record</span>
          <h1>{book.title}</h1>
          <p style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
            by <strong>{book.author}</strong>
          </p>
          <p>{book.description}</p>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="stat">
              <span>ISBN</span>
              <strong style={{ fontSize: '1rem' }}>{book.isbn}</strong>
            </div>
            <div className="stat">
              <span>Total copies</span>
              <strong>{book.quantity}</strong>
            </div>
            <div className="stat">
              <span>Available</span>
              <strong>{book.available}</strong>
            </div>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBorrow}
              disabled={busy || book.available <= 0}
            >
              {book.available <= 0 ? 'Out of stock' : busy ? 'Borrowing…' : 'Borrow this copy'}
            </button>
            <Link to="/catalog" className="btn btn-ghost">
              Keep browsing
            </Link>
          </div>
          {message && <p className="hint" style={{ marginTop: '1rem' }}>{message}</p>}
        </div>
      </div>
    </div>
  )
}
