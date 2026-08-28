/**
 * A revision queue over the questions a student has actually got wrong.
 *
 * Leitner boxes rather than SM-2: the input here is a binary right/wrong from
 * an MCQ, not a self-rated recall grade, so the extra precision of SM-2 would
 * be invented. Each correct recall moves a card up a box and further into the
 * future; a miss sends it back to box 0 and tomorrow.
 *
 * Cards are created only from real mistakes. Practising something you already
 * know is the most common way revision time gets wasted.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { addDays, today } from '../lib/util.js';

/** Days until a card in each box comes back. Box 4 is effectively retired. */
export const BOX_INTERVALS = [1, 3, 7, 21] as const;

/** Correct recalls needed, spaced across boxes, before a card retires. */
export const BOXES_TO_RETIRE = BOX_INTERVALS.length;

export interface RevisionCard {
  id: number;
  questionId: number;
  box: number;
  dueOn: string;
  timesSeen: number;
  timesCorrect: number;
  lastResult: 'correct' | 'incorrect' | null;
}

/**
 * Called whenever a question is answered anywhere in the app.
 *
 * A wrong answer schedules the question for tomorrow. A right answer only
 * matters if a card already exists — getting something right first time should
 * not put it in the revision queue.
 */
export function recordOutcome(
  userId: number,
  questionId: number,
  isCorrect: boolean,
  target: Db = sharedDb(),
): void {
  const existing = target
    .prepare<[number, number], { id: number; box: number; times_correct: number }>(
      'SELECT id, box, times_correct FROM revision_cards WHERE user_id = ? AND question_id = ?',
    )
    .get(userId, questionId);

  if (!existing) {
    if (isCorrect) return;
    target
      .prepare(
        `INSERT INTO revision_cards (user_id, question_id, box, due_on, times_seen, times_correct, last_result, last_reviewed_at)
         VALUES (?, ?, 0, ?, 1, 0, 'incorrect', datetime('now'))`,
      )
      .run(userId, questionId, addDays(today(), BOX_INTERVALS[0]));
    return;
  }

  if (!isCorrect) {
    // A miss undoes the spacing: back to the start, due again tomorrow.
    target
      .prepare(
        `UPDATE revision_cards
            SET box = 0, due_on = ?, times_seen = times_seen + 1,
                last_result = 'incorrect', last_reviewed_at = datetime('now'), retired_at = NULL
          WHERE id = ?`,
      )
      .run(addDays(today(), BOX_INTERVALS[0]), existing.id);
    return;
  }

  const nextBox = existing.box + 1;
  const retired = nextBox >= BOXES_TO_RETIRE;
  target
    .prepare(
      `UPDATE revision_cards
          SET box = ?, due_on = ?, times_seen = times_seen + 1, times_correct = times_correct + 1,
              last_result = 'correct', last_reviewed_at = datetime('now'), retired_at = ?
        WHERE id = ?`,
    )
    .run(
      Math.min(nextBox, BOXES_TO_RETIRE - 1),
      addDays(today(), BOX_INTERVALS[Math.min(nextBox, BOX_INTERVALS.length - 1)]),
      retired ? new Date().toISOString() : null,
      existing.id,
    );
}

/** Cards due today or overdue, oldest due first. */
export function dueCards(userId: number, limit = 20, target: Db = sharedDb()): RevisionCard[] {
  return target
    .prepare<[number, string, number], {
      id: number;
      question_id: number;
      box: number;
      due_on: string;
      times_seen: number;
      times_correct: number;
      last_result: 'correct' | 'incorrect' | null;
    }>(
      `SELECT id, question_id, box, due_on, times_seen, times_correct, last_result
         FROM revision_cards
        WHERE user_id = ? AND retired_at IS NULL AND due_on <= ?
        ORDER BY due_on, box, id
        LIMIT ?`,
    )
    .all(userId, today(), limit)
    .map((row) => ({
      id: row.id,
      questionId: row.question_id,
      box: row.box,
      dueOn: row.due_on,
      timesSeen: row.times_seen,
      timesCorrect: row.times_correct,
      lastResult: row.last_result,
    }));
}

export interface RevisionSummary {
  due: number;
  scheduled: number;
  retired: number;
  /** When the next card comes back, if nothing is due right now. */
  nextDueOn: string | null;
}

export function revisionSummary(userId: number, target: Db = sharedDb()): RevisionSummary {
  const row = target
    .prepare<[string, number], { due: number; scheduled: number; retired: number }>(
      `SELECT
         SUM(CASE WHEN retired_at IS NULL AND due_on <= ? THEN 1 ELSE 0 END) AS due,
         SUM(CASE WHEN retired_at IS NULL THEN 1 ELSE 0 END) AS scheduled,
         SUM(CASE WHEN retired_at IS NOT NULL THEN 1 ELSE 0 END) AS retired
       FROM revision_cards WHERE user_id = ?`,
    )
    .get(today(), userId)!;

  const next = target
    .prepare<[number, string], { due_on: string }>(
      `SELECT due_on FROM revision_cards
        WHERE user_id = ? AND retired_at IS NULL AND due_on > ?
        ORDER BY due_on LIMIT 1`,
    )
    .get(userId, today());

  return {
    due: row.due ?? 0,
    scheduled: row.scheduled ?? 0,
    retired: row.retired ?? 0,
    nextDueOn: next?.due_on ?? null,
  };
}
