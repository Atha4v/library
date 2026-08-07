# Shelfmark API endpoints

Base URL: `http://localhost:5000/api`

Auth: `Authorization: Bearer <jwt>` unless noted public.

---

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Create member account |
| POST | `/auth/login` | Public | Login, returns JWT + user |
| GET | `/auth/me` | User | Current session user |

### POST `/auth/register`
```json
{ "name": "Priya Sharma", "email": "priya@mail.com", "password": "secret123" }
```

### POST `/auth/login`
```json
{ "email": "priya@mail.com", "password": "secret123" }
```

---

## Users (admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | Admin | List users |
| GET | `/users/:id` | Admin | Get user by id |
| PATCH | `/users/:id` | Admin | Update name/role |
| DELETE | `/users/:id` | Admin | Delete user |

---

## Books

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/books` | Public | List/search books (`?q=&category=&page=&limit=`) |
| GET | `/books/:id` | Public | Book detail |
| POST | `/books` | Admin | Create book |
| PUT | `/books/:id` | Admin | Update book |
| PATCH | `/books/:id/quantity` | Admin | Adjust total/available copies |
| DELETE | `/books/:id` | Admin | Remove book (block if active loans) |

### POST `/books`
```json
{
  "title": "Piranesi",
  "author": "Susanna Clarke",
  "isbn": "9781635577808",
  "category": "Fantasy",
  "description": "...",
  "quantity": 2
}
```

---

## Borrows / loans

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/borrows` | Member/Admin | Borrow a book |
| GET | `/borrows` | Admin | All loans (`?status=borrowed`) |
| GET | `/borrows/me` | Member | Current user's loans |
| GET | `/borrows/:id` | Owner/Admin | Loan detail |
| POST | `/borrows/:id/return` | Owner/Admin | Return a book |
| POST | `/borrows/:id/renew` | Owner/Admin | Extend due date (+14 days, optional) |
| GET | `/borrows/overdue` | Admin | Overdue loans report |

### POST `/borrows`
```json
{ "bookId": "uuid-here" }
```

Server sets `borrow_date`, `due_date` (+14 days), decrements `books.available`.

### POST `/borrows/:id/return`
Sets `return_date`, `status=returned`, increments `books.available`.

---

## Dashboard / stats

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats/overview` | Admin | totals: books, members, active loans, overdue |
| GET | `/stats/me` | Member | personal loan counts |

---

## Suggested response shape

```json
{
  "data": {},
  "message": "Book borrowed successfully",
  "error": null
}
```

Error example:
```json
{
  "data": null,
  "message": "No copies available",
  "error": "OUT_OF_STOCK"
}
```
