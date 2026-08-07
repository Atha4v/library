import { useEffect, useState } from 'react'
import BookTile from '../components/BookTile'
import { booksApi } from '../api/client'
import type { Book } from '../types'

export default function Catalog() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<string[]>(['all'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      booksApi
        .list({ q: query, category })
        .then((res) => {
          setBooks(res.data.items || [])
          setCategories(['all', ...(res.data.categories || [])])
          setError('')
        })
        .catch((err: unknown) => {
          setBooks([])
          setError(err instanceof Error ? err.message : 'Failed to load catalog')
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(t)
  }, [query, category])

  return (
    <div className="container page-hero">
      <span className="eyebrow">Catalog</span>
      <h1>Find a copy</h1>
      <p>Search by title, author, or ISBN. Filter by shelf category.</p>

      <div className="toolbar">
        <input
          className="field"
          type="search"
          placeholder="Search titles, authors, ISBN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="empty">Loading catalog…</div>}
      {!loading && error && <div className="empty error">{error}</div>}
      {!loading && !error && books.length === 0 && (
        <div className="empty">No titles match that search.</div>
      )}
      {!loading && !error && books.length > 0 && (
        <div className="book-grid">
          {books.map((book) => (
            <BookTile key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}
