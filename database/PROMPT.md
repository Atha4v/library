# PostgreSQL setup prompts

Use these prompts/commands to create and wire the database.

## 1. Create database (psql)

```bash
psql -U postgres
```

```sql
CREATE DATABASE shelfmark;
\c shelfmark
\i database/schema.sql
\i database/seed.sql
```

## 2. Connection string

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/shelfmark
```

## 3. Prompt for an AI / teammate implementing the backend

```
Build a Node.js Express API for Shelfmark library management using PostgreSQL.

Use the schema in database/schema.sql with tables:
- users (id uuid, name, email unique, password_hash, role enum admin|member)
- books (id uuid, title, author, isbn unique, category, description, quantity, available)
- borrowed_books (id uuid, user_id, book_id, borrow_date, due_date, return_date, status)

Rules:
1. Hash passwords with bcrypt.
2. JWT auth: members access own loans; admins manage books/users/all loans.
3. Borrowing must decrement books.available in a transaction and reject if available = 0.
4. Returning must increment books.available and set status=returned + return_date.
5. Due date default = borrow_date + 14 days.
6. Mark status overdue when due_date < today and still borrowed (cron or on read).
7. Follow the endpoint list in docs/API.md.
8. Validate input; return consistent JSON { data, error, message }.
```

## 4. Useful verification queries

```sql
-- Inventory health
SELECT title, quantity, available FROM books ORDER BY title;

-- Active loans
SELECT u.name, b.title, bb.borrow_date, bb.due_date, bb.status
FROM borrowed_books bb
JOIN users u ON u.id = bb.user_id
JOIN books b ON b.id = bb.book_id
WHERE bb.status = 'borrowed';

-- Overdue
SELECT u.email, b.title, bb.due_date
FROM borrowed_books bb
JOIN users u ON u.id = bb.user_id
JOIN books b ON b.id = bb.book_id
WHERE bb.status = 'borrowed' AND bb.due_date < CURRENT_DATE;
```
