/**
 * Integrity signals for a mock attempt.
 *
 * What this is: a record of what the browser could observe — the tab being
 * hidden, the window losing focus, fullscreen being left. Useful because a
 * student who tabs away six times mid-paper is not simulating the real thing,
 * and a placement cell running a mock drive wants to know.
 *
 * What this is not: proctoring. None of these signals is proof of anything.
 * A notification can steal focus; a screen can lock. The summary is worded as
 * observation rather than accusation, and nothing here blocks or fails anyone.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';

export type AttemptEventKind = 'tab_hidden' | 'window_blur' | 'fullscreen_exit' | 'paste' | 'copy';

export const ATTEMPT_EVENT_KINDS: AttemptEventKind[] = [
  'tab_hidden',
  'window_blur',
  'fullscreen_exit',
  'paste',
  'copy',
];

export interface IntegritySummary {
  /** Times the paper lost the student's attention, by kind. */
  counts: Record<AttemptEventKind, number>;
  /** Total seconds spent away from the paper, where the browser could tell. */
  awaySeconds: number;
  /** 'clean' | 'minor' | 'notable' — a description, never a pass/fail. */
  level: 'clean' | 'minor' | 'notable';
  /** Plain-language lines for the report. Empty when nothing was recorded. */
  notes: string[];
}

const EMPTY_COUNTS = (): Record<AttemptEventKind, number> => ({
  tab_hidden: 0,
  window_blur: 0,
  fullscreen_exit: 0,
  paste: 0,
  copy: 0,
});

export function recordAttemptEvent(
  attemptId: number,
  kind: AttemptEventKind,
  awaySeconds = 0,
  target: Db = sharedDb(),
): void {
  target
    .prepare('INSERT INTO attempt_events (attempt_id, kind, away_seconds) VALUES (?, ?, ?)')
    .run(attemptId, kind, Math.max(0, Math.min(Math.round(awaySeconds), 6 * 60 * 60)));
}

export function summariseIntegrity(attemptId: number, target: Db = sharedDb()): IntegritySummary {
  const rows = target
    .prepare<[number], { kind: AttemptEventKind; n: number; away: number }>(
      `SELECT kind, COUNT(*) AS n, COALESCE(SUM(away_seconds), 0) AS away
         FROM attempt_events WHERE attempt_id = ? GROUP BY kind`,
    )
    .all(attemptId);

  const counts = EMPTY_COUNTS();
  let awaySeconds = 0;
  for (const row of rows) {
    counts[row.kind] = row.n;
    awaySeconds += row.away;
  }

  const leaves = counts.tab_hidden + counts.window_blur;
  const notes: string[] = [];
  if (leaves > 0) {
    notes.push(
      `Left the paper ${leaves} time${leaves === 1 ? '' : 's'}` +
        (awaySeconds > 0 ? `, away for about ${Math.round(awaySeconds / 60) || 1} minute(s) in total.` : '.'),
    );
  }
  if (counts.fullscreen_exit > 0) {
    notes.push(`Exited fullscreen ${counts.fullscreen_exit} time${counts.fullscreen_exit === 1 ? '' : 's'}.`);
  }
  if (counts.paste > 0) {
    notes.push(`Pasted into an answer ${counts.paste} time${counts.paste === 1 ? '' : 's'}.`);
  }

  // Thresholds are deliberately forgiving: one stray focus loss is noise, not a
  // finding, and the wording never claims more than the browser observed.
  const level: IntegritySummary['level'] =
    leaves === 0 && counts.fullscreen_exit === 0 ? 'clean' : leaves + counts.fullscreen_exit <= 2 ? 'minor' : 'notable';

  return { counts, awaySeconds, level, notes };
}
