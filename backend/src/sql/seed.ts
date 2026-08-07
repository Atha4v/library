import bcrypt from 'bcryptjs'
import { newId } from '../utils/id'
import type { DbDriver } from '../types'

export async function seedIfEmpty(db: DbDriver): Promise<void> {
  const count = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM users',
  )
  if ((count.rows[0]?.count ?? 0) > 0) return

  const adminHash = await bcrypt.hash('admin123', 10)
  const memberHash = await bcrypt.hash('member123', 10)

  await db.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES
      ($1, $2, $3, $4, 'admin'),
      ($5, $6, $7, $8, 'member')`,
    [
      newId(),
      'Admin User',
      'admin@shelfmark.local',
      adminHash,
      newId(),
      'Priya Sharma',
      'priya@shelfmark.local',
      memberHash,
    ],
  )

  const books: Array<[string, string, string, string, string, number, number, string]> = [
    ['The Silent Patient', 'Alex Michaelides', '9781250301697', 'Thriller', 'A psychotherapist becomes obsessed with a famous painter who refuses to speak.', 4, 2, '#1F6F78'],
    ['Project Hail Mary', 'Andy Weir', '9780593135204', 'Sci-Fi', 'A lone astronaut must save Earth from extinction.', 6, 5, '#C46B3A'],
    ['Klara and the Sun', 'Kazuo Ishiguro', '9780593318171', 'Literary', 'An artificial friend observes love and loyalty.', 3, 1, '#2E4057'],
    ['Atomic Habits', 'James Clear', '9780735211292', 'Nonfiction', 'Tiny changes that compound into remarkable results.', 8, 6, '#E09F3E'],
    ['Piranesi', 'Susanna Clarke', '9781635577808', 'Fantasy', 'A man maps a house of endless halls and tides.', 2, 0, '#4A6C6F'],
    ['Educated', 'Tara Westover', '9780399590504', 'Memoir', 'A memoir of education as a path to a new self.', 5, 3, '#8B3A3A'],
  ]

  for (const book of books) {
    await db.query(
      `INSERT INTO books
        (id, title, author, isbn, category, description, quantity, available, cover_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), ...book],
    )
  }
}
