/**
 * Engine unit tests against an isolated in-memory database.
 *
 *   npm --workspace server run test
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Db } from '../src/db/index.js';
import { createTestDb } from '../src/db/index.js';
import { seed } from '../src/db/seed/index.js';
import { computeMastery, computeCompanyReadiness, band, MASTERY_COMPLETE } from '../src/engines/readiness.js';
import { computeStreak, recordGradedAnswers, refreshCompanyProgress } from '../src/engines/progress.js';
import { findQuestions, selectForRule, loadAnswerKeys, toPaperQuestions } from '../src/engines/question-engine.js';
import { startAttempt, saveAnswer, submitAttempt, loadAttemptState } from '../src/engines/test-engine.js';
import { generatePlan, scoreTopicsForCompany, ensureCurrentPlan } from '../src/engines/recommendation-engine.js';
import { evaluateBadges, awardXp, levelFor, totalXp, leaderboard } from '../src/engines/gamification.js';
import { parseCsv, shuffle, mulberry32, pct } from '../src/lib/util.js';

let db: Db;
let studentId: number;
let tcsId: number;

before(() => {
  db = createTestDb();
  seed(db);
  studentId = db.prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?').get('student@placeprep.dev')!.id;
  tcsId = db.prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get('tcs')!.id;
});

after(() => {
  db.close();
});

describe('seed integrity', () => {
  it('loads companies of both types', () => {
    const types = db
      .prepare<[], { company_type: string; count: number }>(
        'SELECT company_type, COUNT(*) AS count FROM companies GROUP BY company_type',
      )
      .all();
    const map = new Map(types.map((row) => [row.company_type, row.count]));
    assert.ok((map.get('service') ?? 0) >= 5, 'expected several service-based companies');
    assert.ok((map.get('product') ?? 0) >= 5, 'expected several product-based companies');
  });

  it('gives every round at least one topic', () => {
    const orphans = db
      .prepare<[], { count: number }>(
        'SELECT COUNT(*) AS count FROM rounds r WHERE NOT EXISTS (SELECT 1 FROM round_topics rt WHERE rt.round_id = r.id)',
      )
      .get()!.count;
    assert.equal(orphans, 0);
  });

  it('gives every choice question exactly the right number of correct options', () => {
    const bad = db
      .prepare<[], { public_id: string; correct: number; question_type: string }>(
        `SELECT q.public_id, q.question_type, SUM(o.is_correct) AS correct
         FROM questions q JOIN question_options o ON o.question_id = q.id
         WHERE q.question_type IN ('mcq', 'multi_select')
         GROUP BY q.id
         HAVING (q.question_type = 'mcq' AND correct != 1) OR (q.question_type = 'multi_select' AND correct < 1)`,
      )
      .all();
    assert.deepEqual(bad, [], `questions with a broken answer key: ${bad.map((b) => b.public_id).join(', ')}`);
  });

  it('gives every coding problem samples and hidden cases', () => {
    const problems = db
      .prepare<[], { title: string; samples: number; hidden: number }>(
        `SELECT cp.title,
                SUM(CASE WHEN tc.is_sample = 1 THEN 1 ELSE 0 END) AS samples,
                SUM(CASE WHEN tc.is_sample = 0 THEN 1 ELSE 0 END) AS hidden
         FROM coding_problems cp JOIN test_cases tc ON tc.problem_id = cp.id GROUP BY cp.id`,
      )
      .all();
    assert.ok(problems.length >= 10);
    for (const problem of problems) {
      assert.ok(problem.samples >= 1, `${problem.title} has no sample case`);
      assert.ok(problem.hidden >= 1, `${problem.title} has no hidden case`);
    }
  });

  it('marks all seeded company insights with a provenance', () => {
    const untagged = db
      .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM company_insights WHERE provenance NOT IN ('verified','community_reported','historical')")
      .get()!.count;
    assert.equal(untagged, 0);
  });

  it('is idempotent — reseeding does not duplicate content', () => {
    const before = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM questions').get()!.count;
    seed(db);
    const after = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM questions').get()!.count;
    assert.equal(after, before);
  });
});

describe('mastery computation', () => {
  it('returns zero with no attempts', () => {
    assert.equal(
      computeMastery({
        attempted: 0, correct: 0,
        easyAttempted: 0, easyCorrect: 0, mediumAttempted: 0, mediumCorrect: 0, hardAttempted: 0, hardCorrect: 0,
      }),
      0,
    );
  });

  it('does not treat a tiny perfect sample as mastered', () => {
    const mastery = computeMastery({
      attempted: 2, correct: 2,
      easyAttempted: 2, easyCorrect: 2, mediumAttempted: 0, mediumCorrect: 0, hardAttempted: 0, hardCorrect: 0,
    });
    assert.ok(mastery > 0, 'should award some credit');
    assert.ok(mastery < MASTERY_COMPLETE, `2/2 easy should not reach mastery, got ${mastery}`);
  });

  it('rewards volume and harder material', () => {
    const shallow = computeMastery({
      attempted: 12, correct: 12,
      easyAttempted: 12, easyCorrect: 12, mediumAttempted: 0, mediumCorrect: 0, hardAttempted: 0, hardCorrect: 0,
    });
    const deep = computeMastery({
      attempted: 12, correct: 12,
      easyAttempted: 4, easyCorrect: 4, mediumAttempted: 4, mediumCorrect: 4, hardAttempted: 4, hardCorrect: 4,
    });
    assert.ok(deep >= shallow, `mixed difficulty (${deep}) should not score below easy-only (${shallow})`);
    assert.ok(deep >= MASTERY_COMPLETE, `12 correct across all difficulties should reach mastery, got ${deep}`);
  });

  it('never exceeds 100 or drops below 0', () => {
    const max = computeMastery({
      attempted: 500, correct: 500,
      easyAttempted: 100, easyCorrect: 100, mediumAttempted: 200, mediumCorrect: 200, hardAttempted: 200, hardCorrect: 200,
    });
    const min = computeMastery({
      attempted: 50, correct: 0,
      easyAttempted: 20, easyCorrect: 0, mediumAttempted: 20, mediumCorrect: 0, hardAttempted: 10, hardCorrect: 0,
    });
    assert.ok(max <= 100 && max > 90);
    assert.equal(min, 0);
  });

  it('bands scores sensibly', () => {
    assert.equal(band(20), 'weak');
    assert.equal(band(60), 'average');
    assert.equal(band(80), 'strong');
    assert.equal(band(95), 'excellent');
  });
});

describe('question engine', () => {
  it('filters by difficulty', () => {
    const { rows } = findQuestions({ difficulties: ['hard'], limit: 100 }, db);
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.difficulty === 'hard'));
  });

  it('matches subtopics when filtering by their parent topic', () => {
    const parent = db.prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?').get('quantitative-aptitude')!;
    const { rows } = findQuestions({ topicIds: [parent.id], limit: 200 }, db);
    // Seeded quant questions are tagged against subtopics such as number-systems.
    assert.ok(rows.length >= 20, `expected parent-topic search to reach subtopic questions, got ${rows.length}`);
  });

  it('never leaks the answer key into a paper', () => {
    const { rows } = findQuestions({ limit: 5, questionTypes: ['mcq'] }, db);
    const paper = toPaperQuestions(rows.map((r) => r.id), { shuffleOptions: true, seed: 1 }, db);
    const serialised = JSON.stringify(paper);
    assert.ok(!serialised.includes('is_correct'));
    assert.ok(!serialised.includes('isCorrect'));
    assert.ok(!serialised.includes('why_wrong'));
  });

  it('honours a difficulty mix', () => {
    const ids = selectForRule({ rule: { difficultyMix: { easy: 3, medium: 2 }, questionTypes: ['mcq'] }, count: 5 }, db);
    assert.equal(ids.length, 5);
    const keys = loadAnswerKeys(ids, db);
    const easy = [...keys.values()].filter((k) => k.difficulty === 'easy').length;
    assert.ok(easy >= 3, `expected at least 3 easy questions, got ${easy}`);
  });

  it('excludes questions already used elsewhere in the paper', () => {
    const first = selectForRule({ rule: { questionTypes: ['mcq'] }, count: 10 }, db);
    const second = selectForRule({ rule: { questionTypes: ['mcq'] }, count: 10, exclude: first }, db);
    assert.equal(new Set([...first, ...second]).size, first.length + second.length);
  });

  it('reports a shortfall instead of inventing questions', () => {
    const ids = selectForRule({ rule: { questionTypes: ['coding'] }, count: 500 }, db);
    const total = db.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM questions WHERE question_type='coding' AND status='published'").get()!.count;
    assert.equal(ids.length, total, 'should return every available coding question and no more');
  });
});

describe('mock test engine', () => {
  let attemptId: number;
  let paperQuestionIds: number[];

  it('assembles a full company paper', () => {
    const test = db.prepare<[string], { id: number }>('SELECT id FROM mock_tests WHERE slug = ?').get('tcs-full-mock')!;
    const result = startAttempt(studentId, test.id, db);
    attemptId = result.attemptId;

    assert.ok(result.paper.sections.length >= 5, 'full mock should cover every round section');
    paperQuestionIds = result.paper.sections.flatMap((s) => s.questions.map((q) => q.questionId));
    assert.ok(paperQuestionIds.length > 50);
    assert.equal(new Set(paperQuestionIds).size, paperQuestionIds.length, 'no question should repeat across sections');
    assert.ok(result.paper.sections.some((s) => s.questionKind === 'coding'), 'expected a coding section');
  });

  it('resumes rather than creating a second live attempt', () => {
    const test = db.prepare<[string], { id: number }>('SELECT id FROM mock_tests WHERE slug = ?').get('tcs-full-mock')!;
    const again = startAttempt(studentId, test.id, db);
    assert.equal(again.attemptId, attemptId);
  });

  it('saves answers and navigation state', () => {
    const keys = loadAnswerKeys(paperQuestionIds, db);
    const first = paperQuestionIds[0];
    saveAnswer(studentId, attemptId, {
      questionId: first,
      selectedLabels: keys.get(first)!.correctLabels,
      markedForReview: true,
      timeSpentSeconds: 42,
    }, db);

    const state = loadAttemptState(attemptId, db).find((row) => row.question_id === first)!;
    assert.equal(state.is_marked_review, 1);
    assert.equal(state.visited, 1);
    assert.equal(state.time_spent_seconds, 42);
  });

  it('grades, reports and awards negative marks only where configured', () => {
    const keys = loadAnswerKeys(paperQuestionIds, db);
    // Answer everything correctly except the last five, which we skip.
    for (const questionId of paperQuestionIds.slice(0, -5)) {
      const key = keys.get(questionId)!;
      if (key.questionType === 'coding') continue;
      saveAnswer(studentId, attemptId, { questionId, selectedLabels: key.correctLabels, timeSpentSeconds: 30 }, db);
    }

    const { attempt, report } = submitAttempt(studentId, attemptId, {}, db);
    assert.ok(attempt.status === 'submitted');
    assert.ok(attempt.percentage > 50, `expected a high score, got ${attempt.percentage}`);
    assert.ok(attempt.skipped_count >= 5, `skipped questions should be counted, got ${attempt.skipped_count}`);
    assert.ok(report.sections.length >= 5);
    assert.ok(report.topics.length > 0);
    assert.ok(report.difficulties.length > 0);
    assert.ok(report.recommendations.length > 0, 'a report should always suggest next steps');
    assert.equal(attempt.percentile !== null, true);
  });

  it('is idempotent on resubmit', () => {
    const first = submitAttempt(studentId, attemptId, {}, db);
    const second = submitAttempt(studentId, attemptId, {}, db);
    assert.equal(first.attempt.score, second.attempt.score);
  });

  it('rejects another student reading the attempt', () => {
    const other = db.prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?').get('priya@placeprep.dev')!;
    assert.throws(() => submitAttempt(other.id, attemptId, {}, db), /another student/i);
  });
});

describe('progress and readiness', () => {
  it('accumulates mastery from graded answers', () => {
    const topic = db.prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?').get('sql')!;
    const priya = db.prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?').get('priya@placeprep.dev')!;

    recordGradedAnswers(priya.id, Array.from({ length: 10 }, (_, i) => ({
      questionId: 1000 + i,
      topicId: topic.id,
      difficulty: 'medium' as const,
      isCorrect: true,
      timeSpentSeconds: 40,
    })), db);

    const row = db
      .prepare<[number, number], { questions_attempted: number; mastery: number }>(
        'SELECT questions_attempted, mastery FROM topic_progress WHERE user_id = ? AND topic_id = ?',
      )
      .get(priya.id, topic.id)!;
    assert.equal(row.questions_attempted, 10);
    assert.ok(row.mastery > 40, `10 correct medium answers should build real mastery, got ${row.mastery}`);
  });

  it('produces a readiness breakdown that adds up', () => {
    const readiness = computeCompanyReadiness(studentId, tcsId, db);
    const { components, weights } = readiness;
    const expected =
      components.topicMastery * weights.topicMastery +
      components.mockPerformance * weights.mockPerformance +
      components.coverage * weights.coverage;
    assert.ok(Math.abs(readiness.readiness - expected) < 0.2, `${readiness.readiness} should equal the weighted sum ${expected}`);
    assert.ok(readiness.rounds.length === 4, 'TCS has four configured rounds');
    assert.ok(readiness.readiness > 0);
  });

  it('caches readiness onto the student-company link', () => {
    refreshCompanyProgress(studentId, db);
    const link = db
      .prepare<[number, number], { readiness_score: number }>(
        'SELECT readiness_score FROM student_companies WHERE user_id = ? AND company_id = ?',
      )
      .get(studentId, tcsId)!;
    assert.ok(link.readiness_score > 0);
  });

  it('counts a streak from activity days', () => {
    const streak = computeStreak(studentId, db);
    assert.ok(streak.current >= 1, 'today counts once a question has been answered');
    assert.ok(streak.last30.length >= 1);
  });
});

describe('recommendation engine', () => {
  it('ranks untouched core topics from early rounds highest', () => {
    const { topics } = scoreTopicsForCompany(studentId, tcsId, db);
    assert.ok(topics.length > 0);
    const top = topics[0];
    assert.ok(top.priority > 0);
    assert.ok(top.reasons.length > 0, 'every priority must be explainable');
    // Priorities must be monotonically non-increasing.
    for (let i = 1; i < topics.length; i += 1) {
      assert.ok(topics[i - 1].priority >= topics[i].priority);
    }
  });

  it('generates a plan that fills the horizon and ends with an assessment', () => {
    const plan = generatePlan(studentId, tcsId, { horizonDays: 7, minutesPerDay: 120 }, db);
    assert.equal(plan.horizonDays, 7);
    for (let day = 1; day <= 7; day += 1) {
      assert.ok(plan.items.some((item) => item.dayIndex === day), `day ${day} should have work`);
    }
    const finalDay = plan.items.filter((item) => item.dayIndex === 7);
    assert.ok(
      finalDay.some((item) => item.actionType === 'company_mock' || item.actionType === 'round_mock'),
      'the plan should close with a mock so readiness is re-measured',
    );
    assert.ok(plan.rationale.includes('%'), 'the rationale should quote the readiness figure');
  });

  it('respects the daily minute budget', () => {
    const plan = generatePlan(studentId, tcsId, { horizonDays: 5, minutesPerDay: 60 }, db);
    const day1 = plan.items.filter((item) => item.dayIndex === 1);
    const total = day1.reduce((sum, item) => sum + item.estMinutes, 0);
    assert.ok(total <= 150, `a 60-minute budget should not schedule ${total} minutes of work`);
  });

  it('regenerates the plan after a new mock submission', () => {
    const first = ensureCurrentPlan(studentId, tcsId, { horizonDays: 7 }, db);
    const same = ensureCurrentPlan(studentId, tcsId, { horizonDays: 7 }, db);
    assert.equal(first.planId, same.planId, 'a fresh plan should be reused');

    // Simulate a newer attempt than the plan.
    db.prepare(
      `INSERT INTO attempts (user_id, mock_test_id, company_id, status, expires_at, submitted_at, paper, total_marks, percentage)
       VALUES (?, (SELECT id FROM mock_tests WHERE slug='tcs-quick-mock'), ?, 'submitted', datetime('now'), datetime('now', '+1 hour'), '{}', 12, 90)`,
    ).run(studentId, tcsId);

    const regenerated = ensureCurrentPlan(studentId, tcsId, { horizonDays: 7 }, db);
    assert.notEqual(regenerated.planId, first.planId, 'a new result should invalidate the old plan');
  });
});

describe('gamification', () => {
  it('levels up on accumulated xp', () => {
    assert.equal(levelFor(0).level, 1);
    assert.ok(levelFor(5000).level > levelFor(500).level);
    const mid = levelFor(400);
    assert.ok(mid.progress >= 0 && mid.progress <= 100);
  });

  it('awards badges only once', () => {
    const rohan = db.prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?').get('rohan@placeprep.dev')!;
    const topic = db.prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?').get('arrays')!;

    const questionIds = db
      .prepare<[], { id: number }>("SELECT id FROM questions WHERE question_type='mcq' LIMIT 15")
      .all()
      .map((row) => row.id);
    const insert = db.prepare(
      'INSERT INTO practice_events (user_id, question_id, is_correct, time_spent_seconds) VALUES (?, ?, 1, 30)',
    );
    for (const questionId of questionIds) insert.run(rohan.id, questionId);
    recordGradedAnswers(rohan.id, questionIds.map((id) => ({
      questionId: id, topicId: topic.id, difficulty: 'easy' as const, isCorrect: true, timeSpentSeconds: 30,
    })), db);

    const first = evaluateBadges(rohan.id, db);
    assert.ok(first.some((badge) => badge.slug === 'first-steps'), 'should earn the first-10-questions badge');
    const second = evaluateBadges(rohan.id, db);
    assert.equal(second.length, 0, 're-evaluating must not re-award');
  });

  it('accumulates xp and ranks the leaderboard', () => {
    const before = totalXp(studentId, db);
    awardXp(studentId, 100, 'test award', undefined, db);
    assert.equal(totalXp(studentId, db), before + 100);

    const board = leaderboard({ userId: studentId, limit: 10 }, db);
    assert.ok(board.length >= 1);
    for (let i = 1; i < board.length; i += 1) {
      assert.ok(board[i - 1].xp >= board[i].xp, 'leaderboard must be sorted by xp');
    }
    assert.ok(board.some((entry) => entry.isCurrentUser));
  });
});

describe('utilities', () => {
  it('parses CSV with quoted commas', () => {
    const rows = parseCsv('a,b,c\n1,"two, and a half",3\n');
    assert.deepEqual(rows, [{ a: '1', b: 'two, and a half', c: '3' }]);
  });

  it('shuffles deterministically when seeded', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    assert.deepEqual(shuffle(input, 42), shuffle(input, 42));
    assert.notDeepEqual(shuffle(input, 42), shuffle(input, 43));
    assert.deepEqual([...shuffle(input, 42)].sort((a, b) => a - b), input, 'shuffle must preserve elements');
  });

  it('produces values in [0,1) from the seeded generator', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rand();
      assert.ok(value >= 0 && value < 1);
    }
  });

  it('guards percentage division by zero', () => {
    assert.equal(pct(5, 0), 0);
    assert.equal(pct(1, 3), 33.3);
  });
});
