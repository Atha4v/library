# PostgreSQL setup (schema v2)

## 1. Create + load

```bash
psql -U postgres
```

```sql
CREATE DATABASE shelfmark;
\c shelfmark
\i database/schema.sql
\i database/seed.sql
```

From project root (Windows path example):

```bash
psql -U postgres -d shelfmark -f database/schema.sql
psql -U postgres -d shelfmark -f database/seed.sql
```

## 2. Connection string

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/shelfmark
```

## 3. Seed logins

| Role       | Email                     | Password      |
|------------|---------------------------|---------------|
| admin      | admin@shelfmark.local     | admin123      |
| librarian  | librarian@shelfmark.local | librarian123  |
| member     | priya@shelfmark.local     | member123     |

## 4. Important column names (v2)

`users` uses:
- `full_name` (not `name`)
- `role_id` → `roles.id` (not `role` text)

`books` has no `author`, `quantity`, or `available`.
Use `book_authors` + `book_copies` / view `book_availability`.

## 5. Quick checks

```sql
SELECT u.full_name, r.code AS role, u.email
FROM users u
JOIN roles r ON r.id = u.role_id;

SELECT b.title, a.full_name AS author, ba.available_copies
FROM books b
JOIN book_authors x ON x.book_id = b.id
JOIN authors a ON a.id = x.author_id
JOIN book_availability ba ON ba.book_id = b.id
ORDER BY b.title;

SELECT m.membership_number, u.full_name, bk.title, l.status, l.due_at
FROM loans l
JOIN members m ON m.id = l.member_id
JOIN users u ON u.id = m.user_id
JOIN book_copies c ON c.id = l.copy_id
JOIN books bk ON bk.id = c.book_id;
```
