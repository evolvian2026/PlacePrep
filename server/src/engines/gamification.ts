/**
 * Gamification service — XP, badges, streaks, leaderboards and weekly challenges.
 *
 * Badge criteria are data, not code: each badge row carries a JSON rule that
 * `evaluateBadges` interprets, so new achievements are added from the admin panel
 * without a deploy.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { json, round, today } from '../lib/util.js';
import { computeStreak } from './progress.js';
import type { BadgeSeed } from '../db/seed/gamification.js';

type Criteria = BadgeSeed['criteria'];

export interface XpConfig {
  correctAnswer: number;
  codingAccepted: number;
  mockCompleted: number;
  topicMastered: number;
}

const DEFAULT_XP: XpConfig = { correctAnswer: 5, codingAccepted: 40, mockCompleted: 60, topicMastered: 100 };

export function loadXpConfig(target: Db = sharedDb()): XpConfig {
  const row = target
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get('gamification.xp');
  return { ...DEFAULT_XP, ...json<Partial<XpConfig>>(row?.value, {}) };
}

export function awardXp(
  userId: number,
  amount: number,
  reason: string,
  ref?: { type: string; id: number },
  target: Db = sharedDb(),
): void {
  if (amount <= 0) return;
  target
    .prepare('INSERT INTO xp_events (user_id, amount, reason, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, Math.round(amount), reason, ref?.type ?? null, ref?.id ?? null);
  target
    .prepare(
      `INSERT INTO activity_days (user_id, day, questions, minutes, xp) VALUES (?, ?, 0, 0, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET xp = xp + excluded.xp`,
    )
    .run(userId, today(), Math.round(amount));
}

export function totalXp(userId: number, target: Db = sharedDb()): number {
  return (
    target
      .prepare<[number], { total: number | null }>('SELECT SUM(amount) AS total FROM xp_events WHERE user_id = ?')
      .get(userId)?.total ?? 0
  );
}

/** XP thresholds double roughly every level; level 1 starts at 0. */
export function levelFor(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progress: number } {
  let level = 1;
  let threshold = 0;
  let step = 250;
  while (xp >= threshold + step) {
    threshold += step;
    level += 1;
    step = Math.round(step * 1.35);
  }
  return {
    level,
    currentLevelXp: xp - threshold,
    nextLevelXp: step,
    progress: round(((xp - threshold) / step) * 100, 1),
  };
}

// ───────────────────────────── badges ─────────────────────────────

interface BadgeRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  criteria: string;
  xp_reward: number;
  company_id: number | null;
}

export interface EarnedBadge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  xpReward: number;
}

/**
 * Evaluates every badge the student has not yet earned and awards those whose
 * criteria are now met. Returns the newly earned badges so the caller can show a
 * toast.
 */
export function evaluateBadges(userId: number, target: Db = sharedDb()): EarnedBadge[] {
  const badges = target
    .prepare<[number], BadgeRow>(
      `SELECT b.* FROM badges b
       WHERE NOT EXISTS (SELECT 1 FROM user_badges ub WHERE ub.badge_id = b.id AND ub.user_id = ?)`,
    )
    .all(userId);

  const earned: EarnedBadge[] = [];
  const insert = target.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)');

  for (const badge of badges) {
    const criteria = json<Criteria | null>(badge.criteria, null);
    if (!criteria) continue;
    if (!meetsCriteria(userId, criteria, target)) continue;

    const info = insert.run(userId, badge.id);
    if (info.changes === 0) continue;
    awardXp(userId, badge.xp_reward, `Badge earned: ${badge.name}`, { type: 'badge', id: badge.id }, target);
    earned.push({
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      tier: badge.tier,
      xpReward: badge.xp_reward,
    });
  }

  return earned;
}

function meetsCriteria(userId: number, criteria: Criteria, target: Db): boolean {
  switch (criteria.type) {
    case 'questions_solved':
      return countCorrectAnswers(userId, target) >= criteria.count;

    case 'topic_questions': {
      const topic = target
        .prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?')
        .get(criteria.topicSlug);
      if (!topic) return false;
      return countCorrectAnswers(userId, target, { topicId: topic.id }) >= criteria.count;
    }

    case 'category_questions':
      return countCorrectAnswers(userId, target, { category: criteria.category }) >= criteria.count;

    case 'coding_solved':
      return (
        target
          .prepare<[number], { count: number }>(
            "SELECT COUNT(DISTINCT problem_id) AS count FROM code_submissions WHERE user_id = ? AND verdict = 'accepted'",
          )
          .get(userId)!.count >= criteria.count
      );

    case 'coding_solved_difficulty':
      return (
        target
          .prepare<[number, string], { count: number }>(
            `SELECT COUNT(DISTINCT cs.problem_id) AS count
             FROM code_submissions cs
             JOIN coding_problems cp ON cp.id = cs.problem_id
             JOIN questions q ON q.id = cp.question_id
             WHERE cs.user_id = ? AND cs.verdict = 'accepted' AND q.difficulty = ?`,
          )
          .get(userId, criteria.difficulty)!.count >= criteria.count
      );

    case 'mocks_completed':
      return (
        target
          .prepare<[number], { count: number }>(
            "SELECT COUNT(*) AS count FROM attempts WHERE user_id = ? AND status IN ('submitted', 'auto_submitted')",
          )
          .get(userId)!.count >= criteria.count
      );

    case 'mock_score_above':
      return (
        target
          .prepare<[number, number], { count: number }>(
            `SELECT COUNT(*) AS count FROM attempts
             WHERE user_id = ? AND status IN ('submitted', 'auto_submitted') AND percentage >= ?`,
          )
          .get(userId, criteria.percentage)!.count >= criteria.count
      );

    case 'streak_days':
      return computeStreak(userId, target).longest >= criteria.count;

    case 'topics_mastered':
      return (
        target
          .prepare<[number], { count: number }>(
            'SELECT COUNT(*) AS count FROM topic_progress WHERE user_id = ? AND is_completed = 1',
          )
          .get(userId)!.count >= criteria.count
      );

    case 'company_readiness': {
      const company = target
        .prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?')
        .get(criteria.companySlug);
      if (!company) return false;
      const link = target
        .prepare<[number, number], { readiness_score: number }>(
          'SELECT readiness_score FROM student_companies WHERE user_id = ? AND company_id = ?',
        )
        .get(userId, company.id);
      return (link?.readiness_score ?? 0) >= criteria.readiness;
    }

    default:
      return false;
  }
}

/** Distinct questions answered correctly at least once, across practice and mocks. */
function countCorrectAnswers(
  userId: number,
  target: Db,
  scope: { topicId?: number; category?: string } = {},
): number {
  const conditions: string[] = [];
  const params: unknown[] = [userId, userId];
  if (scope.topicId) {
    conditions.push('(q.topic_id = ? OR q.subtopic_id = ? OR t.parent_id = ?)');
    params.push(scope.topicId, scope.topicId, scope.topicId);
  }
  if (scope.category) {
    conditions.push('t.category = ?');
    params.push(scope.category);
  }
  const extra = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  return target
    .prepare<unknown[], { count: number }>(
      `SELECT COUNT(DISTINCT q.id) AS count
       FROM questions q
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE (
         EXISTS (SELECT 1 FROM practice_events pe WHERE pe.question_id = q.id AND pe.user_id = ? AND pe.is_correct = 1)
         OR EXISTS (
           SELECT 1 FROM attempt_answers aa JOIN attempts a ON a.id = aa.attempt_id
           WHERE aa.question_id = q.id AND a.user_id = ? AND aa.is_correct = 1
         )
       ) ${extra}`,
    )
    .get(...params)!.count;
}

export function userBadges(userId: number, target: Db = sharedDb()): (EarnedBadge & { earnedAt: string })[] {
  return target
    .prepare<[number], { slug: string; name: string; description: string; icon: string; tier: string; xp_reward: number; earned_at: string }>(
      `SELECT b.slug, b.name, b.description, b.icon, b.tier, b.xp_reward, ub.earned_at
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ? ORDER BY ub.earned_at DESC`,
    )
    .all(userId)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      tier: row.tier,
      xpReward: row.xp_reward,
      earnedAt: row.earned_at,
    }));
}

export function allBadgesWithState(userId: number, target: Db = sharedDb()): (EarnedBadge & { earned: boolean; earnedAt: string | null })[] {
  return target
    .prepare<[number], {
      slug: string;
      name: string;
      description: string;
      icon: string;
      tier: string;
      xp_reward: number;
      earned_at: string | null;
    }>(
      `SELECT b.slug, b.name, b.description, b.icon, b.tier, b.xp_reward, ub.earned_at
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
       ORDER BY CASE b.tier WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 ELSE 4 END, b.name`,
    )
    .all(userId)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      tier: row.tier,
      xpReward: row.xp_reward,
      earned: row.earned_at !== null,
      earnedAt: row.earned_at,
    }));
}

// ───────────────────────────── leaderboard ─────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  college: string | null;
  xp: number;
  badges: number;
  mocksCompleted: number;
  averageScore: number;
  streak: number;
  isCurrentUser: boolean;
}

export function leaderboard(
  options: { userId?: number; companyId?: number; limit?: number; scope?: 'all_time' | 'weekly' } = {},
  target: Db = sharedDb(),
): LeaderboardEntry[] {
  const limit = Math.min(options.limit ?? 25, 100);
  const weekly = options.scope === 'weekly';

  const rows = target
    .prepare<unknown[], {
      id: number;
      name: string;
      college: string | null;
      xp: number | null;
      badges: number;
      mocks: number;
      avg_score: number | null;
    }>(
      `SELECT u.id, u.name, u.college,
              (SELECT SUM(amount) FROM xp_events x
                 WHERE x.user_id = u.id ${weekly ? "AND x.created_at >= datetime('now', '-7 days')" : ''}) AS xp,
              (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = u.id) AS badges,
              (SELECT COUNT(*) FROM attempts a
                 WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')
                 ${weekly ? "AND a.submitted_at >= datetime('now', '-7 days')" : ''}) AS mocks,
              (SELECT AVG(a.percentage) FROM attempts a
                 WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')
                 ${weekly ? "AND a.submitted_at >= datetime('now', '-7 days')" : ''}) AS avg_score
       FROM users u
       WHERE u.role = 'student' AND u.is_active = 1
         ${options.companyId ? 'AND EXISTS (SELECT 1 FROM student_companies sc WHERE sc.user_id = u.id AND sc.company_id = ?)' : ''}
       ORDER BY xp DESC NULLS LAST, avg_score DESC NULLS LAST, u.id
       LIMIT ?`,
    )
    .all(...(options.companyId ? [options.companyId, limit] : [limit]));

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    name: row.name,
    college: row.college,
    xp: row.xp ?? 0,
    badges: row.badges,
    mocksCompleted: row.mocks,
    averageScore: row.avg_score ? round(row.avg_score, 1) : 0,
    streak: computeStreak(row.id, target).current,
    isCurrentUser: row.id === options.userId,
  }));
}

// ───────────────────────────── challenges ─────────────────────────────

export interface ChallengeProgress {
  slug: string;
  title: string;
  description: string;
  goalType: string;
  goalCount: number;
  progress: number;
  xpReward: number;
  startsOn: string;
  endsOn: string;
  completed: boolean;
  daysRemaining: number;
}

export function activeChallenges(userId: number, target: Db = sharedDb()): ChallengeProgress[] {
  const rows = target
    .prepare<[], {
      slug: string;
      title: string;
      description: string;
      goal_type: string;
      goal_count: number;
      xp_reward: number;
      starts_on: string;
      ends_on: string;
    }>(
      `SELECT slug, title, description, goal_type, goal_count, xp_reward, starts_on, ends_on
       FROM challenges WHERE date('now') BETWEEN starts_on AND ends_on ORDER BY ends_on`,
    )
    .all();

  return rows.map((row) => {
    const progress = challengeProgress(userId, row.goal_type, row.starts_on, row.ends_on, target);
    const daysRemaining = Math.max(
      0,
      Math.ceil((Date.parse(`${row.ends_on}T23:59:59Z`) - Date.now()) / 86_400_000),
    );
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      goalType: row.goal_type,
      goalCount: row.goal_count,
      progress,
      xpReward: row.xp_reward,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      completed: progress >= row.goal_count,
      daysRemaining,
    };
  });
}

function challengeProgress(userId: number, goalType: string, from: string, to: string, target: Db): number {
  switch (goalType) {
    case 'questions':
      return (
        target
          .prepare<[number, string, string], { count: number }>(
            "SELECT COUNT(*) AS count FROM practice_events WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?",
          )
          .get(userId, from, to)!.count +
        target
          .prepare<[number, string, string], { count: number }>(
            `SELECT COUNT(*) AS count FROM attempt_answers aa JOIN attempts a ON a.id = aa.attempt_id
             WHERE a.user_id = ? AND aa.is_correct IS NOT NULL AND date(a.submitted_at) BETWEEN ? AND ?`,
          )
          .get(userId, from, to)!.count
      );
    case 'coding_problems':
      return target
        .prepare<[number, string, string], { count: number }>(
          `SELECT COUNT(DISTINCT problem_id) AS count FROM code_submissions
           WHERE user_id = ? AND verdict = 'accepted' AND date(created_at) BETWEEN ? AND ?`,
        )
        .get(userId, from, to)!.count;
    case 'mocks':
      return target
        .prepare<[number, string, string], { count: number }>(
          `SELECT COUNT(*) AS count FROM attempts
           WHERE user_id = ? AND status IN ('submitted','auto_submitted') AND date(submitted_at) BETWEEN ? AND ?`,
        )
        .get(userId, from, to)!.count;
    case 'topics':
      return target
        .prepare<[number], { count: number }>(
          'SELECT COUNT(*) AS count FROM topic_progress WHERE user_id = ? AND is_completed = 1',
        )
        .get(userId)!.count;
    case 'xp':
      return (
        target
          .prepare<[number, string, string], { total: number | null }>(
            'SELECT SUM(amount) AS total FROM xp_events WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?',
          )
          .get(userId, from, to)?.total ?? 0
      );
    default:
      return 0;
  }
}
