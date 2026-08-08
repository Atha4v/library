import type { Book, Borrow, Member, User } from '../types'

type Row = Record<string, unknown>

// -----------------------------------------------------------------------------
// mapUser — schema: users JOIN roles
// -----------------------------------------------------------------------------
export function mapUser(row?: Row | null): User | null {
  if (!row) return null
  return {
    id: String(row.id),
    roleId: String(row.role_id ?? row.roleId ?? ''),
    role: (row.role_code ?? row.role) as User['role'],
    email: String(row.email),
    fullName: String(row.full_name ?? row.fullName ?? ''),
    phone: (row.phone as string | null) ?? null,
    isActive: Boolean(row.is_active ?? true),
    emailVerified: Boolean(row.email_verified ?? false),
    lastLoginAt: (row.last_login_at as Date | string | null) ?? null,
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
  }
}

// -----------------------------------------------------------------------------
// mapMember — schema: members
// -----------------------------------------------------------------------------
export function mapMember(row?: Row | null): Member | null {
  if (!row) return null
  return {
    id: String(row.id),
    userId: String(row.user_id),
    membershipNumber: String(row.membership_number),
    status: (row.status as Member['status']) ?? 'active',
    joinedOn: String(row.joined_on),
    expiresOn: (row.expires_on as string | null) ?? null,
    preferredBranchId: (row.preferred_branch_id as string | null) ?? null,
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
  }
}

// -----------------------------------------------------------------------------
// mapBook — schema: books JOIN book_copies (aggregated) JOIN authors, categories
//
// Expects row to have:
//   books columns + authors_json (json_agg) + categories_json (json_agg)
//   + total_copies, available_copies, on_loan_copies, reserved_copies
// -----------------------------------------------------------------------------
export function mapBook(row?: Row | null): Book | null {
  if (!row) return null

  // Authors may arrive as a json_agg array or a pre-parsed array
  let authors: Book['authors'] = []
  if (Array.isArray(row.authors_json)) {
    authors = (row.authors_json as Row[]).filter(Boolean).map((a) => ({
      id: String(a.id),
      fullName: String(a.full_name),
      authorOrder: Number(a.author_order ?? 1),
      contribution: String(a.contribution ?? 'author'),
    }))
  }

  let categories: Book['categories'] = []
  if (Array.isArray(row.categories_json)) {
    categories = (row.categories_json as Row[]).filter(Boolean).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      slug: String(c.slug),
    }))
  }

  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: (row.subtitle as string | null) ?? null,
    isbn13: (row.isbn_13 as string | null) ?? null,
    isbn10: (row.isbn_10 as string | null) ?? null,
    publisherId: (row.publisher_id as string | null) ?? null,
    publishedYear: row.published_year != null ? Number(row.published_year) : null,
    edition: (row.edition as string | null) ?? null,
    languageCode: String(row.language_code ?? 'en'),
    pageCount: row.page_count != null ? Number(row.page_count) : null,
    description: (row.description as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    coverColor: String(row.cover_color ?? '#1F6F78'),
    deweyCode: (row.dewey_code as string | null) ?? null,
    isActive: Boolean(row.is_active ?? true),
    authors,
    categories,
    totalCopies: Number(row.total_copies ?? 0),
    availableCopies: Number(row.available_copies ?? 0),
    onLoanCopies: Number(row.on_loan_copies ?? 0),
    reservedCopies: Number(row.reserved_copies ?? 0),
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
  }
}

// -----------------------------------------------------------------------------
// mapBorrow — schema: loans JOIN book_copies JOIN books JOIN members JOIN users
//
// Expects joined columns:
//   loans columns
//   + book_id, book_title, book_cover_color, book_isbn_13, book_isbn_10
//   + book_authors_text (comma-joined author names)
//   + member_id, membership_number, member_user_id, member_full_name, member_email
// -----------------------------------------------------------------------------
export function mapBorrow(row?: Row | null): Borrow | null {
  if (!row) return null

  const book = row.book_title
    ? {
        id: String(row.book_id),
        title: String(row.book_title),
        authors: row.book_authors_text
          ? String(row.book_authors_text).split(',').map((s) => s.trim())
          : [],
        coverColor: String(row.book_cover_color ?? '#1F6F78'),
        isbn13: (row.book_isbn_13 as string | null) ?? null,
        isbn10: (row.book_isbn_10 as string | null) ?? null,
      }
    : undefined

  const member = row.member_full_name
    ? {
        id: String(row.member_id),
        membershipNumber: String(row.membership_number ?? ''),
        userId: String(row.member_user_id ?? ''),
        fullName: String(row.member_full_name),
        email: String(row.member_email ?? ''),
      }
    : undefined

  return {
    id: String(row.id),
    copyId: String(row.copy_id),
    memberId: String(row.member_id),
    branchId: String(row.branch_id),
    issuedBy: (row.issued_by as string | null) ?? null,
    returnedTo: (row.returned_to as string | null) ?? null,
    borrowedAt: row.borrowed_at as Date | string,
    dueAt: row.due_at as Date | string,
    returnedAt: (row.returned_at as Date | string | null) ?? null,
    renewalCount: Number(row.renewal_count ?? 0),
    status: row.status as Borrow['status'],
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as Date | string | undefined,
    updatedAt: row.updated_at as Date | string | undefined,
    book,
    member,
  }
}
