# Shelfmark web app workflow

## Roles

- **Guest** — browse catalog, view book details, register/login
- **Member** — borrow/return, view own loans
- **Admin** — manage books, users, all loans, stats

---

## High-level flow

```text
Landing
  → Browse Catalog
      → Book Detail
          → Sign in (if needed)
              → Borrow
                  → My Loans dashboard
                      → Return

Admin sign in
  → Admin desk
      → Add / edit books
      → View active & overdue loans
      → Manage members
```

---

## Member journey

1. Open **Home** — brand + catalog CTA.
2. Open **Catalog** — search/filter titles.
3. Open **Book detail** — availability, description.
4. Click **Borrow**:
   - If logged out → **Login/Register**
   - If available → create borrow record, decrement stock
   - If out of stock → show wait/unavailable state
5. Visit **My loans**:
   - See active loans + due dates
   - Return a book → stock increments
6. Optional: renew before due date.

---

## Admin journey

1. Sign in with admin account.
2. Open **Admin**:
   - Add new titles (ISBN unique)
   - Adjust quantity
   - Monitor active/overdue loans
3. Optional: promote/demote user roles.

---

## Borrow transaction (backend rule)

```text
BEGIN
  SELECT available FROM books WHERE id = :bookId FOR UPDATE;
  IF available < 1 → reject
  INSERT borrowed_books (...)
  UPDATE books SET available = available - 1
COMMIT
```

Return:

```text
BEGIN
  UPDATE borrowed_books SET status='returned', return_date=CURRENT_DATE
  UPDATE books SET available = available + 1
COMMIT
```

---

## Frontend ↔ API mapping (for later)

| UI action | API |
|-----------|-----|
| Register | `POST /api/auth/register` |
| Login | `POST /api/auth/login` |
| Catalog search | `GET /api/books?q=&category=` |
| Book page | `GET /api/books/:id` |
| Borrow button | `POST /api/borrows` |
| My loans | `GET /api/borrows/me` |
| Return | `POST /api/borrows/:id/return` |
| Admin add book | `POST /api/books` |
| Admin inventory | `GET /api/books` + `GET /api/stats/overview` |

---

## Current frontend status

- React (Vite) UI with mock data / local auth
- Ready to replace mocks with fetch/axios calls to the API above
