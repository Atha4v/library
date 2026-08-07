function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBook(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    available: row.available,
    coverColor: row.cover_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBorrow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    returnDate: row.return_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    book: row.book_title
      ? {
          id: row.book_id,
          title: row.book_title,
          author: row.book_author,
          coverColor: row.book_cover_color,
        }
      : undefined,
    user: row.user_name
      ? {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
        }
      : undefined,
  }
}

module.exports = { mapUser, mapBook, mapBorrow }
