-- Integrity signals captured while a paper is open.
--
-- The runner already knew when the tab lost focus — it used the event to
-- autosave and then discarded it. Recording these makes a mock feel like the
-- real assessment and gives a placement cell something to look at, without
-- pretending to be proctoring software: these are browser hints, not proof,
-- and the UI says so.
CREATE TABLE attempt_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id    INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                  CHECK (kind IN ('tab_hidden', 'window_blur', 'fullscreen_exit', 'paste', 'copy')),
  occurred_at   TEXT NOT NULL DEFAULT (datetime('now')),
  -- Seconds the student was away, for the events where that is meaningful.
  away_seconds  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_attempt_events_attempt ON attempt_events (attempt_id, kind);
