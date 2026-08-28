-- First-hand reports from students who actually sat a company's process.
--
-- 158 of the companies in the catalogue carry a templated hiring process,
-- clearly marked as a pattern rather than researched fact. This is the path
-- from that to real data: a student who sat the drive says what the rounds
-- actually were, an admin reviews it, and an accepted report becomes a
-- company insight with proper provenance.
--
-- Nothing a student submits is shown to other students before review. An
-- unreviewed claim about an employer's process is exactly the kind of
-- uncertain information this platform promises not to present as fact.
CREATE TABLE company_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users (id) ON DELETE SET NULL,
  -- What the report is about, mirroring company_insights.category.
  category      TEXT NOT NULL CHECK (category IN (
                  'hiring_process', 'coding_pattern', 'technical_pattern',
                  'hr_pattern', 'frequently_tested', 'question_types',
                  'eligibility', 'preparation_advice', 'general')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- When the student sat the process, so stale reports can be judged as such.
  sat_on        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewer_id   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  reviewer_note TEXT,
  reviewed_at   TEXT,
  -- The insight created when a report is accepted, so the link is traceable.
  insight_id    INTEGER REFERENCES company_insights (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_company_reports_status ON company_reports (status, created_at);
CREATE INDEX idx_company_reports_company ON company_reports (company_id, status);
