/**
 * Recommendation engine — generates the personalised, self-updating roadmap.
 *
 * This is a deterministic, explainable planner rather than a language model. It
 * scores every topic a company tests on four signals (gap, importance, round
 * urgency, staleness), sequences the highest-priority work across a horizon, and
 * inserts assessments at the points where a re-measurement is actually useful.
 *
 * Deterministic was a deliberate choice: a student must be able to ask "why is
 * DBMS on day 5?" and get a real answer, plans must be reproducible for a
 * placement cell, and the loop must work with no external API key. `generatePlan`
 * is the seam an LLM-backed planner would implement — swap the implementation
 * and the rest of the platform is unchanged.
 *
 * The feedback loop it closes:
 *   assessment → analysis → recommendation → practice → reassessment
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { json, parseSqlDate, round } from '../lib/util.js';
import { computeCompanyReadiness, loadThresholds, MASTERY_COMPLETE, type CompanyReadiness } from './readiness.js';

export type ActionType =
  | 'study_topic'
  | 'practice_topic'
  | 'sectional_mock'
  | 'round_mock'
  | 'company_mock'
  | 'coding_practice'
  | 'revision';

export interface PlanItem {
  dayIndex: number;
  actionType: ActionType;
  topicId?: number;
  roundId?: number;
  mockTestId?: number;
  title: string;
  detail: string;
  estMinutes: number;
  priority: number;
}

export interface GeneratedPlan {
  companyId: number;
  horizonDays: number;
  readiness: number;
  rationale: string;
  items: PlanItem[];
}

interface ScoredTopic {
  topicId: number;
  name: string;
  slug: string;
  category: string;
  mastery: number;
  attempted: number;
  weight: number;
  importance: string;
  roundId: number;
  roundName: string;
  roundSequence: number;
  roundCompletion: number;
  estHours: number;
  daysSinceActivity: number | null;
  priority: number;
  reasons: string[];
}

/**
 * Priority is a weighted sum, deliberately kept legible:
 *   gap        — how far the topic is from mastery                       (×50)
 *   importance — core topics outrank optional ones                       (×15)
 *   urgency    — earlier rounds gate later ones, so they come first      (×20)
 *   untouched  — a never-attempted core topic is a bigger risk than a
 *                partially-learned one at the same mastery              (×10)
 *   staleness  — knowledge decays; revisit topics untouched for a while  (×5)
 */
function scoreTopic(input: Omit<ScoredTopic, 'priority' | 'reasons'>): { priority: number; reasons: string[] } {
  const reasons: string[] = [];

  const gap = (100 - input.mastery) / 100;
  let priority = gap * 50;
  if (input.mastery < 40) reasons.push(`mastery is only ${round(input.mastery)}%`);
  else if (input.mastery < MASTERY_COMPLETE) reasons.push(`mastery is ${round(input.mastery)}%, below the ${MASTERY_COMPLETE}% bar`);

  const importanceFactor = input.importance === 'core' ? 1 : input.importance === 'recommended' ? 0.6 : 0.3;
  priority += importanceFactor * 15 * input.weight;
  if (input.importance === 'core') reasons.push('core topic for this round');

  // Rounds are sequential gates: round 1 blocks everything after it.
  const urgency = Math.max(0, 1 - (input.roundSequence - 1) * 0.22);
  priority += urgency * 20;
  if (input.roundSequence === 1) reasons.push('tested in the first (eliminating) round');

  if (input.attempted === 0) {
    priority += 10;
    reasons.push('never attempted');
  }

  if (input.daysSinceActivity !== null && input.daysSinceActivity >= 10 && input.mastery > 0) {
    priority += Math.min(input.daysSinceActivity / 10, 2) * 5;
    reasons.push(`not revised for ${input.daysSinceActivity} days`);
  }

  // A round already in good shape should not hog the plan.
  if (input.roundCompletion >= 85) priority *= 0.6;

  return { priority: round(priority, 2), reasons };
}

export function scoreTopicsForCompany(
  userId: number,
  companyId: number,
  target: Db = sharedDb(),
): { topics: ScoredTopic[]; readiness: CompanyReadiness } {
  const readiness = computeCompanyReadiness(userId, companyId, target);
  const completionByRound = new Map(readiness.rounds.map((r) => [r.roundId, r.completion]));

  const rows = target
    .prepare<[number, number], {
      topic_id: number;
      name: string;
      slug: string;
      category: string;
      est_hours: number;
      weight: number;
      importance: string;
      round_id: number;
      round_name: string;
      round_sequence: number;
      mastery: number | null;
      questions_attempted: number | null;
      last_activity_at: string | null;
    }>(
      `SELECT t.id AS topic_id, t.name, t.slug, t.category, t.est_hours,
              rt.weight, rt.importance,
              r.id AS round_id, r.name AS round_name, r.sequence AS round_sequence,
              tp.mastery, tp.questions_attempted, tp.last_activity_at
       FROM rounds r
       JOIN round_topics rt ON rt.round_id = r.id
       JOIN topics t ON t.id = rt.topic_id
       LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = ?
       WHERE r.company_id = ?
       ORDER BY r.sequence, rt.sequence`,
    )
    .all(userId, companyId);

  // A topic can appear in several rounds; keep the most urgent occurrence.
  const bySlug = new Map<number, ScoredTopic>();
  for (const row of rows) {
    const lastActivity = parseSqlDate(row.last_activity_at);
    const daysSince = lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000) : null;

    const base = {
      topicId: row.topic_id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      mastery: row.mastery ?? 0,
      attempted: row.questions_attempted ?? 0,
      weight: row.weight,
      importance: row.importance,
      roundId: row.round_id,
      roundName: row.round_name,
      roundSequence: row.round_sequence,
      roundCompletion: completionByRound.get(row.round_id) ?? 0,
      estHours: row.est_hours,
      daysSinceActivity: daysSince,
    };
    const { priority, reasons } = scoreTopic(base);
    const scored: ScoredTopic = { ...base, priority, reasons };

    const existing = bySlug.get(row.topic_id);
    if (!existing || scored.priority > existing.priority) bySlug.set(row.topic_id, scored);
  }

  const topics = [...bySlug.values()].sort((a, b) => b.priority - a.priority);
  return { topics, readiness };
}

export interface GenerateOptions {
  horizonDays?: number;
  /** Minutes of study the student can commit per day. */
  minutesPerDay?: number;
}

/**
 * Builds a day-by-day plan.
 *
 * Shape of a plan: study/practice the highest-priority weak topics early, place
 * a sectional mock right after the topics feeding that section, and close the
 * horizon with a round or full company mock so readiness is re-measured.
 */
export function generatePlan(
  userId: number,
  companyId: number,
  options: GenerateOptions = {},
  target: Db = sharedDb(),
): GeneratedPlan {
  const horizonDays = Math.min(Math.max(options.horizonDays ?? defaultHorizon(target), 3), 30);
  const minutesPerDay = Math.min(Math.max(options.minutesPerDay ?? 120, 30), 600);
  const thresholds = loadThresholds(target);

  const { topics, readiness } = scoreTopicsForCompany(userId, companyId, target);
  const mocks = loadCompanyMocks(companyId, target);

  const items: PlanItem[] = [];
  const focus = topics.filter((t) => t.mastery < thresholds.strong);
  // If everything is already strong, the useful work is assessment and revision,
  // not more of the same study.
  const pool = focus.length > 0 ? focus : topics;

  let cursor = 0;
  for (let day = 1; day <= horizonDays; day += 1) {
    const isFinalDay = day === horizonDays;
    const isMidpoint = horizonDays >= 6 && day === Math.ceil(horizonDays / 2);
    let budget = minutesPerDay;

    // ── closing assessment ──
    if (isFinalDay) {
      const capstone = mocks.company ?? mocks.byRound.values().next().value;
      if (capstone) {
        items.push({
          dayIndex: day,
          actionType: mocks.company ? 'company_mock' : 'round_mock',
          mockTestId: capstone.id,
          roundId: capstone.round_id ?? undefined,
          title: `Attempt ${capstone.title}`,
          detail:
            'Close the cycle with a full simulation. Your readiness score and the next plan are recalculated from this result.',
          estMinutes: capstone.duration_minutes,
          priority: 100,
        });
        budget -= capstone.duration_minutes;
      }
    }

    // ── midpoint check-in on the weakest round ──
    if (isMidpoint && !isFinalDay) {
      const weakestRound = [...readiness.rounds].sort((a, b) => a.completion - b.completion)[0];
      const mock = weakestRound ? mocks.byRound.get(weakestRound.roundId) : undefined;
      if (mock) {
        items.push({
          dayIndex: day,
          actionType: 'round_mock',
          mockTestId: mock.id,
          roundId: weakestRound?.roundId,
          title: `Attempt ${mock.title}`,
          detail: `A mid-plan checkpoint on your weakest round (${weakestRound?.roundName} at ${weakestRound?.completion}%). The remaining days re-prioritise from this score.`,
          estMinutes: mock.duration_minutes,
          priority: 90,
        });
        budget -= mock.duration_minutes;
      }
    }

    // ── fill the rest of the day with topic work ──
    let guard = 0;
    while (budget >= 30 && guard < 4) {
      guard += 1;
      const topic = pool[cursor % pool.length];
      if (!topic) break;
      cursor += 1;

      const isCoding = topic.category === 'dsa';
      const studyMinutes = Math.min(Math.max(Math.round(topic.estHours * 30), 45), Math.max(budget, 45));

      items.push({
        dayIndex: day,
        actionType: topic.attempted === 0 ? 'study_topic' : isCoding ? 'coding_practice' : 'practice_topic',
        topicId: topic.topicId,
        roundId: topic.roundId,
        title:
          topic.attempted === 0
            ? `Study ${topic.name}`
            : isCoding
              ? `Solve coding problems on ${topic.name}`
              : `Practise ${topic.name}`,
        detail: buildTopicDetail(topic),
        estMinutes: studyMinutes,
        priority: topic.priority,
      });

      budget -= studyMinutes;
      if (pool.length <= cursor - (day - 1) * 4) break;
    }

    // ── revision day when the pool is exhausted ──
    if (!items.some((item) => item.dayIndex === day)) {
      items.push({
        dayIndex: day,
        actionType: 'revision',
        title: 'Consolidation and revision',
        detail:
          'Revisit your incorrect answers from earlier mocks, redo the questions you marked for review, and re-attempt a sectional on your weakest area.',
        estMinutes: 90,
        priority: 20,
      });
    }
  }

  return {
    companyId,
    horizonDays,
    readiness: readiness.readiness,
    rationale: buildRationale(readiness, topics, horizonDays),
    items,
  };
}

function buildTopicDetail(topic: ScoredTopic): string {
  const reason = topic.reasons.length ? `Why now: ${topic.reasons.join('; ')}.` : '';
  const target =
    topic.mastery < 40
      ? 'Aim to finish the concept material and get 10 questions right before moving on.'
      : topic.mastery < MASTERY_COMPLETE
        ? `Push mastery past ${MASTERY_COMPLETE}% — focus on medium and hard questions, which is where the marks are.`
        : 'Keep this warm with a short revision set.';
  return `${reason} ${target} Appears in ${topic.roundName}.`.trim();
}

function buildRationale(readiness: CompanyReadiness, topics: ScoredTopic[], horizonDays: number): string {
  const strong = readiness.strongTopics.slice(0, 3).map((t) => t.name);
  const weak = topics.slice(0, 4).map((t) => t.name);
  const parts: string[] = [`Your current readiness is ${readiness.readiness}%.`];

  if (strong.length) parts.push(`You are strong in ${listToProse(strong)}.`);
  if (weak.length) parts.push(`The biggest gaps are ${listToProse(weak)}.`);

  const untouched = topics.filter((t) => t.attempted === 0).length;
  if (untouched > 0) parts.push(`${untouched} topic${untouched === 1 ? '' : 's'} on this company's syllabus have no attempts yet.`);

  parts.push(
    `This ${horizonDays}-day plan front-loads the weakest core topics from the earliest rounds and ends with a full simulation so your readiness is re-measured.`,
  );
  return parts.join(' ');
}

function listToProse(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

interface MockRow {
  id: number;
  title: string;
  scope: string;
  round_id: number | null;
  duration_minutes: number;
}

function loadCompanyMocks(companyId: number, target: Db): { company?: MockRow; byRound: Map<number, MockRow> } {
  const rows = target
    .prepare<[number], MockRow>(
      `SELECT id, title, scope, round_id, duration_minutes
       FROM mock_tests WHERE company_id = ? AND is_published = 1
       ORDER BY CASE scope WHEN 'company' THEN 1 WHEN 'round' THEN 2 WHEN 'sectional' THEN 3 ELSE 4 END, id`,
    )
    .all(companyId);

  const byRound = new Map<number, MockRow>();
  for (const row of rows) {
    if (row.scope === 'round' && row.round_id !== null && !byRound.has(row.round_id)) {
      byRound.set(row.round_id, row);
    }
  }
  return { company: rows.find((row) => row.scope === 'company'), byRound };
}

function defaultHorizon(target: Db): number {
  const row = target
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get('roadmap.defaultHorizonDays');
  const parsed = Number(row?.value ?? 7);
  return Number.isFinite(parsed) ? parsed : 7;
}

// ─────────────────────── persistence ───────────────────────

export interface StoredPlan extends GeneratedPlan {
  planId: number;
  generatedAt: string;
  items: (PlanItem & { id: number; isDone: boolean; completedAt: string | null })[];
}

/** Saves a plan as the current one for this student/company pair. */
export function savePlan(userId: number, plan: GeneratedPlan, target: Db = sharedDb()): number {
  target
    .prepare('UPDATE study_plans SET is_current = 0 WHERE user_id = ? AND company_id = ?')
    .run(userId, plan.companyId);

  const info = target
    .prepare(
      `INSERT INTO study_plans (user_id, company_id, horizon_days, readiness_at_generation, rationale, is_current)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(userId, plan.companyId, plan.horizonDays, plan.readiness, plan.rationale);
  const planId = Number(info.lastInsertRowid);

  const insertItem = target.prepare(
    `INSERT INTO study_plan_items (
       plan_id, day_index, action_type, topic_id, round_id, mock_test_id,
       title, detail, est_minutes, priority
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of plan.items) {
    insertItem.run(
      planId,
      item.dayIndex,
      item.actionType,
      item.topicId ?? null,
      item.roundId ?? null,
      item.mockTestId ?? null,
      item.title,
      item.detail,
      item.estMinutes,
      item.priority,
    );
  }

  return planId;
}

export function loadCurrentPlan(userId: number, companyId: number, target: Db = sharedDb()): StoredPlan | null {
  const plan = target
    .prepare<[number, number], {
      id: number;
      horizon_days: number;
      readiness_at_generation: number;
      rationale: string | null;
      generated_at: string;
    }>(
      `SELECT id, horizon_days, readiness_at_generation, rationale, generated_at
       FROM study_plans WHERE user_id = ? AND company_id = ? AND is_current = 1
       ORDER BY id DESC`,
    )
    .get(userId, companyId);
  if (!plan) return null;

  const items = target
    .prepare<[number], {
      id: number;
      day_index: number;
      action_type: ActionType;
      topic_id: number | null;
      round_id: number | null;
      mock_test_id: number | null;
      title: string;
      detail: string | null;
      est_minutes: number;
      priority: number;
      is_done: number;
      completed_at: string | null;
    }>(
      `SELECT id, day_index, action_type, topic_id, round_id, mock_test_id,
              title, detail, est_minutes, priority, is_done, completed_at
       FROM study_plan_items WHERE plan_id = ? ORDER BY day_index, priority DESC, id`,
    )
    .all(plan.id);

  return {
    planId: plan.id,
    companyId,
    horizonDays: plan.horizon_days,
    readiness: plan.readiness_at_generation,
    rationale: plan.rationale ?? '',
    generatedAt: plan.generated_at,
    items: items.map((item) => ({
      id: item.id,
      dayIndex: item.day_index,
      actionType: item.action_type,
      topicId: item.topic_id ?? undefined,
      roundId: item.round_id ?? undefined,
      mockTestId: item.mock_test_id ?? undefined,
      title: item.title,
      detail: item.detail ?? '',
      estMinutes: item.est_minutes,
      priority: item.priority,
      isDone: item.is_done === 1,
      completedAt: item.completed_at,
    })),
  };
}

/**
 * Returns the current plan, regenerating it when it is stale — i.e. the student
 * has submitted a mock since it was created, or it is older than its horizon.
 * This is what makes the roadmap self-updating rather than static.
 */
export function ensureCurrentPlan(
  userId: number,
  companyId: number,
  options: GenerateOptions = {},
  target: Db = sharedDb(),
): StoredPlan {
  const existing = loadCurrentPlan(userId, companyId, target);
  if (existing && !isStale(userId, companyId, existing, target)) return existing;

  const plan = generatePlan(userId, companyId, options, target);
  savePlan(userId, plan, target);
  return loadCurrentPlan(userId, companyId, target)!;
}

function isStale(userId: number, companyId: number, plan: StoredPlan, target: Db): boolean {
  const generatedAt = parseSqlDate(plan.generatedAt);
  if (!generatedAt) return true;

  const ageDays = (Date.now() - generatedAt.getTime()) / 86_400_000;
  if (ageDays > plan.horizonDays) return true;

  const newerAttempt = target
    .prepare<[number, number, string], { count: number }>(
      `SELECT COUNT(*) AS count FROM attempts a
       JOIN mock_tests mt ON mt.id = a.mock_test_id
       WHERE a.user_id = ? AND mt.company_id = ?
         AND a.status IN ('submitted', 'auto_submitted')
         AND a.submitted_at > ?`,
    )
    .get(userId, companyId, plan.generatedAt)!.count;

  return newerAttempt > 0;
}

export function markPlanItem(
  userId: number,
  itemId: number,
  done: boolean,
  target: Db = sharedDb(),
): void {
  const owned = target
    .prepare<[number, number], { count: number }>(
      `SELECT COUNT(*) AS count FROM study_plan_items spi
       JOIN study_plans sp ON sp.id = spi.plan_id
       WHERE spi.id = ? AND sp.user_id = ?`,
    )
    .get(itemId, userId)!.count;
  if (owned === 0) return;

  target
    .prepare("UPDATE study_plan_items SET is_done = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(done ? 1 : 0, done ? 1 : 0, itemId);
}

/**
 * The single "what should I do right now?" answer used on the dashboard.
 * Prefers an unfinished item from today's plan, then the highest-priority gap.
 */
export function nextBestAction(
  userId: number,
  companyId: number,
  target: Db = sharedDb(),
): { title: string; detail: string; actionType: ActionType; topicId?: number; mockTestId?: number; roundId?: number } | null {
  const plan = ensureCurrentPlan(userId, companyId, {}, target);
  const pending = plan.items.find((item) => !item.isDone);
  if (pending) {
    return {
      title: pending.title,
      detail: pending.detail,
      actionType: pending.actionType,
      topicId: pending.topicId,
      mockTestId: pending.mockTestId,
      roundId: pending.roundId,
    };
  }

  const { topics } = scoreTopicsForCompany(userId, companyId, target);
  const weakest = topics[0];
  if (!weakest) return null;
  return {
    title: `Revise ${weakest.name}`,
    detail: `Your plan is complete — regenerate it, or keep sharpening ${weakest.name} (${round(weakest.mastery)}% mastery).`,
    actionType: 'practice_topic',
    topicId: weakest.topicId,
  };
}

export { json };
