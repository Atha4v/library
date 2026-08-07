import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BookTile from '../components/BookTile'
import { booksApi } from '../api/client'

export default function Home() {
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    booksApi
      .list()
      .then((res) => setFeatured((res.data.items || []).slice(0, 3)))
      .catch(() => setFeatured([]))
  }, [])

  return (
    <>
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="hero-brand">Shelfmark</p>
            <h1>Know what&apos;s on the shelf before anyone asks.</h1>
            <p>
              Borrow, return, and restock without the spreadsheet scramble.
              Built for busy reading rooms that still care about the books.
            </p>
            <div className="hero-actions">
              <Link to="/catalog" className="btn btn-accent">
                Browse catalog
              </Link>
              <Link
                to="/register"
                className="btn btn-ghost"
                style={{ color: '#f4f7f7', borderColor: 'rgba(244,247,247,0.35)' }}
              >
                Create member account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">On the desk</span>
              <h2>Fresh copies worth opening</h2>
            </div>
            <p>A quick look at titles currently circulating in the catalog.</p>
          </div>
          {featured.length === 0 ? (
            <div className="empty">No books loaded yet. Is the API running?</div>
          ) : (
            <div className="book-grid">
              {featured.map((book) => (
                <BookTile key={book.id} book={book} />
              ))}
            </div>
          )}

          <div className="split-cta">
            <div>
              <h2>Running the stacks?</h2>
              <p>Admins can add copies, track overdue loans, and keep inventory honest.</p>
            </div>
            <Link to="/login" className="btn btn-accent">
              Staff sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
