import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { handler, notFound, parse } from '../lib/http.js';
import { pct, round } from '../lib/util.js';
import { attachUser, currentUser, requireAuth } from '../middleware/auth.js';
import { computeCompanyReadiness, computeOverallReadiness, explainCompanyReadiness, loadThresholds } from '../engines/readiness.js';
import { computeStreak } from '../engines/progress.js';
import { recentAttempts, scoreTrend } from '../engines/test-engine.js';
import { codingStats } from '../engines/code-engine.js';
import {
  activeChallenges,
  allBadgesWithState,
  leaderboard,
  levelFor,
  totalXp,
  userBadges,
} from '../engines/gamification.js';
import {
  ensureCurrentPlan,
  generatePlan,
  loadCurrentPlan,
  markPlanItem,
  nextBestAction,
  savePlan,
  scoreTopicsForCompany,
} from '../engines/recommendation-engine.js';

export const dashboardRouter = Router();
dashboardRouter.use(attachUser, requireAuth);

/** Everything the student dashboard needs, in one round trip. */
dashboardRouter.get(
  '/',
  handler((req, res) => {
    const user = currentUser(req);
    const thresholds = loadThresholds();

    const overall = computeOverallReadiness(user.id);
    const companies = db()
      .prepare<[number], {
        company_id: number;
        slug: string;
        name: string;
        logo_text: string | null;
        brand_color: string | null;
        company_type: string;
        difficulty: string;
        status: string;
        is_primary_target: number;
        readiness_score: number;
      }>(
        `SELECT sc.company_id, c.slug, c.name, c.logo_text, c.brand_color, c.company_type, c.difficulty,
                sc.status, sc.is_primary_target, sc.readiness_score
         FROM student_companies sc JOIN companies c ON c.id = sc.company_id
         WHERE sc.user_id = ?
         ORDER BY sc.is_primary_target DESC, sc.readiness_score DESC`,
      )
      .all(user.id);

    const totals = db()
      .prepare<[number, number, number, number], {
        questions_solved: number;
        questions_attempted: number;
        topics_completed: number;
        topics_touched: number;
      }>(
        `SELECT
           (SELECT COALESCE(SUM(questions_correct), 0) FROM topic_progress WHERE user_id = ?) AS questions_solved,
           (SELECT COALESCE(SUM(questions_attempted), 0) FROM topic_progress WHERE user_id = ?) AS questions_attempted,
           (SELECT COUNT(*) FROM topic_progress WHERE user_id = ? AND is_completed = 1) AS topics_completed,
           (SELECT COUNT(*) FROM topic_progress WHERE user_id = ? AND questions_attempted > 0) AS topics_touched`,
      )
      .get(user.id, user.id, user.id, user.id)!;

    const mockStats = db()
      .prepare<[number], { attempts: number; average: number | null; best: number | null; accuracy: number | null }>(
        `SELECT COUNT(*) AS attempts, AVG(percentage) AS average, MAX(percentage) AS best, AVG(accuracy) AS accuracy
         FROM attempts WHERE user_id = ? AND status IN ('submitted','auto_submitted')`,
      )
      .get(user.id)!;

    const primaryCompanyId = overall.primaryCompanyId;
    const primaryReadiness = primaryCompanyId ? computeCompanyReadiness(user.id, primaryCompanyId) : null;
    const primaryCompany = companies.find((c) => c.company_id === primaryCompanyId) ?? companies[0] ?? null;

    const xp = totalXp(user.id);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      readiness: {
        overall: overall.score,
        band: overall.band,
        thresholds,
        perCompany: overall.perCompany,
      },
      targetCompany: primaryCompany
        ? {
            id: primaryCompany.company_id,
            slug: primaryCompany.slug,
            name: primaryCompany.name,
            logoText: primaryCompany.logo_text,
            brandColor: primaryCompany.brand_color,
            companyType: primaryCompany.company_type,
            difficulty: primaryCompany.difficulty,
            status: primaryCompany.status,
            readiness: primaryReadiness?.readiness ?? primaryCompany.readiness_score,
            explanation: primaryReadiness ? explainCompanyReadiness(primaryReadiness) : null,
            rounds: primaryReadiness?.rounds ?? [],
            categoryBreakdown: primaryReadiness ? categoryBreakdown(primaryReadiness.topicBreakdown) : [],
          }
        : null,
      companies: companies.map((company) => ({
        id: company.company_id,
        slug: company.slug,
        name: company.name,
        logoText: company.logo_text,
        brandColor: company.brand_color,
        companyType: company.company_type,
        difficulty: company.difficulty,
        status: company.status,
        isPrimaryTarget: company.is_primary_target === 1,
        readiness: company.readiness_score,
      })),
      stats: {
        questionsSolved: totals.questions_solved,
        questionsAttempted: totals.questions_attempted,
        accuracy: totals.questions_attempted > 0 ? pct(totals.questions_solved, totals.questions_attempted) : 0,
        topicsCompleted: totals.topics_completed,
        topicsTouched: totals.topics_touched,
        mocksAttempted: mockStats.attempts,
        averageScore: mockStats.average ? round(mockStats.average, 1) : 0,
        bestScore: mockStats.best ? round(mockStats.best, 1) : 0,
        mockAccuracy: mockStats.accuracy ? round(mockStats.accuracy, 1) : 0,
      },
      weakTopics: primaryReadiness?.weakTopics ?? [],
      strongTopics: primaryReadiness?.strongTopics ?? [],
      recentAttempts: recentAttempts(user.id, 5),
      nextAction: primaryCompanyId ? nextBestAction(user.id, primaryCompanyId) : null,
      coding: codingStats(user.id),
      gamification: {
        xp,
        ...levelFor(xp),
        streak: computeStreak(user.id),
        badges: userBadges(user.id).slice(0, 6),
        badgeCount: userBadges(user.id).length,
        challenges: activeChallenges(user.id),
      },
    });
  }),
);

/** Groups topic mastery by category — the "Aptitude 82% / DBMS 55%" breakdown. */
function categoryBreakdown(
  topics: { category: string; mastery: number; attempted: number }[],
): { category: string; label: string; mastery: number; topics: number }[] {
  const labels: Record<string, string> = {
    aptitude: 'Aptitude',
    reasoning: 'Reasoning',
    verbal: 'Verbal',
    dsa: 'Coding / DSA',
    cs_fundamentals: 'CS Fundamentals',
    programming: 'Programming',
    database: 'DBMS & SQL',
    system_design: 'System Design',
    behavioural: 'HR & Behavioural',
    other: 'Other',
  };

  const grouped = new Map<string, { total: number; count: number }>();
  for (const topic of topics) {
    const entry = grouped.get(topic.category) ?? { total: 0, count: 0 };
    entry.total += topic.mastery;
    entry.count += 1;
    grouped.set(topic.category, entry);
  }

  return [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      label: labels[category] ?? category,
      mastery: round(value.total / value.count, 1),
      topics: value.count,
    }))
    .sort((a, b) => b.mastery - a.mastery);
}

// ─────────────────────────── roadmap ───────────────────────────

export const roadmapRouter = Router();
roadmapRouter.use(attachUser, requireAuth);

const planQuerySchema = z.object({
  companySlug: z.string().trim().max(60),
  horizonDays: z.coerce.number().int().min(3).max(30).optional(),
  minutesPerDay: z.coerce.number().int().min(30).max(600).optional(),
});

function companyIdFromSlug(slug: string): number {
  const row = db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(slug);
  if (!row) throw notFound('Company not found');
  return row.id;
}

/** The adaptive plan. Regenerated automatically when stale. */
roadmapRouter.get(
  '/',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parse(planQuerySchema, req.query);
    const companyId = companyIdFromSlug(query.companySlug);

    const plan = ensureCurrentPlan(
      user.id,
      companyId,
      { horizonDays: query.horizonDays, minutesPerDay: query.minutesPerDay },
    );
    const readiness = computeCompanyReadiness(user.id, companyId);
    const { topics } = scoreTopicsForCompany(user.id, companyId);

    res.json({
      plan,
      readiness: {
        score: readiness.readiness,
        band: readiness.band,
        components: readiness.components,
        explanation: explainCompanyReadiness(readiness),
        rounds: readiness.rounds,
      },
      priorities: topics.slice(0, 12).map((topic) => ({
        topicId: topic.topicId,
        name: topic.name,
        slug: topic.slug,
        category: topic.category,
        mastery: topic.mastery,
        attempted: topic.attempted,
        roundName: topic.roundName,
        priority: topic.priority,
        reasons: topic.reasons,
      })),
      enrichment: enrichPlan(plan.items),
    });
  }),
);

/** Attaches display metadata (topic names, mock titles) to plan items. */
function enrichPlan(items: { topicId?: number; mockTestId?: number; roundId?: number }[]) {
  const topicIds = [...new Set(items.map((i) => i.topicId).filter((id): id is number => Boolean(id)))];
  const mockIds = [...new Set(items.map((i) => i.mockTestId).filter((id): id is number => Boolean(id)))];

  const topics = topicIds.length
    ? db()
        .prepare<unknown[], { id: number; name: string; slug: string; category: string }>(
          `SELECT id, name, slug, category FROM topics WHERE id IN (${topicIds.map(() => '?').join(', ')})`,
        )
        .all(...topicIds)
    : [];

  const mocks = mockIds.length
    ? db()
        .prepare<unknown[], { id: number; slug: string; title: string; duration_minutes: number; scope: string }>(
          `SELECT id, slug, title, duration_minutes, scope FROM mock_tests WHERE id IN (${mockIds.map(() => '?').join(', ')})`,
        )
        .all(...mockIds)
    : [];

  return {
    topics: Object.fromEntries(topics.map((t) => [t.id, t])),
    mockTests: Object.fromEntries(mocks.map((m) => [m.id, m])),
  };
}

/** Forces a fresh plan — the "regenerate my roadmap" button. */
roadmapRouter.post(
  '/regenerate',
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(
      z.object({
        companySlug: z.string().trim().max(60),
        horizonDays: z.number().int().min(3).max(30).optional(),
        minutesPerDay: z.number().int().min(30).max(600).optional(),
      }),
      req.body,
    );
    const companyId = companyIdFromSlug(input.companySlug);

    const plan = generatePlan(user.id, companyId, {
      horizonDays: input.horizonDays,
      minutesPerDay: input.minutesPerDay,
    });
    savePlan(user.id, plan);

    res.json({ plan: loadCurrentPlan(user.id, companyId) });
  }),
);

roadmapRouter.post(
  '/items/:itemId',
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(z.object({ done: z.boolean() }), req.body);
    markPlanItem(user.id, Number(req.params.itemId), input.done);
    res.json({ ok: true });
  }),
);

// ─────────────────────────── performance ───────────────────────────

export const performanceRouter = Router();
performanceRouter.use(attachUser, requireAuth);

performanceRouter.get(
  '/',
  handler((req, res) => {
    const user = currentUser(req);

    const topics = db()
      .prepare<[number], {
        topic_id: number;
        name: string;
        slug: string;
        category: string;
        questions_attempted: number;
        questions_correct: number;
        easy_attempted: number;
        easy_correct: number;
        medium_attempted: number;
        medium_correct: number;
        hard_attempted: number;
        hard_correct: number;
        total_time_seconds: number;
        mastery: number;
        is_completed: number;
      }>(
        `SELECT tp.topic_id, t.name, t.slug, t.category, tp.questions_attempted, tp.questions_correct,
                tp.easy_attempted, tp.easy_correct, tp.medium_attempted, tp.medium_correct,
                tp.hard_attempted, tp.hard_correct, tp.total_time_seconds, tp.mastery, tp.is_completed
         FROM topic_progress tp JOIN topics t ON t.id = tp.topic_id
         WHERE tp.user_id = ? AND tp.questions_attempted > 0
         ORDER BY tp.mastery ASC`,
      )
      .all(user.id);

    const consistency = computeStreak(user.id);

    res.json({
      trend: scoreTrend(user.id),
      topics: topics.map((topic) => ({
        topicId: topic.topic_id,
        name: topic.name,
        slug: topic.slug,
        category: topic.category,
        attempted: topic.questions_attempted,
        correct: topic.questions_correct,
        accuracy: pct(topic.questions_correct, topic.questions_attempted),
        mastery: topic.mastery,
        isCompleted: topic.is_completed === 1,
        averageTimeSeconds:
          topic.questions_attempted > 0 ? Math.round(topic.total_time_seconds / topic.questions_attempted) : 0,
        difficulty: {
          easy: { attempted: topic.easy_attempted, correct: topic.easy_correct },
          medium: { attempted: topic.medium_attempted, correct: topic.medium_correct },
          hard: { attempted: topic.hard_attempted, correct: topic.hard_correct },
        },
      })),
      weakAreas: topics.slice(0, 6).map((t) => ({ name: t.name, mastery: t.mastery, topicId: t.topic_id })),
      strongAreas: [...topics]
        .sort((a, b) => b.mastery - a.mastery)
        .slice(0, 6)
        .map((t) => ({ name: t.name, mastery: t.mastery, topicId: t.topic_id })),
      consistency,
      coding: codingStats(user.id),
      attempts: recentAttempts(user.id, 20),
      improvement: computeImprovement(user.id),
    });
  }),
);

/** First-half vs second-half average, a simple honest improvement signal. */
function computeImprovement(userId: number): { early: number; recent: number; delta: number; samples: number } {
  const rows = db()
    .prepare<[number], { percentage: number }>(
      `SELECT percentage FROM attempts
       WHERE user_id = ? AND status IN ('submitted','auto_submitted') ORDER BY id ASC`,
    )
    .all(userId);
  if (rows.length < 2) return { early: 0, recent: 0, delta: 0, samples: rows.length };

  const half = Math.floor(rows.length / 2);
  const early = rows.slice(0, half).reduce((sum, r) => sum + r.percentage, 0) / half;
  const recentSlice = rows.slice(half);
  const recent = recentSlice.reduce((sum, r) => sum + r.percentage, 0) / recentSlice.length;

  return { early: round(early, 1), recent: round(recent, 1), delta: round(recent - early, 1), samples: rows.length };
}

// ─────────────────────────── leaderboard & badges ───────────────────────────

export const gamificationRouter = Router();
gamificationRouter.use(attachUser, requireAuth);

gamificationRouter.get(
  '/leaderboard',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parse(
      z.object({
        scope: z.enum(['all_time', 'weekly']).optional(),
        companySlug: z.string().trim().max(60).optional(),
        limit: z.coerce.number().int().min(5).max(100).optional(),
      }),
      req.query,
    );

    const companyId = query.companySlug ? companyIdFromSlug(query.companySlug) : undefined;
    const entries = leaderboard({ userId: user.id, companyId, scope: query.scope, limit: query.limit });
    const mine = entries.find((entry) => entry.isCurrentUser) ?? null;

    res.json({ entries, me: mine, scope: query.scope ?? 'all_time' });
  }),
);

gamificationRouter.get(
  '/badges',
  handler((req, res) => {
    const user = currentUser(req);
    const xp = totalXp(user.id);
    res.json({
      badges: allBadgesWithState(user.id),
      xp,
      ...levelFor(xp),
      streak: computeStreak(user.id),
      challenges: activeChallenges(user.id),
    });
  }),
);
