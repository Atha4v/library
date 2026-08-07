-- =============================================================================
-- Shelfmark Library Management System — PostgreSQL Schema v2
-- Clean, normalized, scalable circulation model
-- =============================================================================
-- Design principles:
--   1. Catalog (books) ≠ physical inventory (book_copies)
--   2. Authors / categories / publishers are first-class entities
--   3. Members are profiles linked to auth users (RBAC via roles)
--   4. Loans attach to a specific copy, not a vague "book quantity"
--   5. Reservations, fines, renewals, branches, audit trail included
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. IDENTITY & ACCESS
-- =============================================================================

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(40) NOT NULL UNIQUE,          -- admin | librarian | member
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(160) NOT NULL,
  phone           VARCHAR(30),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                       -- soft delete
);

CREATE INDEX idx_users_role_id ON users (role_id);
CREATE INDEX idx_users_active ON users (is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Optional refresh / session tracking for scalable auth
CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent      TEXT,
  ip_address      INET,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);

-- =============================================================================
-- 2. ORGANIZATION
-- =============================================================================

CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) NOT NULL UNIQUE,          -- MAIN, NORTH, ...
  name        VARCHAR(120) NOT NULL,
  address     TEXT,
  city        VARCHAR(80),
  phone       VARCHAR(30),
  email       VARCHAR(255),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_branches_updated
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Tunable policy (one row per branch, or global when branch_id IS NULL)
CREATE TABLE library_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             UUID UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  loan_period_days      INTEGER NOT NULL DEFAULT 14 CHECK (loan_period_days > 0),
  max_active_loans      INTEGER NOT NULL DEFAULT 5 CHECK (max_active_loans > 0),
  max_renewals          INTEGER NOT NULL DEFAULT 2 CHECK (max_renewals >= 0),
  renewal_period_days   INTEGER NOT NULL DEFAULT 14 CHECK (renewal_period_days > 0),
  reservation_hold_days INTEGER NOT NULL DEFAULT 3 CHECK (reservation_hold_days > 0),
  fine_per_day          NUMERIC(10, 2) NOT NULL DEFAULT 5.00 CHECK (fine_per_day >= 0),
  max_fine              NUMERIC(10, 2) NOT NULL DEFAULT 500.00 CHECK (max_fine >= 0),
  currency_code         CHAR(3) NOT NULL DEFAULT 'INR',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_library_settings_updated
BEFORE UPDATE ON library_settings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- =============================================================================
-- 3. MEMBERSHIP (profile layered on users)
-- =============================================================================

CREATE TABLE members (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  membership_number  VARCHAR(40) NOT NULL UNIQUE,   -- library card number
  status             VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
  joined_on          DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_on         DATE,
  date_of_birth      DATE,
  address_line1      VARCHAR(255),
  address_line2      VARCHAR(255),
  city               VARCHAR(80),
  state              VARCHAR(80),
  postal_code        VARCHAR(20),
  country            VARCHAR(80) DEFAULT 'India',
  preferred_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  notes              TEXT,                          -- staff-only notes
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT members_expiry_ok CHECK (expires_on IS NULL OR expires_on >= joined_on)
);

CREATE INDEX idx_members_status ON members (status);
CREATE INDEX idx_members_branch ON members (preferred_branch_id);

CREATE TRIGGER trg_members_updated
BEFORE UPDATE ON members
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- =============================================================================
-- 4. CATALOG (bibliographic — what the title *is*)
-- =============================================================================

CREATE TABLE authors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    VARCHAR(160) NOT NULL,
  sort_name    VARCHAR(160),                        -- "Ishiguro, Kazuo"
  biography    TEXT,
  birth_year   SMALLINT,
  death_year   SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_authors_full_name_ci ON authors (LOWER(full_name));

CREATE TRIGGER trg_authors_updated
BEFORE UPDATE ON authors
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE publishers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(160) NOT NULL UNIQUE,
  website     VARCHAR(255),
  country     VARCHAR(80),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, name)
);

CREATE TABLE books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  subtitle        VARCHAR(255),
  isbn_13         CHAR(13) UNIQUE,                  -- prefer ISBN-13
  isbn_10         CHAR(10) UNIQUE,
  publisher_id    UUID REFERENCES publishers(id) ON DELETE SET NULL,
  published_year  SMALLINT CHECK (published_year IS NULL OR published_year BETWEEN 1000 AND 2100),
  edition         VARCHAR(80),
  language_code   VARCHAR(10) NOT NULL DEFAULT 'en',
  page_count      INTEGER CHECK (page_count IS NULL OR page_count > 0),
  description     TEXT,
  cover_url       TEXT,
  cover_color     VARCHAR(16) DEFAULT '#1F6F78',
  dewey_code      VARCHAR(20),                      -- optional classification
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,    -- hide from catalog if false
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT books_has_isbn CHECK (isbn_13 IS NOT NULL OR isbn_10 IS NOT NULL)
);

CREATE INDEX idx_books_title ON books USING gin (to_tsvector('english', title));
CREATE INDEX idx_books_publisher ON books (publisher_id);
CREATE INDEX idx_books_active ON books (is_active);

CREATE TRIGGER trg_books_updated
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE book_authors (
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
  author_order SMALLINT NOT NULL DEFAULT 1 CHECK (author_order > 0),
  contribution VARCHAR(40) DEFAULT 'author',        -- author | editor | illustrator
  PRIMARY KEY (book_id, author_id)
);

CREATE INDEX idx_book_authors_author ON book_authors (author_id);

CREATE TABLE book_categories (
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (book_id, category_id)
);

CREATE INDEX idx_book_categories_category ON book_categories (category_id);

-- =============================================================================
-- 5. INVENTORY (physical copies — what you can lend)
-- =============================================================================

CREATE TABLE book_copies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  barcode         VARCHAR(64) NOT NULL UNIQUE,      -- scanned at desk
  accession_no    VARCHAR(64) UNIQUE,               -- internal accession number
  shelf_code      VARCHAR(40),                      -- e.g. A3-L2
  condition       VARCHAR(20) NOT NULL DEFAULT 'good'
                  CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  status          VARCHAR(20) NOT NULL DEFAULT 'available'
                  CHECK (status IN (
                    'available', 'on_loan', 'reserved', 'lost',
                    'damaged', 'in_repair', 'retired'
                  )),
  acquired_on     DATE DEFAULT CURRENT_DATE,
  price           NUMERIC(10, 2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_book_copies_book ON book_copies (book_id);
CREATE INDEX idx_book_copies_branch ON book_copies (branch_id);
CREATE INDEX idx_book_copies_status ON book_copies (status);
CREATE INDEX idx_book_copies_book_status ON book_copies (book_id, status);

CREATE TRIGGER trg_book_copies_updated
BEFORE UPDATE ON book_copies
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Convenience view: availability without denormalized counters
CREATE OR REPLACE VIEW book_availability AS
SELECT
  b.id AS book_id,
  b.title,
  COUNT(c.id) FILTER (WHERE c.status <> 'retired') AS total_copies,
  COUNT(c.id) FILTER (WHERE c.status = 'available') AS available_copies,
  COUNT(c.id) FILTER (WHERE c.status = 'on_loan') AS on_loan_copies,
  COUNT(c.id) FILTER (WHERE c.status = 'reserved') AS reserved_copies
FROM books b
LEFT JOIN book_copies c ON c.book_id = b.id
GROUP BY b.id, b.title;

-- =============================================================================
-- 6. CIRCULATION — LOANS
-- =============================================================================

CREATE TABLE loans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id         UUID NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  issued_by       UUID REFERENCES users(id) ON DELETE SET NULL,  -- staff who issued
  returned_to     UUID REFERENCES users(id) ON DELETE SET NULL,  -- staff who received
  borrowed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at          TIMESTAMPTZ NOT NULL,
  returned_at     TIMESTAMPTZ,
  renewal_count   INTEGER NOT NULL DEFAULT 0 CHECK (renewal_count >= 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loans_return_logic CHECK (
    (status = 'returned' AND returned_at IS NOT NULL)
    OR (status <> 'returned')
  ),
  CONSTRAINT loans_due_after_borrow CHECK (due_at > borrowed_at)
);

-- One active loan per physical copy
CREATE UNIQUE INDEX idx_loans_one_active_per_copy
  ON loans (copy_id)
  WHERE status IN ('active', 'overdue');

CREATE INDEX idx_loans_member ON loans (member_id);
CREATE INDEX idx_loans_status ON loans (status);
CREATE INDEX idx_loans_due_at ON loans (due_at);
CREATE INDEX idx_loans_member_status ON loans (member_id, status);

CREATE TRIGGER trg_loans_updated
BEFORE UPDATE ON loans
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE loan_renewals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  renewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  previous_due_at TIMESTAMPTZ NOT NULL,
  new_due_at      TIMESTAMPTZ NOT NULL,
  renewed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_renewals_due_forward CHECK (new_due_at > previous_due_at)
);

CREATE INDEX idx_loan_renewals_loan ON loan_renewals (loan_id);

-- =============================================================================
-- 7. RESERVATIONS / HOLDS
-- =============================================================================

CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  copy_id         UUID REFERENCES book_copies(id) ON DELETE SET NULL, -- assigned when ready
  queue_position  INTEGER NOT NULL DEFAULT 1 CHECK (queue_position > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'waiting'
                  CHECK (status IN (
                    'waiting', 'ready', 'fulfilled', 'cancelled', 'expired'
                  )),
  reserved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at        TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,                      -- pickup deadline when ready
  fulfilled_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One open reservation per member per title
CREATE UNIQUE INDEX idx_reservations_open_unique
  ON reservations (book_id, member_id)
  WHERE status IN ('waiting', 'ready');

CREATE INDEX idx_reservations_book_status ON reservations (book_id, status);
CREATE INDEX idx_reservations_member ON reservations (member_id);

CREATE TRIGGER trg_reservations_updated
BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- =============================================================================
-- 8. FINES & PAYMENTS
-- =============================================================================

CREATE TABLE fines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  loan_id         UUID REFERENCES loans(id) ON DELETE SET NULL,
  reason          VARCHAR(40) NOT NULL
                  CHECK (reason IN ('overdue', 'lost', 'damaged', 'other')),
  amount          NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  amount_paid     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'partial', 'paid', 'waived')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_on          DATE,
  waived_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  waived_reason   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fines_paid_lte_amount CHECK (amount_paid <= amount)
);

CREATE INDEX idx_fines_member ON fines (member_id);
CREATE INDEX idx_fines_status ON fines (status);
CREATE INDEX idx_fines_loan ON fines (loan_id);

CREATE TRIGGER trg_fines_updated
BEFORE UPDATE ON fines
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE fine_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fine_id         UUID NOT NULL REFERENCES fines(id) ON DELETE RESTRICT,
  amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  method          VARCHAR(30) NOT NULL DEFAULT 'cash'
                  CHECK (method IN ('cash', 'card', 'upi', 'waiver', 'other')),
  received_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reference_no    VARCHAR(80),
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_fine_payments_fine ON fine_payments (fine_id);

-- =============================================================================
-- 9. AUDIT / ACTIVITY (ops & security)
-- =============================================================================

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(80) NOT NULL,               -- book.create, loan.issue, ...
  entity_type  VARCHAR(60) NOT NULL,               -- book, loan, member, ...
  entity_id    UUID,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);

-- =============================================================================
-- 10. SEED REFERENCE DATA (roles + default settings)
-- =============================================================================

INSERT INTO roles (code, name, description) VALUES
  ('admin', 'Administrator', 'Full system access'),
  ('librarian', 'Librarian', 'Manage catalog, loans, members'),
  ('member', 'Member', 'Borrow and reserve books')
ON CONFLICT (code) DO NOTHING;

INSERT INTO library_settings (
  branch_id, loan_period_days, max_active_loans, max_renewals,
  fine_per_day, max_fine, currency_code
) VALUES (
  NULL, 14, 5, 2, 5.00, 500.00, 'INR'
);
