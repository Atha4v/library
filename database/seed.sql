-- =============================================================================
-- Shelfmark demo seed (schema v2)
-- Run AFTER database/schema.sql
-- Passwords (bcrypt):
--   admin@shelfmark.local      / admin123
--   librarian@shelfmark.local  / librarian123
--   priya@shelfmark.local      / member123
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Branch
-- -----------------------------------------------------------------------------
INSERT INTO branches (id, code, name, address, city, phone, email)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'MAIN',
  'Main Reading Room',
  '12 Library Lane',
  'Mumbai',
  '+91-22-0000-0000',
  'main@shelfmark.local'
)
ON CONFLICT (code) DO NOTHING;

-- Per-branch settings (global defaults already inserted by schema.sql)
INSERT INTO library_settings (
  branch_id, loan_period_days, max_active_loans, max_renewals,
  fine_per_day, max_fine, currency_code
)
SELECT
  b.id, 14, 5, 2, 5.00, 500.00, 'INR'
FROM branches b
WHERE b.code = 'MAIN'
ON CONFLICT (branch_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Users (role_id + full_name — NOT name/role)
-- -----------------------------------------------------------------------------
INSERT INTO users (id, role_id, email, password_hash, full_name, phone, email_verified)
SELECT
  '22222222-2222-2222-2222-222222222221',
  r.id,
  'admin@shelfmark.local',
  '$2b$10$z0ycODMVUSG3Jl7VTy26ne8VfZ9ujoOuFP3pGPMge9zo9xv9KZH2a',
  'Admin User',
  '+91-9000000001',
  TRUE
FROM roles r WHERE r.code = 'admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, role_id, email, password_hash, full_name, phone, email_verified)
SELECT
  '22222222-2222-2222-2222-222222222222',
  r.id,
  'librarian@shelfmark.local',
  '$2b$10$3vvFb3mTiwH4B2OGylyFAe51gNVRHbcexDT3rPmoPu/n2QuA0gVxa',
  'Asha Librarian',
  '+91-9000000002',
  TRUE
FROM roles r WHERE r.code = 'librarian'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, role_id, email, password_hash, full_name, phone, email_verified)
SELECT
  '22222222-2222-2222-2222-222222222223',
  r.id,
  'priya@shelfmark.local',
  '$2b$10$I7NPRuGY0grq0CAjI1E0Q.n9yGbxNj4li.v6QjpZ4nEtAv.HpVxjq',
  'Priya Patil',
  '+91-9000000003',
  TRUE
FROM roles r WHERE r.code = 'member'
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Member profile (card) for Priya
-- -----------------------------------------------------------------------------
INSERT INTO members (
  id, user_id, membership_number, status, joined_on, expires_on,
  city, preferred_branch_id
)
SELECT
  '33333333-3333-3333-3333-333333333333',
  u.id,
  'SM-10001',
  'active',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  'Mumbai',
  b.id
FROM users u
CROSS JOIN branches b
WHERE u.email = 'priya@shelfmark.local'
  AND b.code = 'MAIN'
ON CONFLICT (membership_number) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Catalog: authors, publishers, categories
-- -----------------------------------------------------------------------------
INSERT INTO authors (id, full_name, sort_name) VALUES
  ('44444444-4444-4444-4444-444444444401', 'Alex Michaelides', 'Michaelides, Alex'),
  ('44444444-4444-4444-4444-444444444402', 'Andy Weir', 'Weir, Andy'),
  ('44444444-4444-4444-4444-444444444403', 'Kazuo Ishiguro', 'Ishiguro, Kazuo'),
  ('44444444-4444-4444-4444-444444444404', 'James Clear', 'Clear, James'),
  ('44444444-4444-4444-4444-444444444405', 'Susanna Clarke', 'Clarke, Susanna'),
  ('44444444-4444-4444-4444-444444444406', 'Tara Westover', 'Westover, Tara')
ON CONFLICT DO NOTHING;

INSERT INTO publishers (id, name, country) VALUES
  ('55555555-5555-5555-5555-555555555501', 'Celadon Books', 'US'),
  ('55555555-5555-5555-5555-555555555502', 'Ballantine Books', 'US'),
  ('55555555-5555-5555-5555-555555555503', 'Knopf', 'US'),
  ('55555555-5555-5555-5555-555555555504', 'Avery', 'US'),
  ('55555555-5555-5555-5555-555555555505', 'Bloomsbury', 'UK')
ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (id, name, slug) VALUES
  ('66666666-6666-6666-6666-666666666601', 'Thriller', 'thriller'),
  ('66666666-6666-6666-6666-666666666602', 'Sci-Fi', 'sci-fi'),
  ('66666666-6666-6666-6666-666666666603', 'Literary', 'literary'),
  ('66666666-6666-6666-6666-666666666604', 'Nonfiction', 'nonfiction'),
  ('66666666-6666-6666-6666-666666666605', 'Fantasy', 'fantasy'),
  ('66666666-6666-6666-6666-666666666606', 'Memoir', 'memoir')
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Books (catalog records — no quantity/author columns)
-- -----------------------------------------------------------------------------
INSERT INTO books (
  id, title, isbn_13, publisher_id, published_year, description, cover_color
) VALUES
  (
    '77777777-7777-7777-7777-777777777701',
    'The Silent Patient',
    '9781250301697',
    '55555555-5555-5555-5555-555555555501',
    2019,
    'A psychotherapist becomes obsessed with a famous painter who refuses to speak.',
    '#1F6F78'
  ),
  (
    '77777777-7777-7777-7777-777777777702',
    'Project Hail Mary',
    '9780593135204',
    '55555555-5555-5555-5555-555555555502',
    2021,
    'A lone astronaut must save Earth from extinction.',
    '#C46B3A'
  ),
  (
    '77777777-7777-7777-7777-777777777703',
    'Klara and the Sun',
    '9780593318171',
    '55555555-5555-5555-5555-555555555503',
    2021,
    'An artificial friend observes love and loyalty.',
    '#2E4057'
  ),
  (
    '77777777-7777-7777-7777-777777777704',
    'Atomic Habits',
    '9780735211292',
    '55555555-5555-5555-5555-555555555504',
    2018,
    'Tiny changes that compound into remarkable results.',
    '#E09F3E'
  ),
  (
    '77777777-7777-7777-7777-777777777705',
    'Piranesi',
    '9781635577808',
    '55555555-5555-5555-5555-555555555505',
    2020,
    'A man maps a house of endless halls and tides.',
    '#4A6C6F'
  ),
  (
    '77777777-7777-7777-7777-777777777706',
    'Educated',
    '9780399590504',
    '55555555-5555-5555-5555-555555555503',
    2018,
    'A memoir of education as a path to a new self.',
    '#8B3A3A'
  )
ON CONFLICT (isbn_13) DO NOTHING;

INSERT INTO book_authors (book_id, author_id, author_order) VALUES
  ('77777777-7777-7777-7777-777777777701', '44444444-4444-4444-4444-444444444401', 1),
  ('77777777-7777-7777-7777-777777777702', '44444444-4444-4444-4444-444444444402', 1),
  ('77777777-7777-7777-7777-777777777703', '44444444-4444-4444-4444-444444444403', 1),
  ('77777777-7777-7777-7777-777777777704', '44444444-4444-4444-4444-444444444404', 1),
  ('77777777-7777-7777-7777-777777777705', '44444444-4444-4444-4444-444444444405', 1),
  ('77777777-7777-7777-7777-777777777706', '44444444-4444-4444-4444-444444444406', 1)
ON CONFLICT DO NOTHING;

INSERT INTO book_categories (book_id, category_id) VALUES
  ('77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601'),
  ('77777777-7777-7777-7777-777777777702', '66666666-6666-6666-6666-666666666602'),
  ('77777777-7777-7777-7777-777777777703', '66666666-6666-6666-6666-666666666603'),
  ('77777777-7777-7777-7777-777777777704', '66666666-6666-6666-6666-666666666604'),
  ('77777777-7777-7777-7777-777777777705', '66666666-6666-6666-6666-666666666605'),
  ('77777777-7777-7777-7777-777777777706', '66666666-6666-6666-6666-666666666606')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Physical copies (inventory) — this replaces quantity/available
-- -----------------------------------------------------------------------------
INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888801',
  '77777777-7777-7777-7777-777777777701',
  b.id, 'BC-SP-0001', 'T-A1', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888802',
  '77777777-7777-7777-7777-777777777701',
  b.id, 'BC-SP-0002', 'T-A1', 'on_loan'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888803',
  '77777777-7777-7777-7777-777777777702',
  b.id, 'BC-PHM-0001', 'S-B2', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888804',
  '77777777-7777-7777-7777-777777777703',
  b.id, 'BC-KS-0001', 'L-C1', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888805',
  '77777777-7777-7777-7777-777777777704',
  b.id, 'BC-AH-0001', 'N-D1', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888806',
  '77777777-7777-7777-7777-777777777705',
  b.id, 'BC-PI-0001', 'F-E1', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888807',
  '77777777-7777-7777-7777-777777777705',
  b.id, 'BC-PI-0002', 'F-E1', 'reserved'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO book_copies (id, book_id, branch_id, barcode, shelf_code, status)
SELECT
  '88888888-8888-8888-8888-888888888808',
  '77777777-7777-7777-7777-777777777706',
  b.id, 'BC-ED-0001', 'M-F1', 'available'
FROM branches b WHERE b.code = 'MAIN'
ON CONFLICT (barcode) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Sample active loan (Priya has Silent Patient copy #2)
-- -----------------------------------------------------------------------------
INSERT INTO loans (
  id, copy_id, member_id, branch_id, issued_by,
  borrowed_at, due_at, status
)
SELECT
  '99999999-9999-9999-9999-999999999901',
  '88888888-8888-8888-8888-888888888802',
  m.id,
  b.id,
  u_admin.id,
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '11 days',
  'active'
FROM members m
JOIN branches b ON b.code = 'MAIN'
JOIN users u_admin ON u_admin.email = 'admin@shelfmark.local'
WHERE m.membership_number = 'SM-10001'
ON CONFLICT DO NOTHING;
