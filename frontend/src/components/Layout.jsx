import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <div>
            <strong>Shelfmark</strong>
            <p>Library operations for schools, clubs, and reading rooms.</p>
          </div>
          <p>React frontend · Express API · PostgreSQL</p>
        </div>
      </footer>
    </div>
  )
}
