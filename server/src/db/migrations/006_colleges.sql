-- Colleges as an entity rather than a free-text field on each user.
--
-- `users.college` was a string every student typed themselves, so "NIT
-- Trichy", "nit trichy" and "N.I.T. Trichy" were three different colleges and
-- no cohort view was possible. A placement cell is usually the buyer of a
-- product like this; it needs to see its own students as a group.
CREATE TABLE colleges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  city        TEXT,
  state       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN college_id INTEGER REFERENCES colleges (id) ON DELETE SET NULL;

CREATE INDEX idx_users_college ON users (college_id, role);

-- Backfill from the free text already on hand. Names are normalised by
-- lowercasing and collapsing punctuation so the obvious duplicates merge; the
-- original string stays on users.college as what the student actually typed.
INSERT INTO colleges (slug, name)
SELECT DISTINCT
  lower(replace(replace(replace(replace(trim(college), '.', ''), ' ', '-'), '(', ''), ')', '')),
  trim(college)
FROM users
WHERE college IS NOT NULL AND trim(college) <> '';

UPDATE users
   SET college_id = (
     SELECT c.id FROM colleges c
      WHERE c.slug = lower(replace(replace(replace(replace(trim(users.college), '.', ''), ' ', '-'), '(', ''), ')', ''))
   )
 WHERE college IS NOT NULL AND trim(college) <> '';
