-- PlacePrep core schema.
--
-- Content hierarchy:  company -> round -> section -> topic -> subtopic -> question
-- Questions live in one central bank and are linked to companies/rounds/sections
-- through `question_tags`, so the same question is reusable everywhere.

------------------------------------------------------------------------------
-- Identity & access
------------------------------------------------------------------------------

CREATE TABLE users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'student'
                      CHECK (role IN ('student', 'faculty', 'admin', 'super_admin')),
  college           TEXT,
  branch            TEXT,
  graduation_year   INTEGER,
  cgpa              REAL,
  phone             TEXT,
  avatar_seed       TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  last_login_at     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_role ON users (role);

------------------------------------------------------------------------------
-- Companies
------------------------------------------------------------------------------

CREATE TABLE companies (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  logo_text           TEXT,             -- monogram fallback when no image is set
  logo_url            TEXT,
  brand_color         TEXT,
  company_type        TEXT NOT NULL CHECK (company_type IN ('service', 'product')),
  industry            TEXT,
  description         TEXT,
  difficulty          TEXT NOT NULL DEFAULT 'moderate'
                        CHECK (difficulty IN ('easy', 'moderate', 'hard', 'very_hard')),
  hiring_frequency    TEXT,             -- e.g. "Twice a year (on-campus)"
  eligible_branches   TEXT NOT NULL DEFAULT '[]',   -- JSON array
  eligible_years      TEXT NOT NULL DEFAULT '[]',   -- JSON array of graduation years
  min_cgpa            REAL,
  ctc_min_lpa         REAL,
  ctc_max_lpa         REAL,
  roles_offered       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  locations           TEXT NOT NULL DEFAULT '[]',   -- JSON array
  expected_prep_weeks INTEGER,
  is_published        INTEGER NOT NULL DEFAULT 1,
  sort_order          INTEGER NOT NULL DEFAULT 100,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_companies_type ON companies (company_type);
CREATE INDEX idx_companies_published ON companies (is_published);

-- Free-form company intelligence. Every row carries its own provenance so the UI
-- can separate officially verifiable facts from community-reported experience.
CREATE TABLE company_insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN (
                  'hiring_process', 'coding_pattern', 'technical_pattern',
                  'hr_pattern', 'frequently_tested', 'question_types',
                  'eligibility', 'preparation_advice', 'general')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  provenance    TEXT NOT NULL DEFAULT 'community_reported'
                  CHECK (provenance IN ('verified', 'community_reported', 'historical')),
  source_label  TEXT,          -- e.g. "Company careers page", "Student reports 2024"
  source_url    TEXT,
  as_of         TEXT,          -- period the information refers to
  sort_order    INTEGER NOT NULL DEFAULT 100,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_insights_company ON company_insights (company_id, category);

------------------------------------------------------------------------------
-- Hiring rounds & sections
------------------------------------------------------------------------------

CREATE TABLE rounds (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id          INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  round_type          TEXT NOT NULL CHECK (round_type IN (
                        'aptitude', 'coding', 'technical_mcq', 'technical_interview',
                        'system_design', 'group_discussion', 'hr_interview',
                        'managerial', 'psychometric', 'other')),
  sequence            INTEGER NOT NULL,
  description         TEXT,
  duration_minutes    INTEGER,
  difficulty          TEXT NOT NULL DEFAULT 'moderate'
                        CHECK (difficulty IN ('easy', 'moderate', 'hard', 'very_hard')),
  elimination         INTEGER NOT NULL DEFAULT 1,   -- knock-out round?
  estimated_prep_hours INTEGER NOT NULL DEFAULT 10,
  negative_marking    REAL NOT NULL DEFAULT 0,      -- marks deducted per wrong answer
  section_lock        INTEGER NOT NULL DEFAULT 0,   -- 1 = cannot revisit a submitted section
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, slug)
);

CREATE INDEX idx_rounds_company ON rounds (company_id, sequence);

CREATE TABLE sections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id          INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  sequence          INTEGER NOT NULL,
  question_count    INTEGER NOT NULL DEFAULT 10,
  duration_minutes  INTEGER,
  marks_per_question REAL NOT NULL DEFAULT 1,
  negative_marks    REAL NOT NULL DEFAULT 0,
  question_kind     TEXT NOT NULL DEFAULT 'mcq'
                      CHECK (question_kind IN ('mcq', 'multi_select', 'coding', 'subjective', 'mixed')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (round_id, slug)
);

CREATE INDEX idx_sections_round ON sections (round_id, sequence);

------------------------------------------------------------------------------
-- Topic taxonomy (self-referencing: topic -> subtopic)
------------------------------------------------------------------------------

CREATE TABLE topics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  parent_id     INTEGER REFERENCES topics (id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN (
                  'aptitude', 'reasoning', 'verbal', 'dsa', 'cs_fundamentals',
                  'programming', 'database', 'system_design', 'behavioural', 'other')),
  description   TEXT,
  est_hours     REAL NOT NULL DEFAULT 2,
  sort_order    INTEGER NOT NULL DEFAULT 100,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_topics_parent ON topics (parent_id);
CREATE INDEX idx_topics_category ON topics (category);

-- Which topics a given round expects, i.e. the roadmap content for that round.
CREATE TABLE round_topics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id      INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  topic_id      INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  section_id    INTEGER REFERENCES sections (id) ON DELETE SET NULL,
  weight        REAL NOT NULL DEFAULT 1,     -- relative importance for readiness maths
  importance    TEXT NOT NULL DEFAULT 'core'
                  CHECK (importance IN ('core', 'recommended', 'optional')),
  sequence      INTEGER NOT NULL DEFAULT 100,
  notes         TEXT,
  UNIQUE (round_id, topic_id)
);

CREATE INDEX idx_round_topics_round ON round_topics (round_id, sequence);
CREATE INDEX idx_round_topics_topic ON round_topics (topic_id);

CREATE TABLE resources (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id      INTEGER REFERENCES topics (id) ON DELETE CASCADE,
  round_id      INTEGER REFERENCES rounds (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'article'
                  CHECK (resource_type IN ('article', 'video', 'book', 'practice', 'cheatsheet', 'course')),
  url           TEXT,
  provider      TEXT,
  est_minutes   INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 100
);

CREATE INDEX idx_resources_topic ON resources (topic_id);

------------------------------------------------------------------------------
-- Question bank
------------------------------------------------------------------------------

CREATE TABLE questions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id         TEXT NOT NULL UNIQUE,       -- human-facing QID, e.g. "Q-APT-0001"
  question_type     TEXT NOT NULL CHECK (question_type IN
                      ('mcq', 'multi_select', 'numeric', 'coding', 'subjective')),
  body              TEXT NOT NULL,              -- markdown-ish statement
  topic_id          INTEGER REFERENCES topics (id) ON DELETE SET NULL,
  subtopic_id       INTEGER REFERENCES topics (id) ON DELETE SET NULL,
  difficulty        TEXT NOT NULL DEFAULT 'medium'
                      CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks             REAL NOT NULL DEFAULT 1,
  negative_marks    REAL NOT NULL DEFAULT 0,
  expected_seconds  INTEGER NOT NULL DEFAULT 60,
  numeric_answer    REAL,                       -- for question_type = 'numeric'
  explanation       TEXT,                       -- why the correct answer is correct
  concept_note      TEXT,                       -- the underlying concept recap
  hint              TEXT,
  provenance        TEXT NOT NULL DEFAULT 'authored'
                      CHECK (provenance IN ('authored', 'community_reported', 'historical')),
  frequently_asked  INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN ('draft', 'published', 'archived')),
  created_by        INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_questions_topic ON questions (topic_id);
CREATE INDEX idx_questions_difficulty ON questions (difficulty);
CREATE INDEX idx_questions_type_status ON questions (question_type, status);

CREATE TABLE question_options (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id   INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  label         TEXT NOT NULL,              -- stable identifier: 'A', 'B', ...
  body          TEXT NOT NULL,
  is_correct    INTEGER NOT NULL DEFAULT 0,
  -- Shown when a student picks this option and it is wrong.
  why_wrong     TEXT,
  sequence      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, label)
);

CREATE INDEX idx_options_question ON question_options (question_id, sequence);

-- Company/round/section applicability. A question can be tagged for many companies.
CREATE TABLE question_tags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id   INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  company_id    INTEGER REFERENCES companies (id) ON DELETE CASCADE,
  round_type    TEXT,       -- matches rounds.round_type; keeps tags company-agnostic
  section_slug  TEXT,
  UNIQUE (question_id, company_id, round_type, section_slug)
);

CREATE INDEX idx_qtags_company ON question_tags (company_id);
CREATE INDEX idx_qtags_round_type ON question_tags (round_type);

------------------------------------------------------------------------------
-- Coding problems
------------------------------------------------------------------------------

CREATE TABLE coding_problems (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id         INTEGER NOT NULL UNIQUE REFERENCES questions (id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  input_format        TEXT,
  output_format       TEXT,
  constraints         TEXT,
  time_limit_ms       INTEGER NOT NULL DEFAULT 2000,
  memory_limit_mb     INTEGER NOT NULL DEFAULT 256,
  allowed_languages   TEXT NOT NULL DEFAULT '["python","javascript","c","cpp","java"]',
  starter_code        TEXT NOT NULL DEFAULT '{}',   -- JSON: { language: code }
  reference_solution  TEXT,
  editorial           TEXT
);

CREATE TABLE test_cases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id    INTEGER NOT NULL REFERENCES coding_problems (id) ON DELETE CASCADE,
  input         TEXT NOT NULL,
  expected      TEXT NOT NULL,
  is_sample     INTEGER NOT NULL DEFAULT 0,
  explanation   TEXT,
  weight        REAL NOT NULL DEFAULT 1,
  sequence      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_testcases_problem ON test_cases (problem_id, sequence);

CREATE TABLE code_submissions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  problem_id        INTEGER NOT NULL REFERENCES coding_problems (id) ON DELETE CASCADE,
  attempt_id        INTEGER REFERENCES attempts (id) ON DELETE SET NULL,
  language          TEXT NOT NULL,
  source_code       TEXT NOT NULL,
  mode              TEXT NOT NULL DEFAULT 'submit' CHECK (mode IN ('run', 'submit')),
  verdict           TEXT NOT NULL CHECK (verdict IN (
                      'accepted', 'wrong_answer', 'compile_error', 'runtime_error',
                      'time_limit_exceeded', 'partial', 'unsupported_language', 'internal_error')),
  passed_count      INTEGER NOT NULL DEFAULT 0,
  total_count       INTEGER NOT NULL DEFAULT 0,
  score             REAL NOT NULL DEFAULT 0,
  runtime_ms        INTEGER,
  memory_kb         INTEGER,
  compile_output    TEXT,
  result_detail     TEXT,               -- JSON array of per-test-case results
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_submissions_user ON code_submissions (user_id, created_at);
CREATE INDEX idx_submissions_problem ON code_submissions (problem_id);

------------------------------------------------------------------------------
-- Mock tests
------------------------------------------------------------------------------

CREATE TABLE mock_tests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT,
  company_id        INTEGER REFERENCES companies (id) ON DELETE CASCADE,
  round_id          INTEGER REFERENCES rounds (id) ON DELETE SET NULL,
  scope             TEXT NOT NULL CHECK (scope IN ('quick', 'sectional', 'round', 'company')),
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  total_marks       REAL NOT NULL DEFAULT 0,
  difficulty        TEXT NOT NULL DEFAULT 'moderate'
                      CHECK (difficulty IN ('easy', 'moderate', 'hard', 'very_hard')),
  negative_marking  REAL NOT NULL DEFAULT 0,
  shuffle_questions INTEGER NOT NULL DEFAULT 1,
  shuffle_options   INTEGER NOT NULL DEFAULT 1,
  section_lock      INTEGER NOT NULL DEFAULT 0,
  allow_review      INTEGER NOT NULL DEFAULT 1,
  fullscreen_required INTEGER NOT NULL DEFAULT 0,
  is_published      INTEGER NOT NULL DEFAULT 1,
  created_by        INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mocktests_company ON mock_tests (company_id, scope);

CREATE TABLE mock_test_sections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  mock_test_id      INTEGER NOT NULL REFERENCES mock_tests (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sequence          INTEGER NOT NULL DEFAULT 0,
  question_count    INTEGER NOT NULL DEFAULT 10,
  duration_minutes  INTEGER,                -- NULL = shares the overall test timer
  marks_per_question REAL NOT NULL DEFAULT 1,
  negative_marks    REAL NOT NULL DEFAULT 0,
  question_kind     TEXT NOT NULL DEFAULT 'mcq'
                      CHECK (question_kind IN ('mcq', 'multi_select', 'coding', 'mixed')),
  -- Selection rules resolved at attempt-start time by the question engine.
  -- JSON: { topicIds:[], categories:[], difficulty:{easy,medium,hard}, roundType, companyOnly, frequentlyAsked }
  selection_rule    TEXT NOT NULL DEFAULT '{}',
  UNIQUE (mock_test_id, sequence)
);

CREATE INDEX idx_mtsections_test ON mock_test_sections (mock_test_id, sequence);

-- Manually pinned questions for a section (used when admin curates a fixed paper).
CREATE TABLE mock_test_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL REFERENCES mock_test_sections (id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  sequence      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (section_id, question_id)
);

------------------------------------------------------------------------------
-- Attempts
------------------------------------------------------------------------------

CREATE TABLE attempts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mock_test_id      INTEGER NOT NULL REFERENCES mock_tests (id) ON DELETE CASCADE,
  company_id        INTEGER REFERENCES companies (id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'abandoned')),
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  submitted_at      TEXT,
  duration_seconds  INTEGER,
  -- Frozen snapshot of the assembled paper (section order, shuffled options...).
  paper             TEXT NOT NULL DEFAULT '{}',
  total_marks       REAL NOT NULL DEFAULT 0,
  score             REAL NOT NULL DEFAULT 0,
  percentage        REAL NOT NULL DEFAULT 0,
  accuracy          REAL NOT NULL DEFAULT 0,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  incorrect_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count     INTEGER NOT NULL DEFAULT 0,
  readiness_score   REAL,
  percentile        REAL,
  report            TEXT,                 -- JSON: section/topic/difficulty breakdowns
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attempts_user ON attempts (user_id, created_at);
CREATE INDEX idx_attempts_test ON attempts (mock_test_id, status);

CREATE TABLE attempt_answers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id        INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  section_key       TEXT NOT NULL,
  selected_labels   TEXT,                 -- JSON array of option labels
  numeric_response  REAL,
  code_submission_id INTEGER REFERENCES code_submissions (id) ON DELETE SET NULL,
  is_marked_review  INTEGER NOT NULL DEFAULT 0,
  visited           INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_correct        INTEGER,
  marks_awarded     REAL NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_answers_attempt ON attempt_answers (attempt_id);

-- Every graded interaction outside a mock test (topic-wise practice).
CREATE TABLE practice_events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  company_id        INTEGER REFERENCES companies (id) ON DELETE SET NULL,
  selected_labels   TEXT,
  numeric_response  REAL,
  is_correct        INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_practice_user ON practice_events (user_id, created_at);
CREATE INDEX idx_practice_question ON practice_events (question_id);

------------------------------------------------------------------------------
-- Student <-> company relationship and progress
------------------------------------------------------------------------------

CREATE TABLE student_companies (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id        INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'interested'
                      CHECK (status IN ('interested', 'preparing', 'completed', 'shortlisted')),
  is_primary_target INTEGER NOT NULL DEFAULT 0,
  target_date       TEXT,
  readiness_score   REAL NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, company_id)
);

CREATE INDEX idx_studentcompanies_user ON student_companies (user_id, status);

-- Rolling per-topic mastery, updated by the progress service after every
-- practice event / mock submission.
CREATE TABLE topic_progress (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id            INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct   INTEGER NOT NULL DEFAULT 0,
  easy_correct        INTEGER NOT NULL DEFAULT 0,
  easy_attempted      INTEGER NOT NULL DEFAULT 0,
  medium_correct      INTEGER NOT NULL DEFAULT 0,
  medium_attempted    INTEGER NOT NULL DEFAULT 0,
  hard_correct        INTEGER NOT NULL DEFAULT 0,
  hard_attempted      INTEGER NOT NULL DEFAULT 0,
  total_time_seconds  INTEGER NOT NULL DEFAULT 0,
  mastery             REAL NOT NULL DEFAULT 0,     -- 0..100 blended score
  is_completed        INTEGER NOT NULL DEFAULT 0,
  last_activity_at    TEXT,
  UNIQUE (user_id, topic_id)
);

CREATE INDEX idx_topicprogress_user ON topic_progress (user_id);

CREATE TABLE round_progress (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  round_id          INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started', 'in_progress', 'ready', 'mastered')),
  completion        REAL NOT NULL DEFAULT 0,       -- 0..100
  best_mock_score   REAL,
  mocks_attempted   INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, round_id)
);

------------------------------------------------------------------------------
-- Adaptive roadmap (regenerated by the recommendation engine)
------------------------------------------------------------------------------

CREATE TABLE study_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id    INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  horizon_days  INTEGER NOT NULL DEFAULT 7,
  readiness_at_generation REAL NOT NULL DEFAULT 0,
  rationale     TEXT,
  generated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  is_current    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_studyplans_user ON study_plans (user_id, company_id, is_current);

CREATE TABLE study_plan_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id       INTEGER NOT NULL REFERENCES study_plans (id) ON DELETE CASCADE,
  day_index     INTEGER NOT NULL,
  action_type   TEXT NOT NULL CHECK (action_type IN
                  ('study_topic', 'practice_topic', 'sectional_mock', 'round_mock',
                   'company_mock', 'coding_practice', 'revision')),
  topic_id      INTEGER REFERENCES topics (id) ON DELETE SET NULL,
  round_id      INTEGER REFERENCES rounds (id) ON DELETE SET NULL,
  mock_test_id  INTEGER REFERENCES mock_tests (id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  detail        TEXT,
  est_minutes   INTEGER NOT NULL DEFAULT 60,
  priority      REAL NOT NULL DEFAULT 0,
  is_done       INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT
);

CREATE INDEX idx_planitems_plan ON study_plan_items (plan_id, day_index);

------------------------------------------------------------------------------
-- Gamification
------------------------------------------------------------------------------

CREATE TABLE xp_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  ref_type      TEXT,
  ref_id        INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_xp_user ON xp_events (user_id, created_at);

CREATE TABLE badges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '🏅',
  tier          TEXT NOT NULL DEFAULT 'bronze'
                  CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  -- JSON rule evaluated by the gamification service, e.g.
  -- { "type": "topic_questions", "topicSlug": "sql", "count": 100 }
  criteria      TEXT NOT NULL,
  xp_reward     INTEGER NOT NULL DEFAULT 50,
  company_id    INTEGER REFERENCES companies (id) ON DELETE CASCADE
);

CREATE TABLE user_badges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_id      INTEGER NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  earned_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, badge_id)
);

CREATE TABLE activity_days (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day           TEXT NOT NULL,              -- YYYY-MM-DD
  questions     INTEGER NOT NULL DEFAULT 0,
  minutes       INTEGER NOT NULL DEFAULT 0,
  xp            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, day)
);

CREATE INDEX idx_activitydays_user ON activity_days (user_id, day);

CREATE TABLE challenges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  starts_on     TEXT NOT NULL,
  ends_on       TEXT NOT NULL,
  goal_type     TEXT NOT NULL CHECK (goal_type IN
                  ('questions', 'coding_problems', 'mocks', 'topics', 'xp')),
  goal_count    INTEGER NOT NULL DEFAULT 10,
  xp_reward     INTEGER NOT NULL DEFAULT 200,
  company_id    INTEGER REFERENCES companies (id) ON DELETE SET NULL
);

------------------------------------------------------------------------------
-- Platform settings (admin editable key/value store)
------------------------------------------------------------------------------

CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
