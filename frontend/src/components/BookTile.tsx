import { Link } from 'react-router-dom'
import type { Book } from '../types'

interface BookTileProps {
  book: Book
}

export default function BookTile({ book }: BookTileProps) {
  const out = book.availableCopies <= 0

  return (
    <Link to={`/books/${book.id}`} className="book-tile">
      <div
        className="book-spine"
        style={{
          background: `linear-gradient(145deg, ${book.coverColor}, #102a32)`,
        }}
      >
        <div>
          <div className="pill" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
            {book.categories[0]?.name ?? 'General'}
          </div>
        </div>
      </div>
      <div className="book-meta">
        <h3>{book.title}</h3>
        <p className="author">{book.authors.map((a) => a.fullName).join(', ')}</p>
        <div className="meta-row">
          <span>{out ? 'Waitlist' : `${book.availableCopies} available`}</span>
          <span className={`pill ${out ? 'warn' : 'ok'}`}>
            {out ? 'Out' : 'In shelf'}
          </span>
        </div>
      </div>
    </Link>
  )
}
