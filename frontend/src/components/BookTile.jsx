import { Link } from 'react-router-dom'

export default function BookTile({ book }) {
  const out = book.available <= 0

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
            {book.category}
          </div>
        </div>
      </div>
      <div className="book-meta">
        <h3>{book.title}</h3>
        <p className="author">{book.author}</p>
        <div className="meta-row">
          <span>{out ? 'Waitlist' : `${book.available} available`}</span>
          <span className={`pill ${out ? 'warn' : 'ok'}`}>
            {out ? 'Out' : 'In shelf'}
          </span>
        </div>
      </div>
    </Link>
  )
}
