import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <header className="site-header">
      <div className="container nav">
        <Link to="/" className="brand" aria-label="Shelfmark home">
          <span className="brand-mark" />
          <span>Shelfmark</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <NavLink to="/catalog">Catalog</NavLink>
          {user && <NavLink to="/dashboard">My loans</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          {!user ? (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 0.95rem' }}>
                Join
              </Link>
            </>
          ) : (
            <button type="button" className="linkish" onClick={logout}>
              Sign out · {user.fullName.split(' ')[0]}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
