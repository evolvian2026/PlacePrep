/**
 * Readiness engine — turns raw activity into the numbers the product is built
 * around: topic mastery, round completion, company readiness and the overall
 * placement-readiness score.
 *
 * Everything here is deterministic and explainable. When a student asks "why is
 * my readiness 68%?", `explainCompanyReadiness` can answer with the actual
 * component contributions rather than an opaque number.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { average, clamp, json, pct, round } from '../lib/util.js';
import type { Difficulty } from '../types.js';

export interface ReadinessWeights {
  topicMastery: number;
  mockPerformance: number;
  coverage: number;
}

export const DEFAULT_WEIGHTS: ReadinessWeights = { topicMastery: 0.45, mockPerformance: 0.4, coverage: 0.15 };

export interface Thresholds {
  weak: number;
  average: number;
  strong: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { weak: 50, average: 70, strong: 85 };

export function loadWeights(target: Db = sharedDb()): ReadinessWeights {
  const row = target
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get('readiness.weights');
  const parsed = json<Partial<ReadinessWeights>>(row?.value, {});
  const merged = { ...DEFAULT_WEIGHTS, ...parsed };
  const total = merged.topicMastery + merged.mockPerformance + merged.coverage;
  if (total <= 0) return DEFAULT_WEIGHTS;
  // Normalise so admins can't accidentally break the scale by editing settings.
  return {
    topicMastery: merged.topicMastery / total,
    mockPerformance: merged.mockPerformance / total,
    coverage: merged.coverage / total,
  };
}

export function loadThresholds(target: Db = sharedDb()): Thresholds {
  const row = target
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get('readiness.thresholds');
  return { ...DEFAULT_THRESHOLDS, ...json<Partial<Thresholds>>(row?.value, {}) };
}

export type Band = 'weak' | 'average' | 'strong' | 'excellent';

export function band(score: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): Band {
  if (score < thresholds.weak) return 'weak';
  if (score < thresholds.average) return 'average';
  if (score < thresholds.strong) return 'strong';
  return 'excellent';
}

// ─────────────────────────── topic mastery ───────────────────────────

/**
 * Blends accuracy with volume and difficulty progression.
 *
 * A student who answered 2 easy questions correctly is not "100% mastered", so
 * accuracy is scaled by a confidence factor that grows with attempts, and a
 * bonus rewards success on harder material.
 */
export function computeMastery(input: {
  attempted: number;
  correct: number;
  easyAttempted: number;
  easyCorrect: number;
  mediumAttempted: number;
  mediumCorrect: number;
  hardAttempted: number;
  hardCorrect: number;
}): number {
  if (input.attempted === 0) return 0;

  const accuracy = input.correct / input.attempted;
  // Confidence saturates around 12 attempts — enough to be meaningful without
  // demanding an unrealistic volume per topic.
  const confidence = Math.min(1, input.attempted / 12);

  const difficultyScore = weightedDifficultyScore(input);

  // 70% accuracy-driven, 30% difficulty-progression-driven, both damped by
  // confidence so low-volume topics never read as mastered.
  const blended = accuracy * 0.7 + difficultyScore * 0.3;
  return round(clamp(blended * (0.55 + 0.45 * confidence) * 100), 1);
}

function weightedDifficultyScore(input: {
  easyAttempted: number;
  easyCorrect: number;
  mediumAttempted: number;
  mediumCorrect: number;
  hardAttempted: number;
  hardCorrect: number;
}): number {
  const parts: { weight: number; value: number }[] = [];
  if (input.easyAttempted > 0) parts.push({ weight: 1, value: input.easyCorrect / input.easyAttempted });
  if (input.mediumAttempted > 0) parts.push({ weight: 2, value: input.mediumCorrect / input.mediumAttempted });
  if (input.hardAttempted > 0) parts.push({ weight: 3, value: input.hardCorrect / input.hardAttempted });
  if (parts.length === 0) return 0;
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  return parts.reduce((sum, p) => sum + p.weight * p.value, 0) / totalWeight;
}

/** Mastery at or above this counts a topic as completed. */
export const MASTERY_COMPLETE = 75;

// ─────────────────────────── company readiness ───────────────────────────

export interface RoundReadiness {
  roundId: number;
  roundName: string;
  roundType: string;
  sequence: number;
  /** 0..100 — weighted mastery across the round's topics. */
  topicCompletion: number;
  /** Best mock percentage for this round, or null if never attempted. */
  bestMockScore: number | null;
  mocksAttempted: number;
  /** Combined completion used for the roadmap progress bar. */
  completion: number;
  status: 'not_started' | 'in_progress' | 'ready' | 'mastered';
  topicsTotal: number;
  topicsCompleted: number;
}

export interface CompanyReadiness {
  companyId: number;
  readiness: number;
  band: Band;
  rounds: RoundReadiness[];
  components: {
    topicMastery: number;
    mockPerformance: number;
    coverage: number;
  };
  weights: ReadinessWeights;
  topicBreakdown: { topicId: number; name: string; slug: string; category: string; mastery: number; attempted: number }[];
  weakTopics: { topicId: number; name: string; slug: string; mastery: number; attempted: number }[];
  strongTopics: { topicId: number; name: string; slug: string; mastery: number; attempted: number }[];
}

interface RoundTopicRow {
  round_id: number;
  round_name: string;
  round_type: string;
  sequence: number;
  topic_id: number;
  topic_name: string;
  topic_slug: string;
  category: string;
  weight: number;
  importance: string;
}

export function computeCompanyReadiness(
  userId: number,
  companyId: number,
  target: Db = sharedDb(),
): CompanyReadiness {
  const weights = loadWeights(target);
  const thresholds = loadThresholds(target);

  const rows = target
    .prepare<[number], RoundTopicRow>(
      `SELECT r.id AS round_id, r.name AS round_name, r.round_type, r.sequence,
              t.id AS topic_id, t.name AS topic_name, t.slug AS topic_slug, t.category,
              rt.weight, rt.importance
       FROM rounds r
       JOIN round_topics rt ON rt.round_id = r.id
       JOIN topics t ON t.id = rt.topic_id
       WHERE r.company_id = ?
       ORDER BY r.sequence, rt.sequence`,
    )
    .all(companyId);

  const progressRows = target
    .prepare<[number], { topic_id: number; mastery: number; questions_attempted: number }>(
      'SELECT topic_id, mastery, questions_attempted FROM topic_progress WHERE user_id = ?',
    )
    .all(userId);
  const masteryByTopic = new Map(progressRows.map((r) => [r.topic_id, r]));

  const mockRows = target
    .prepare<[number, number], { round_id: number | null; percentage: number }>(
      `SELECT mt.round_id, a.percentage
       FROM attempts a
       JOIN mock_tests mt ON mt.id = a.mock_test_id
       WHERE a.user_id = ? AND mt.company_id = ? AND a.status IN ('submitted', 'auto_submitted')`,
    )
    .all(userId, companyId);

  const mocksByRound = new Map<number, number[]>();
  const companyWideMocks: number[] = [];
  for (const row of mockRows) {
    if (row.round_id === null) {
      companyWideMocks.push(row.percentage);
      continue;
    }
    const bucket = mocksByRound.get(row.round_id);
    if (bucket) bucket.push(row.percentage);
    else mocksByRound.set(row.round_id, [row.percentage]);
  }

  // ── per-round aggregation ──
  const roundMap = new Map<number, { info: RoundTopicRow; topics: RoundTopicRow[] }>();
  for (const row of rows) {
    const entry = roundMap.get(row.round_id);
    if (entry) entry.topics.push(row);
    else roundMap.set(row.round_id, { info: row, topics: [row] });
  }

  const rounds: RoundReadiness[] = [];
  for (const { info, topics } of roundMap.values()) {
    let weightSum = 0;
    let masterySum = 0;
    let completed = 0;
    for (const topic of topics) {
      const progress = masteryByTopic.get(topic.topic_id);
      const mastery = progress?.mastery ?? 0;
      weightSum += topic.weight;
      masterySum += topic.weight * mastery;
      if (mastery >= MASTERY_COMPLETE) completed += 1;
    }
    const topicCompletion = weightSum > 0 ? round(masterySum / weightSum, 1) : 0;
    const roundMocks = mocksByRound.get(info.round_id) ?? [];
    const bestMockScore = roundMocks.length ? round(Math.max(...roundMocks), 1) : null;

    // A round is judged mostly on topic mastery, but a good mock score on that
    // round is direct evidence and pulls the number up.
    const completion =
      bestMockScore === null
        ? topicCompletion
        : round(topicCompletion * 0.6 + bestMockScore * 0.4, 1);

    rounds.push({
      roundId: info.round_id,
      roundName: info.round_name,
      roundType: info.round_type,
      sequence: info.sequence,
      topicCompletion,
      bestMockScore,
      mocksAttempted: roundMocks.length,
      completion,
      status: roundStatus(completion, roundMocks.length),
      topicsTotal: topics.length,
      topicsCompleted: completed,
    });
  }
  rounds.sort((a, b) => a.sequence - b.sequence);

  // ── overall components ──
  const allTopics = [...new Map(rows.map((r) => [r.topic_id, r])).values()];
  const topicMasteryComponent = allTopics.length
    ? round(
        allTopics.reduce((sum, t) => sum + t.weight * (masteryByTopic.get(t.topic_id)?.mastery ?? 0), 0) /
          allTopics.reduce((sum, t) => sum + t.weight, 0),
        1,
      )
    : 0;

  const mockScores = [...companyWideMocks, ...[...mocksByRound.values()].flat()];
  // Best score shows peak ability; the recent average shows reliability. Blend
  // them so one lucky paper does not dominate.
  const mockPerformanceComponent = mockScores.length
    ? round(Math.max(...mockScores) * 0.5 + average(mockScores.slice(-5)) * 0.5, 1)
    : 0;

  const touchedTopics = allTopics.filter((t) => (masteryByTopic.get(t.topic_id)?.questions_attempted ?? 0) > 0).length;
  const coverageComponent = allTopics.length ? pct(touchedTopics, allTopics.length) : 0;

  const readiness = round(
    topicMasteryComponent * weights.topicMastery +
      mockPerformanceComponent * weights.mockPerformance +
      coverageComponent * weights.coverage,
    1,
  );

  const topicBreakdown = allTopics
    .map((t) => ({
      topicId: t.topic_id,
      name: t.topic_name,
      slug: t.topic_slug,
      category: t.category,
      mastery: masteryByTopic.get(t.topic_id)?.mastery ?? 0,
      attempted: masteryByTopic.get(t.topic_id)?.questions_attempted ?? 0,
    }))
    .sort((a, b) => a.mastery - b.mastery);

  return {
    companyId,
    readiness,
    band: band(readiness, thresholds),
    rounds,
    components: {
      topicMastery: topicMasteryComponent,
      mockPerformance: mockPerformanceComponent,
      coverage: coverageComponent,
    },
    weights,
    topicBreakdown,
    // "Weak" includes never-attempted topics: an untouched core topic is a real
    // gap, not a neutral one.
    weakTopics: topicBreakdown.filter((t) => t.mastery < thresholds.average).slice(0, 8),
    strongTopics: [...topicBreakdown]
      .filter((t) => t.attempted > 0 && t.mastery >= thresholds.average)
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 8),
  };
}

function roundStatus(completion: number, mocksAttempted: number): RoundReadiness['status'] {
  if (completion <= 0) return 'not_started';
  if (completion >= 85 && mocksAttempted > 0) return 'mastered';
  if (completion >= 70) return 'ready';
  return 'in_progress';
}

/** Human-readable account of how a readiness number was produced. */
export function explainCompanyReadiness(readiness: CompanyReadiness): string {
  const { components, weights } = readiness;
  const parts = [
    `topic mastery ${components.topicMastery}% × ${Math.round(weights.topicMastery * 100)}%`,
    `mock performance ${components.mockPerformance}% × ${Math.round(weights.mockPerformance * 100)}%`,
    `syllabus coverage ${components.coverage}% × ${Math.round(weights.coverage * 100)}%`,
  ];
  return `${readiness.readiness}% = ${parts.join(' + ')}.`;
}

// ───────────────────── overall placement readiness ─────────────────────

export interface OverallReadiness {
  score: number;
  band: Band;
  /** Readiness for the student's primary target, when one is set. */
  primaryCompanyId: number | null;
  perCompany: { companyId: number; slug: string; name: string; readiness: number; status: string }[];
}

export function computeOverallReadiness(userId: number, target: Db = sharedDb()): OverallReadiness {
  const links = target
    .prepare<[number], { company_id: number; slug: string; name: string; status: string; is_primary_target: number }>(
      `SELECT sc.company_id, c.slug, c.name, sc.status, sc.is_primary_target
       FROM student_companies sc JOIN companies c ON c.id = sc.company_id
       WHERE sc.user_id = ?`,
    )
    .all(userId);

  const perCompany = links.map((link) => ({
    companyId: link.company_id,
    slug: link.slug,
    name: link.name,
    readiness: computeCompanyReadiness(userId, link.company_id, target).readiness,
    status: link.status,
  }));

  const primary = links.find((l) => l.is_primary_target === 1) ?? links[0];

  // Overall readiness leans on the primary target — that is the company the
  // student is actually being measured against — with a nudge from the rest.
  const primaryScore = primary
    ? perCompany.find((c) => c.companyId === primary.company_id)?.readiness ?? 0
    : 0;
  const others = perCompany.filter((c) => c.companyId !== primary?.company_id).map((c) => c.readiness);
  const score = primary
    ? round(others.length ? primaryScore * 0.75 + average(others) * 0.25 : primaryScore, 1)
    : 0;

  const thresholds = loadThresholds(target);
  return {
    score,
    band: band(score, thresholds),
    primaryCompanyId: primary?.company_id ?? null,
    perCompany,
  };
}

/** Difficulty-aware section/topic label used across result reports. */
export function labelFor(score: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): string {
  const b = band(score, thresholds);
  return { weak: 'Weak', average: 'Average', strong: 'Strong', excellent: 'Excellent' }[b];
}

export type { Difficulty };
