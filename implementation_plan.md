# Data Flow Alignment — Schema → Backend → Frontend

## Background

The project has a rich, normalized PostgreSQL schema (`schema.sql`) but the backend and frontend are built against a **completely different, simplified flat schema** that was never reconciled. The result is that SQL queries reference tables/columns that don't exist in `schema.sql`.

---

## The Core Mismatches

### 1. `users` table — column name mismatch

| Schema | Backend currently uses |
|--------|----------------------|
| `full_name` | `name` |
| `role_id` (FK → `roles`) | `role` (plain string) |
| `is_active`, `email_verified`, `deleted_at` | not used |

**Auth service** inserts `name` but schema expects `full_name`. Also role is a FK, not a string.

---

### 2. `books` table — completely wrong flat schema

The backend queries a **flat** `books` table with columns:
```
id, title, author, isbn, category, description, quantity, available, cover_color
```

But the real schema uses:
- `books` — catalog (title, subtitle, isbn_13, isbn_10, publisher_id, cover_url, cover_color, …)
- `book_authors` — join table (book_id, author_id)
- `book_copies` — physical inventory (status: available/on_loan/…)
- `authors` — first-class entity
- `categories` + `book_categories` — join table
- **No `quantity` or `available` columns** — availability is derived from `book_copies`

---

### 3. Loans — wrong table name and columns

| Schema | Backend currently uses |
|--------|----------------------|
| `loans` | `borrowed_books` |
| `copy_id` (FK → `book_copies`) | `book_id` (FK → `books`) |
| `member_id` (FK → `members`) | `user_id` (FK → `users`) |
| `borrowed_at` | `borrow_date` |
| `due_at` | `due_date` |
| `returned_at` | `return_date` |
| status: `active`/`returned`/`overdue`/`lost` | status: `borrowed`/`returned`/`overdue` |

---

### 4. Missing `members` layer

Schema separates `users` (auth) from `members` (library profile). Backend skips `members` entirely, using `user_id` directly on loans — which breaks FK constraints.

---

### 5. Frontend types are misaligned

- `User.id` typed as `number` (should be `string` UUID)
- `Loan.id` typed as `number` (should be `string` UUID)
- `Book.id` typed as `number` (should be `string` UUID)
- `UserRole` missing `'librarian'`
- `Loan` uses `borrowDate`/`dueDate`/`returnDate` (camelCase from backend) but schema fields are `borrowed_at`/`due_at`/`returned_at`
- No `Book.isbn_13`/`isbn_10`, no `Book.coverUrl`, no multi-author support
- `LoanStatus` missing `'lost'`

---

## Strategy

> **Keep the working application running** while aligning naming and data flow with the schema. The goal is correctness of naming, types, and SQL — **not** a full rewrite to use every schema feature (e.g. branches, reservations, fines remain out of scope for now).

The approach is:
1. Fix backend SQL to match real schema tables/columns
2. Add a minimal `members` record auto-created on user registration
3. Update mappers + types (backend + frontend) to match schema naming
4. Update frontend `api/client.ts` and types to consume corrected shape

---

## Proposed Changes

---

### Backend — Types

#### [MODIFY] [index.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/types/index.ts)
- `UserRole`: add `'librarian'`
- `User`: rename `name` → `fullName`, add `isActive`, `roleId`
- `Book`: remove `author`/`isbn`/`category`/`quantity`/`available`; add `isbn13`, `isbn10`, `coverUrl`, `availableCopies`, `totalCopies`, `authors[]`, `categories[]`
- `Borrow`: rename `userId` → `memberId`, `borrowDate` → `borrowedAt`, `dueDate` → `dueAt`, `returnDate` → `returnedAt`; status `'borrowed'` → `'active'`
- Add `Member` interface, `Author` interface, `Category` interface

---

### Backend — Mappers

#### [MODIFY] [mappers.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/utils/mappers.ts)
- `mapUser`: `row.full_name` → `fullName`, `row.is_active` → `isActive`
- `mapBook`: remove flat `author`/`isbn`/`category`/`quantity`/`available`; add `isbn13`, `isbn10`, `coverUrl`, `availableCopies`
- `mapBorrow`: `user_id` → `member_id`, `borrow_date` → `borrowed_at`, `due_date` → `due_at`, `return_date` → `returned_at`; status `'borrowed'`→`'active'`
- Add `mapMember`, `mapAuthor`

---

### Backend — Auth Service

#### [MODIFY] [auth.service.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/services/auth.service.ts)
- Register: look up `member` role_id from `roles` table; INSERT into `users` with `full_name`, `role_id`; auto-create `members` row
- Login: SELECT with `full_name`, join `roles` for role code
- `findUserById`: same join

---

### Backend — Books Service

#### [MODIFY] [books.service.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/services/books.service.ts)
- `listBooks`: query `books` + join `book_authors`/`authors` + join `book_copies` for availability count + join `book_categories`/`categories`; filter on `title`/`isbn_13`/`isbn_10`/author name; category filter via `categories.slug`
- `getBookById`: same joins
- `createBook`: INSERT into `books` (isbn_13/isbn_10, cover_color); INSERT author if needed + `book_authors`; INSERT category if needed + `book_categories`; INSERT one `book_copies` row
- `updateBook`: UPDATE `books`; handle author/category updates
- `deleteBook`: check `loans` table (not `borrowed_books`)
- Remove `updateQuantity` (availability is derived, not stored)

---

### Backend — Borrows Service

#### [MODIFY] [borrows.service.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/services/borrows.service.ts)
- All queries: `borrowed_books` → `loans`; `book_id` → `copy_id` (pick first available copy); `user_id` → `member_id`; `borrow_date` → `borrowed_at`; `due_date` → `due_at`; `return_date` → `returned_at`; status `'borrowed'` → `'active'`
- `borrowBook`: look up `member_id` from `members` WHERE `user_id = $1`; SELECT available `book_copies`; set `copy.status = 'on_loan'`; INSERT into `loans`
- `returnLoan`: UPDATE `loans` set `returned_at`, status `'returned'`; UPDATE `book_copies` status → `'available'`
- `markOverdue`: UPDATE `loans` (not `borrowed_books`)
- JOIN: `loans` → `book_copies` → `books` → `book_authors`/`authors`; `loans` → `members` → `users`

---

### Backend — Stats Service

#### [MODIFY] [stats.service.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/services/stats.service.ts)
- `borrowed_books` → `loans`; `user_id` → `member_id`; status `'borrowed'` → `'active'`
- Members count: `SELECT COUNT(*) FROM members` (not `users WHERE role='member'`)

---

### Backend — Users Service

#### [MODIFY] [users.service.ts](file:///home/heraaamb/Heramb/Projects/library/backend/src/services/users.service.ts)
- SELECT `full_name` instead of `name`; join `roles` for role code
- `updateUser`: update `full_name` not `name`

---

### Frontend — Types

#### [MODIFY] [index.ts](file:///home/heraaamb/Heramb/Projects/library/frontend/src/types/index.ts)
- `User.id`: `number` → `string`
- `User`: `name` → `fullName`; add `isActive?: boolean`
- `UserRole`: add `'librarian'`
- `Book.id`: `number` → `string`; `author` → `authors: string[]`; `isbn` → `isbn13?: string; isbn10?: string`; `category` → `categories: string[]`; remove `quantity`/`available`; add `availableCopies: number; totalCopies: number; coverUrl?: string`
- `Loan.id`: `number` → `string`; `borrowDate` → `borrowedAt`; `dueDate` → `dueAt`; `returnDate` → `returnedAt`; status add `'active'`/`'lost'`
- `LoanStatus`: add `'active'` and `'lost'`; `'borrowed'` → `'active'`
- `BookCreatePayload`: `author` → `authors: string[]`; `isbn` → `isbn13`; `category` → `categories?: string[]`
- `RegisterPayload`: `name` → `fullName`

---

### Frontend — API Client

#### [MODIFY] [client.ts](file:///home/heraaamb/Heramb/Projects/library/frontend/src/api/client.ts)
- `register` payload: send `fullName` not `name`
- `borrowsApi.create`: send `bookId` (string UUID)
- Update `BookListParams`, `BookCreatePayload` to new field names

---

## Open Questions

> [!IMPORTANT]
> **Role model**: The schema has 3 roles (`admin`, `librarian`, `member`). The backend currently only uses `admin`/`member`. Should `librarian` be surfaced in the UI or kept as admin-equivalent for now?

> [!IMPORTANT]
> **Book copies**: The schema tracks individual physical copies. When creating a book, should we create a fixed number of copies (e.g. `quantity` field maps to N copies), or just one copy? This affects how `BookCreatePayload` is structured.

> [!IMPORTANT]
> **Author / category creation**: When adding a book via the form, should authors and categories be free-text (created on-the-fly) or selected from existing records? For now the plan assumes free-text with upsert.

---

## Verification Plan

### After changes
- Start backend (`npm run dev`) — no TypeScript errors
- Register a new user → check `users` + `members` rows created in DB
- Login → JWT contains correct `role` code
- List books → response has `authors[]`, `categories[]`, `availableCopies`
- Borrow a book → `loans` row with correct `copy_id`, `member_id`, `borrowed_at`, `due_at`
- Return a book → `loans.returned_at` set, `book_copies.status = 'available'`
- Frontend renders correctly with new field names (no undefined crashes)
