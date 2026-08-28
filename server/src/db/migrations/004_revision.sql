-- Spaced-repetition scheduling for questions a student got wrong.
--
-- Correctness is already recorded in practice_events and attempt_answers, but
-- nothing ever brought a missed question back. A card here is created the
-- first time a student gets a question wrong and retired once they have
-- answered it correctly enough times, spaced far enough apart.
CREATE TABLE revision_cards (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id      INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  -- 0 = newly missed. Each correct recall moves up a box, a miss resets to 0.
  box              INTEGER NOT NULL DEFAULT 0,
  due_on           TEXT NOT NULL,
  times_seen       INTEGER NOT NULL DEFAULT 0,
  times_correct    INTEGER NOT NULL DEFAULT 0,
  last_result      TEXT CHECK (last_result IN ('correct', 'incorrect')),
  last_reviewed_at TEXT,
  -- Set when the card graduates, so history is kept rather than deleted.
  retired_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, question_id)
);

CREATE INDEX idx_revision_due ON revision_cards (user_id, retired_at, due_on);
