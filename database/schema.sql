-- Shelfmark Library Management System
-- PostgreSQL schema (compatible with PGlite local mode)
-- Run against real Postgres: psql -U postgres -d shelfmark -f database/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id          TEXT PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  author      VARCHAR(255) NOT NULL,
  isbn        VARCHAR(32) NOT NULL UNIQUE,
  category    VARCHAR(80) NOT NULL DEFAULT 'General',
  description TEXT,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  available   INTEGER NOT NULL DEFAULT 1 CHECK (available >= 0),
  cover_color VARCHAR(16) DEFAULT '#1F6F78',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT books_available_lte_quantity CHECK (available <= quantity)
);

CREATE TABLE IF NOT EXISTS borrowed_books (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id      TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  borrow_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE NOT NULL,
  return_date  DATE,
  status       VARCHAR(20) NOT NULL DEFAULT 'borrowed'
               CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT borrowed_return_logic CHECK (
    (status = 'returned' AND return_date IS NOT NULL)
    OR (status <> 'returned')
  )
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books (author);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books (isbn);
CREATE INDEX IF NOT EXISTS idx_borrowed_user ON borrowed_books (user_id);
CREATE INDEX IF NOT EXISTS idx_borrowed_book ON borrowed_books (book_id);
CREATE INDEX IF NOT EXISTS idx_borrowed_status ON borrowed_books (status);
