# Shelfmark database design (v2)

Canonical schema: [`database/schema.sql`](../database/schema.sql)

> **Note:** The running API still uses the simpler v1 tables in `backend/src/sql/`. Migrate the backend to v2 when you are ready — this doc is the target model.

---

## Why v1 was not enough

| v1 problem | v2 fix |
|------------|--------|
| `author` as a string on `books` | `authors` + `book_authors` (many-to-many) |
| `quantity` / `available` counters on books | Real `book_copies` with per-copy `status` |
| Loan tied to book title, not a copy | `loans.copy_id` → specific barcode |
| Single `role` string | `roles` table (admin / librarian / member) |
| No membership card / expiry | `members` profile on top of `users` |
| No holds | `reservations` queue |
| No fines | `fines` + `fine_payments` |
| No branches / shelves | `branches` + `book_copies.shelf_code` |
| No policy knobs | `library_settings` |
| No audit trail | `audit_logs` |

---

## Entity map

```text
roles ──< users >── members
                      │
authors >──< books >──< book_copies >── branches
              │              │
         categories          ├── loans ── members
         publishers          ├── loan_renewals
                             └── fines ── fine_payments

reservations: members + books (+ optional copy when ready)
```

### Layers

1. **Identity** — `roles`, `users`, `user_sessions`
2. **Org** — `branches`, `library_settings`
3. **Membership** — `members`
4. **Catalog** — `books`, `authors`, `publishers`, `categories`, join tables
5. **Inventory** — `book_copies` (the lendable unit)
6. **Circulation** — `loans`, `loan_renewals`, `reservations`
7. **Money** — `fines`, `fine_payments`
8. **Ops** — `audit_logs`

---

## Core tables (fields that matter)

### `books` (catalog record)
Title metadata only: ISBN-13/10, publisher, year, description, cover.  
**Does not store quantity.** Availability comes from copies / `book_availability` view.

### `book_copies` (inventory)
One row per physical item: `barcode`, `branch_id`, `shelf_code`, `status`  
(`available` | `on_loan` | `reserved` | `lost` | `damaged` | `in_repair` | `retired`).

### `loans`
Issued against a **copy** + **member**. Tracks `due_at`, `renewal_count`, `status`.  
Unique partial index: only one active/overdue loan per copy.

### `reservations`
Hold queue on a **title** (`book_id`). When a copy is free, set `copy_id` + `status = ready`.

### `members`
Library card (`membership_number`), status, address, expiry — separate from login credentials.

### `library_settings`
Loan days, max loans, max renewals, fine/day — global (`branch_id NULL`) or per branch.

---

## Availability (computed, not stored)

```sql
SELECT * FROM book_availability WHERE book_id = $1;
-- total_copies | available_copies | on_loan_copies | reserved_copies
```

Never maintain a denormalized `available` integer that can drift. Update `book_copies.status` inside the same transaction as loan issue/return.

---

## Borrow transaction (target logic)

```text
BEGIN
  lock an available copy (FOR UPDATE SKIP LOCKED)
  check member active + under max_active_loans + no unpaid fines (policy)
  INSERT loan (status=active, due_at = now + loan_period_days)
  UPDATE book_copies SET status = 'on_loan'
COMMIT
```

Return:

```text
BEGIN
  UPDATE loan → returned
  UPDATE copy → available (or reserved if next hold exists)
  optionally INSERT fine if overdue
COMMIT
```

---

## Suggested indexes already in schema

- Title full-text: `GIN (to_tsvector('english', title))`
- Copy lookup: `(book_id, status)`, unique `barcode`
- Loan queues: `(member_id, status)`, `due_at`
- Open reservation uniqueness: partial unique on `(book_id, member_id)`

---

## Apply on Postgres

```bash
psql -U postgres -c "CREATE DATABASE shelfmark;"
psql -U postgres -d shelfmark -f database/schema.sql
```

Then point `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/shelfmark
```
