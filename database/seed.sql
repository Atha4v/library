-- Demo seed data for Shelfmark
-- Password hashes are bcrypt for: admin123 / member123
-- Replace hashes in production with real bcrypt output from your backend.

INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User', 'admin@shelfmark.local', '$2b$10$REPLACE_WITH_BCRYPT_admin123', 'admin'),
  ('Priya Sharma', 'priya@shelfmark.local', '$2b$10$REPLACE_WITH_BCRYPT_member123', 'member')
ON CONFLICT (email) DO NOTHING;

INSERT INTO books (title, author, isbn, category, description, quantity, available, cover_color) VALUES
  ('The Silent Patient', 'Alex Michaelides', '9781250301697', 'Thriller',
   'A psychotherapist becomes obsessed with a famous painter who refuses to speak.', 4, 2, '#1F6F78'),
  ('Project Hail Mary', 'Andy Weir', '9780593135204', 'Sci-Fi',
   'A lone astronaut must save Earth from extinction.', 6, 5, '#C46B3A'),
  ('Klara and the Sun', 'Kazuo Ishiguro', '9780593318171', 'Literary',
   'An artificial friend observes love and loyalty.', 3, 1, '#2E4057'),
  ('Atomic Habits', 'James Clear', '9780735211292', 'Nonfiction',
   'Tiny changes that compound into remarkable results.', 8, 6, '#E09F3E'),
  ('Piranesi', 'Susanna Clarke', '9781635577808', 'Fantasy',
   'A man maps a house of endless halls and tides.', 2, 0, '#4A6C6F'),
  ('Educated', 'Tara Westover', '9780399590504', 'Memoir',
   'A memoir of education as a path to a new self.', 5, 3, '#8B3A3A')
ON CONFLICT (isbn) DO NOTHING;
