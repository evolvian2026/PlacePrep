/**
 * Progress service — the single writer for `topic_progress`, `round_progress`,
 * `activity_days` and `student_companies.readiness_score`.
 *
 * Every graded interaction (practice answer, mock submission, coding submission)
 * funnels through `recordGradedAnswers`, which keeps the derived tables in step
 * with the raw event log. This is what closes the feedback loop: assess →
 * analyse → recommend → practise → reassess.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { today } from '../lib/util.js';
import { MASTERY_COMPLETE, computeMastery, computeCompanyReadiness } from './readiness.js';
import type { Difficulty } from '../types.js';

export interface GradedAnswer {
  questionId: number;
  topicId: number | null;
  difficulty: Difficulty;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

/**
 * Applies a batch of graded answers to the derived progress tables.
 * Safe to call inside an outer transaction.
 */
export function recordGradedAnswers(
  userId: number,
  answers: GradedAnswer[],
  target: Db = sharedDb(),
): void {
  if (answers.length === 0) return;

  const upsert = target.prepare(
    `INSERT INTO topic_progress (
       user_id, topic_id, questions_attempted, questions_correct,
       easy_attempted, easy_correct, medium_attempted, medium_correct,
       hard_attempted, hard_correct, total_time_seconds, mastery, is_completed, last_activity_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))
     ON CONFLICT(user_id, topic_id) DO UPDATE SET
       questions_attempted = questions_attempted + excluded.questions_attempted,
       questions_correct   = questions_correct   + excluded.questions_correct,
       easy_attempted      = easy_attempted      + excluded.easy_attempted,
       easy_correct        = easy_correct        + excluded.easy_correct,
       medium_attempted    = medium_attempted    + excluded.medium_attempted,
       medium_correct      = medium_correct      + excluded.medium_correct,
       hard_attempted      = hard_attempted      + excluded.hard_attempted,
       hard_correct        = hard_correct        + excluded.hard_correct,
       total_time_seconds  = total_time_seconds  + excluded.total_time_seconds,
       last_activity_at    = datetime('now')`,
  );

  // Aggregate per topic first so one UPSERT per topic suffices.
  const byTopic = new Map<number, GradedAnswer[]>();
  for (const answer of answers) {
    if (answer.topicId === null) continue;
    const bucket = byTopic.get(answer.topicId);
    if (bucket) bucket.push(answer);
    else byTopic.set(answer.topicId, [answer]);
  }

  for (const [topicId, group] of byTopic) {
    const counts = {
      easy: { attempted: 0, correct: 0 },
      medium: { attempted: 0, correct: 0 },
      hard: { attempted: 0, correct: 0 },
    };
    let time = 0;
    let correct = 0;
    for (const answer of group) {
      counts[answer.difficulty].attempted += 1;
      if (answer.isCorrect) {
        counts[answer.difficulty].correct += 1;
        correct += 1;
      }
      time += answer.timeSpentSeconds;
    }

    upsert.run(
      userId,
      topicId,
      group.length,
      correct,
      counts.easy.attempted,
      counts.easy.correct,
      counts.medium.attempted,
      counts.medium.correct,
      counts.hard.attempted,
      counts.hard.correct,
      time,
    );

    recomputeTopicMastery(userId, topicId, target);
  }

  bumpActivity(userId, answers.length, Math.round(answers.reduce((s, a) => s + a.timeSpentSeconds, 0) / 60), target);
}

/** Recalculates mastery from the accumulated counters for one topic. */
export function recomputeTopicMastery(userId: number, topicId: number, target: Db = sharedDb()): number {
  const row = target
    .prepare<[number, number], {
      questions_attempted: number;
      questions_correct: number;
      easy_attempted: number;
      easy_correct: number;
      medium_attempted: number;
      medium_correct: number;
      hard_attempted: number;
      hard_correct: number;
    }>(
      `SELECT questions_attempted, questions_correct, easy_attempted, easy_correct,
              medium_attempted, medium_correct, hard_attempted, hard_correct
       FROM topic_progress WHERE user_id = ? AND topic_id = ?`,
    )
    .get(userId, topicId);
  if (!row) return 0;

  const mastery = computeMastery({
    attempted: row.questions_attempted,
    correct: row.questions_correct,
    easyAttempted: row.easy_attempted,
    easyCorrect: row.easy_correct,
    mediumAttempted: row.medium_attempted,
    mediumCorrect: row.medium_correct,
    hardAttempted: row.hard_attempted,
    hardCorrect: row.hard_correct,
  });

  target
    .prepare('UPDATE topic_progress SET mastery = ?, is_completed = ? WHERE user_id = ? AND topic_id = ?')
    .run(mastery, mastery >= MASTERY_COMPLETE ? 1 : 0, userId, topicId);

  return mastery;
}

function bumpActivity(userId: number, questions: number, minutes: number, target: Db): void {
  target
    .prepare(
      `INSERT INTO activity_days (user_id, day, questions, minutes, xp)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id, day) DO UPDATE SET
         questions = questions + excluded.questions,
         minutes   = minutes   + excluded.minutes`,
    )
    .run(userId, today(), questions, Math.max(minutes, 0));
}

/**
 * Refreshes cached readiness for every company the student follows, plus the
 * per-round progress rows the roadmap reads.
 */
export function refreshCompanyProgress(userId: number, target: Db = sharedDb()): void {
  const companies = target
    .prepare<[number], { company_id: number }>('SELECT company_id FROM student_companies WHERE user_id = ?')
    .all(userId);

  const updateLink = target.prepare(
    "UPDATE student_companies SET readiness_score = ?, updated_at = datetime('now') WHERE user_id = ? AND company_id = ?",
  );
  const upsertRound = target.prepare(
    `INSERT INTO round_progress (user_id, round_id, status, completion, best_mock_score, mocks_attempted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, round_id) DO UPDATE SET
       status = excluded.status,
       completion = excluded.completion,
       best_mock_score = excluded.best_mock_score,
       mocks_attempted = excluded.mocks_attempted,
       updated_at = datetime('now')`,
  );

  for (const { company_id: companyId } of companies) {
    const readiness = computeCompanyReadiness(userId, companyId, target);
    updateLink.run(readiness.readiness, userId, companyId);
    for (const round of readiness.rounds) {
      upsertRound.run(
        userId,
        round.roundId,
        round.status,
        round.completion,
        round.bestMockScore,
        round.mocksAttempted,
      );
    }
  }
}

// ───────────────────────────── streaks ─────────────────────────────

export interface StreakInfo {
  current: number;
  longest: number;
  activeToday: boolean;
  last30: { day: string; questions: number; minutes: number }[];
}

export function computeStreak(userId: number, target: Db = sharedDb()): StreakInfo {
  const days = target
    .prepare<[number], { day: string; questions: number; minutes: number }>(
      'SELECT day, questions, minutes FROM activity_days WHERE user_id = ? AND questions > 0 ORDER BY day DESC',
    )
    .all(userId);

  const activeDays = new Set(days.map((d) => d.day));
  const todayStr = today();

  let current = 0;
  let cursor = new Date(`${todayStr}T00:00:00Z`);
  // A streak stays alive if the student was active today or yesterday; missing
  // today does not break it until midnight passes without activity.
  if (!activeDays.has(todayStr)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  const ascending = [...days].reverse();
  for (const entry of ascending) {
    const date = new Date(`${entry.day}T00:00:00Z`);
    if (previous && (date.getTime() - previous.getTime()) / 86_400_000 === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return {
    current,
    longest: Math.max(longest, current),
    activeToday: activeDays.has(todayStr),
    last30: days.slice(0, 30).reverse(),
  };
}
