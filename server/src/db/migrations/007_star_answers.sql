-- Structured behavioural answers, written and self-reviewed by the student.
--
-- HR, GD and managerial rounds are currently practised as multiple choice,
-- which is a weak proxy: nobody gets better at "tell me about a time you
-- failed" by picking option C. This gives students somewhere to draft real
-- answers in STAR form against prompts, and a rubric to review them against.
--
-- What this deliberately does not do is score the writing. Evaluating free
-- text well is a language-model problem; a keyword heuristic pretending to be
-- feedback would be worse than no feedback, because a student would trust it.
CREATE TABLE interview_prompts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  prompt        TEXT NOT NULL,
  category      TEXT NOT NULL
                  CHECK (category IN ('behavioural', 'situational', 'motivation', 'teamwork', 'failure', 'leadership')),
  guidance      TEXT,
  -- NULL = useful for any company; otherwise a company that leans on it.
  company_id    INTEGER REFERENCES companies (id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE star_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  prompt_id     INTEGER NOT NULL REFERENCES interview_prompts (id) ON DELETE CASCADE,
  situation     TEXT NOT NULL DEFAULT '',
  task          TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL DEFAULT '',
  result        TEXT NOT NULL DEFAULT '',
  -- The student's own rubric scores, 0-3 each. JSON so the rubric can grow.
  self_review   TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, prompt_id)
);

CREATE INDEX idx_star_answers_user ON star_answers (user_id, updated_at);
