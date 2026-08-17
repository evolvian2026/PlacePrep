import bcrypt from 'bcryptjs';
import type { Db } from '../index.js';
import { db as sharedDb } from '../index.js';
import { config } from '../../config.js';
import { addDays, slugify, stringify, today } from '../../lib/util.js';
import type { Difficulty } from '../../types.js';
import { TOPICS } from './topics.js';
import { COMPANIES, type CompanySeed, type RoundSeed } from './companies.js';
import { APTITUDE_QUESTIONS } from './questions-aptitude.js';
import { REASONING_QUESTIONS } from './questions-reasoning.js';
import { VERBAL_QUESTIONS } from './questions-verbal.js';
import { TECHNICAL_QUESTIONS } from './questions-technical.js';
import { BEHAVIOURAL_QUESTIONS } from './questions-behavioural.js';
import { CODING_PROBLEMS } from './questions-coding.js';
import { BADGES, CHALLENGES } from './gamification.js';
import type { McqSeed } from './types.js';

const ALL_MCQ: McqSeed[] = [
  ...APTITUDE_QUESTIONS,
  ...REASONING_QUESTIONS,
  ...VERBAL_QUESTIONS,
  ...TECHNICAL_QUESTIONS,
  ...BEHAVIOURAL_QUESTIONS,
];

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface SeedResult {
  topics: number;
  companies: number;
  rounds: number;
  sections: number;
  questions: number;
  codingProblems: number;
  mockTests: number;
  users: number;
  badges: number;
}

/**
 * Idempotent and non-destructive to student data.
 *
 * Content rows are upserted on their natural keys (company slug, question
 * public_id, mock-test slug, badge slug…) so their primary keys stay stable.
 * That matters because `attempt_answers`, `practice_events`, `topic_progress`,
 * `student_companies`, `attempts` and `user_badges` all point at those ids — a
 * delete-and-reinsert seed would cascade student history away. Only purely
 * derived rows (round topics, sections, options, test cases) are rebuilt, and
 * those are referenced by value rather than by id.
 */
export function seed(target: Db = sharedDb()): SeedResult {
  const run = target.transaction((): SeedResult => {
    clearDerived(target);

    const topicIds = seedTopics(target);
    const { companyIds, roundIds, sectionIds, roundCount, sectionCount } = seedCompanies(target, topicIds);
    const questionIds = seedQuestions(target, topicIds, companyIds);
    const codingCount = seedCodingProblems(target, topicIds, companyIds, questionIds);
    const mockTests = seedMockTests(target, companyIds, roundIds, sectionIds, topicIds);
    const badgeCount = seedBadges(target, companyIds);
    seedChallenges(target, companyIds);
    seedSettings(target);
    const users = seedUsers(target, companyIds);

    return {
      topics: topicIds.size,
      companies: companyIds.size,
      rounds: roundCount,
      sections: sectionCount,
      questions: questionIds.size,
      codingProblems: codingCount,
      mockTests,
      users,
      badges: badgeCount,
    };
  });

  return run();
}

/**
 * Clears only rows that are fully re-derivable from the seed files and that no
 * student-owned row references by id.
 *
 * Safe to wipe, and why:
 *   round_topics, sections   — pure roadmap structure
 *   resources                — reference material
 *   company_insights         — editorial text
 *   question_options         — attempts store option *labels* ('A'), not ids
 *   test_cases               — submissions reference the problem, not the case
 *   mock_test_sections       — a live paper is a frozen JSON snapshot on the
 *                              attempt row, so it does not read these back
 *   mock_test_questions      — curated pins, rebuilt from the blueprint
 *
 * Never wiped here: companies, rounds, questions, coding_problems, mock_tests,
 * badges, challenges — all upserted in place to keep their ids.
 */
function clearDerived(target: Db): void {
  const tables = [
    'mock_test_questions',
    'mock_test_sections',
    'test_cases',
    'question_options',
    'question_tags',
    'resources',
    'round_topics',
    'sections',
    'company_insights',
  ];
  for (const table of tables) target.prepare(`DELETE FROM ${table}`).run();
}

// ───────────────────────────── topics ─────────────────────────────

function seedTopics(target: Db): Map<string, number> {
  const ids = new Map<string, number>();
  // Upsert on slug: topic ids are referenced by topic_progress and study plans.
  const upsert = target.prepare(
    `INSERT INTO topics (slug, name, parent_id, category, description, est_hours, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       parent_id = excluded.parent_id,
       category = excluded.category,
       description = excluded.description,
       est_hours = excluded.est_hours,
       sort_order = excluded.sort_order`,
  );
  const lookup = target.prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?');

  const write = (
    slug: string,
    name: string,
    parentId: number | null,
    category: string,
    description: string | null,
    estHours: number,
    sortOrder: number,
  ): number => {
    upsert.run(slug, name, parentId, category, description, estHours, sortOrder);
    // lastInsertRowid is meaningless on the UPDATE path, so read the id back.
    const id = lookup.get(slug)!.id;
    ids.set(slug, id);
    return id;
  };

  TOPICS.forEach((topic, index) => {
    const parentId = write(
      topic.slug,
      topic.name,
      null,
      topic.category,
      topic.description ?? null,
      topic.estHours ?? 2,
      (index + 1) * 10,
    );

    (topic.subtopics ?? []).forEach((sub, subIndex) => {
      write(sub.slug, sub.name, parentId, topic.category, null, sub.estHours ?? 2, (subIndex + 1) * 10);
    });
  });

  return ids;
}

// ──────────────────────── companies & rounds ────────────────────────

function seedCompanies(
  target: Db,
  topicIds: Map<string, number>,
): {
  companyIds: Map<string, number>;
  roundIds: Map<string, number>;
  sectionIds: Map<string, number>;
  roundCount: number;
  sectionCount: number;
} {
  const companyIds = new Map<string, number>();
  const roundIds = new Map<string, number>();
  const sectionIds = new Map<string, number>();
  let roundCount = 0;
  let sectionCount = 0;

  // Companies and rounds are upserted: student_companies, attempts and
  // round_progress all reference these ids.
  const insertCompany = target.prepare(
    `INSERT INTO companies (
       slug, name, logo_text, brand_color, company_type, industry, description, difficulty,
       hiring_frequency, eligible_branches, eligible_years, min_cgpa, ctc_min_lpa, ctc_max_lpa,
       roles_offered, locations, expected_prep_weeks, is_published, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, logo_text = excluded.logo_text, brand_color = excluded.brand_color,
       company_type = excluded.company_type, industry = excluded.industry,
       description = excluded.description, difficulty = excluded.difficulty,
       hiring_frequency = excluded.hiring_frequency, eligible_branches = excluded.eligible_branches,
       eligible_years = excluded.eligible_years, min_cgpa = excluded.min_cgpa,
       ctc_min_lpa = excluded.ctc_min_lpa, ctc_max_lpa = excluded.ctc_max_lpa,
       roles_offered = excluded.roles_offered, locations = excluded.locations,
       expected_prep_weeks = excluded.expected_prep_weeks, sort_order = excluded.sort_order,
       updated_at = datetime('now')`,
  );
  const lookupCompany = target.prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?');

  const insertRound = target.prepare(
    `INSERT INTO rounds (
       company_id, slug, name, round_type, sequence, description, duration_minutes, difficulty,
       elimination, estimated_prep_hours, negative_marking, section_lock
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id, slug) DO UPDATE SET
       name = excluded.name, round_type = excluded.round_type, sequence = excluded.sequence,
       description = excluded.description, duration_minutes = excluded.duration_minutes,
       difficulty = excluded.difficulty, elimination = excluded.elimination,
       estimated_prep_hours = excluded.estimated_prep_hours,
       negative_marking = excluded.negative_marking, section_lock = excluded.section_lock,
       updated_at = datetime('now')`,
  );
  const lookupRound = target.prepare<[number, string], { id: number }>(
    'SELECT id FROM rounds WHERE company_id = ? AND slug = ?',
  );
  const insertSection = target.prepare(
    `INSERT INTO sections (
       round_id, slug, name, sequence, question_count, duration_minutes,
       marks_per_question, negative_marks, question_kind
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRoundTopic = target.prepare(
    `INSERT OR IGNORE INTO round_topics (round_id, topic_id, section_id, weight, importance, sequence)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertInsight = target.prepare(
    `INSERT INTO company_insights (company_id, category, title, body, provenance, source_label, as_of, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  COMPANIES.forEach((company, companyIndex) => {
    insertCompany.run(
      company.slug,
      company.name,
      company.logoText,
      company.brandColor,
      company.companyType,
      company.industry,
      company.description,
      company.difficulty,
      company.hiringFrequency,
      stringify(company.eligibleBranches),
      stringify(company.eligibleYears),
      company.minCgpa ?? null,
      company.ctcMinLpa,
      company.ctcMaxLpa,
      stringify(company.rolesOffered),
      stringify(company.locations),
      company.expectedPrepWeeks,
      (companyIndex + 1) * 10,
    );
    const companyId = lookupCompany.get(company.slug)!.id;
    companyIds.set(company.slug, companyId);

    company.insights.forEach((insight, index) => {
      insertInsight.run(
        companyId,
        insight.category,
        insight.title,
        insight.body,
        insight.provenance ?? 'community_reported',
        insight.sourceLabel ?? null,
        insight.asOf ?? null,
        (index + 1) * 10,
      );
    });

    company.rounds.forEach((round, roundIndex) => {
      insertRound.run(
        companyId,
        round.slug,
        round.name,
        round.roundType,
        roundIndex + 1,
        round.description,
        round.durationMinutes ?? null,
        round.difficulty ?? 'moderate',
        round.elimination === false ? 0 : 1,
        round.estimatedPrepHours ?? 10,
        round.negativeMarking ?? 0,
        round.sectionLock ? 1 : 0,
      );
      const roundId = lookupRound.get(companyId, round.slug)!.id;
      roundIds.set(`${company.slug}/${round.slug}`, roundId);
      roundCount += 1;

      let topicSequence = 0;
      round.sections.forEach((section, sectionIndex) => {
        const sectionInfo = insertSection.run(
          roundId,
          section.slug,
          section.name,
          sectionIndex + 1,
          section.questionCount,
          section.durationMinutes ?? null,
          section.marksPerQuestion ?? 1,
          section.negativeMarks ?? round.negativeMarking ?? 0,
          section.questionKind ?? 'mcq',
        );
        const sectionId = Number(sectionInfo.lastInsertRowid);
        sectionIds.set(`${company.slug}/${round.slug}/${section.slug}`, sectionId);
        sectionCount += 1;

        for (const topicSlug of section.topics) {
          const topicId = topicIds.get(topicSlug);
          if (!topicId) throw new Error(`Unknown topic "${topicSlug}" in ${company.slug}/${round.slug}`);
          topicSequence += 10;
          insertRoundTopic.run(roundId, topicId, sectionId, 1, 'core', topicSequence);
        }
      });

      for (const topicSlug of round.extraTopics ?? []) {
        const topicId = topicIds.get(topicSlug);
        if (!topicId) throw new Error(`Unknown extra topic "${topicSlug}" in ${company.slug}/${round.slug}`);
        topicSequence += 10;
        insertRoundTopic.run(roundId, topicId, null, 0.6, 'recommended', topicSequence);
      }
    });
  });

  seedResources(target, topicIds);

  return { companyIds, roundIds, sectionIds, roundCount, sectionCount };
}

/**
 * Recommended resources. Deliberately description-only (no external URLs) so the
 * seed never ships links that may rot; admins add their own institute material.
 */
const RESOURCE_TEMPLATES: { topicSlug: string; items: { title: string; type: string; minutes: number }[] }[] = [
  {
    topicSlug: 'quantitative-aptitude',
    items: [
      { title: 'Speed-maths shortcuts: multiplication, squares and percentages', type: 'cheatsheet', minutes: 45 },
      { title: 'Sectional drill: 30 questions in 25 minutes', type: 'practice', minutes: 25 },
    ],
  },
  {
    topicSlug: 'logical-reasoning',
    items: [
      { title: 'Arrangement puzzles: a repeatable grid method', type: 'article', minutes: 40 },
      { title: 'Syllogism Venn-diagram walkthrough', type: 'video', minutes: 25 },
    ],
  },
  {
    topicSlug: 'verbal-ability',
    items: [{ title: 'Common grammar traps in placement papers', type: 'cheatsheet', minutes: 30 }],
  },
  {
    topicSlug: 'dbms',
    items: [
      { title: 'Normalisation from 1NF to BCNF with worked examples', type: 'article', minutes: 60 },
      { title: 'ACID and isolation levels explained through anomalies', type: 'article', minutes: 40 },
    ],
  },
  {
    topicSlug: 'sql',
    items: [
      { title: 'Joins visualised: inner, left, right and full', type: 'video', minutes: 35 },
      { title: 'Window functions: RANK vs DENSE_RANK vs ROW_NUMBER', type: 'article', minutes: 30 },
    ],
  },
  {
    topicSlug: 'oops',
    items: [{ title: 'The four pillars with interview-ready code examples', type: 'article', minutes: 50 }],
  },
  {
    topicSlug: 'operating-systems',
    items: [
      { title: 'Scheduling algorithms compared on one worked timeline', type: 'article', minutes: 45 },
      { title: 'Deadlocks: the four Coffman conditions and how to break each', type: 'article', minutes: 30 },
    ],
  },
  {
    topicSlug: 'computer-networks',
    items: [{ title: 'What happens when you type a URL — layer by layer', type: 'article', minutes: 40 }],
  },
  {
    topicSlug: 'arrays',
    items: [
      { title: 'Two pointers and sliding window: when each applies', type: 'article', minutes: 45 },
      { title: 'Prefix sums and their range-query tricks', type: 'article', minutes: 30 },
    ],
  },
  {
    topicSlug: 'dynamic-programming',
    items: [
      { title: 'From recursion to memoisation to tabulation', type: 'article', minutes: 75 },
      { title: 'The five DP patterns that cover most interviews', type: 'article', minutes: 60 },
    ],
  },
  {
    topicSlug: 'graphs',
    items: [{ title: 'BFS, DFS and when shortest path needs Dijkstra', type: 'article', minutes: 60 }],
  },
  {
    topicSlug: 'trees',
    items: [{ title: 'Traversals, BST validation and common tree patterns', type: 'article', minutes: 55 }],
  },
  {
    topicSlug: 'hr-interview',
    items: [
      { title: 'Building your 90-second introduction', type: 'article', minutes: 25 },
      { title: 'STAR stories: a worksheet for six common themes', type: 'practice', minutes: 60 },
    ],
  },
  {
    topicSlug: 'system-design-basics',
    items: [{ title: 'Scaling a read-heavy service: caches, replicas, shards', type: 'article', minutes: 70 }],
  },
];

function seedResources(target: Db, topicIds: Map<string, number>): void {
  const insert = target.prepare(
    `INSERT INTO resources (topic_id, title, resource_type, provider, est_minutes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const template of RESOURCE_TEMPLATES) {
    const topicId = topicIds.get(template.topicSlug);
    if (!topicId) continue;
    template.items.forEach((item, index) => {
      insert.run(topicId, item.title, item.type, 'PlacePrep Library', item.minutes, (index + 1) * 10);
    });
  }
}

// ───────────────────────────── questions ─────────────────────────────

function seedQuestions(
  target: Db,
  topicIds: Map<string, number>,
  companyIds: Map<string, number>,
): Map<string, number> {
  const ids = new Map<string, number>();
  const insertQuestion = target.prepare(
    `INSERT INTO questions (
       public_id, question_type, body, topic_id, subtopic_id, difficulty, marks, negative_marks,
       expected_seconds, explanation, concept_note, hint, provenance, frequently_asked, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'authored', ?, 'published')
     ON CONFLICT(public_id) DO UPDATE SET
       question_type = excluded.question_type, body = excluded.body, topic_id = excluded.topic_id,
       subtopic_id = excluded.subtopic_id, difficulty = excluded.difficulty, marks = excluded.marks,
       negative_marks = excluded.negative_marks, expected_seconds = excluded.expected_seconds,
       explanation = excluded.explanation, concept_note = excluded.concept_note, hint = excluded.hint,
       frequently_asked = excluded.frequently_asked, status = excluded.status,
       updated_at = datetime('now')`,
  );
  const lookupQuestion = target.prepare<[string], { id: number }>('SELECT id FROM questions WHERE public_id = ?');
  const insertOption = target.prepare(
    `INSERT INTO question_options (question_id, label, body, is_correct, why_wrong, sequence)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertTag = target.prepare(
    `INSERT OR IGNORE INTO question_tags (question_id, company_id, round_type, section_slug)
     VALUES (?, ?, ?, NULL)`,
  );

  for (const question of ALL_MCQ) {
    const topicId = topicIds.get(question.topic);
    if (!topicId) throw new Error(`Question ${question.id} references unknown topic "${question.topic}"`);
    const subtopicId = question.subtopic ? topicIds.get(question.subtopic) ?? null : null;
    if (question.subtopic && !subtopicId) {
      throw new Error(`Question ${question.id} references unknown subtopic "${question.subtopic}"`);
    }
    const correctCount = question.options.filter((o) => o.correct).length;
    if (correctCount === 0) throw new Error(`Question ${question.id} has no correct option`);
    if (!question.multiSelect && correctCount > 1) {
      throw new Error(`Question ${question.id} is single-select but has ${correctCount} correct options`);
    }

    insertQuestion.run(
      question.id,
      question.multiSelect ? 'multi_select' : 'mcq',
      question.body,
      topicId,
      subtopicId,
      question.difficulty,
      1,
      0,
      question.expectedSeconds ?? 60,
      question.explanation,
      question.concept ?? null,
      question.hint ?? null,
      question.frequentlyAsked ? 1 : 0,
    );
    const questionId = lookupQuestion.get(question.id)!.id;
    ids.set(question.id, questionId);

    question.options.forEach((option, index) => {
      insertOption.run(
        questionId,
        OPTION_LABELS[index],
        option.body,
        option.correct ? 1 : 0,
        option.whyWrong ?? null,
        index,
      );
    });

    tagQuestion(insertTag, questionId, question.companies, question.roundTypes, companyIds);
  }

  return ids;
}

/**
 * Writes company/round-type applicability rows. A question with no company list
 * gets one row per round type with a NULL company, meaning "available to all".
 */
function tagQuestion(
  insertTag: { run: (...args: unknown[]) => unknown },
  questionId: number,
  companies: string[] | undefined,
  roundTypes: string[] | undefined,
  companyIds: Map<string, number>,
): void {
  const types = roundTypes && roundTypes.length ? roundTypes : [null];
  const companyKeys = companies && companies.length ? companies : [null];

  for (const companySlug of companyKeys) {
    const companyId = companySlug ? companyIds.get(companySlug) ?? null : null;
    if (companySlug && !companyId) throw new Error(`Unknown company slug "${companySlug}" on question ${questionId}`);
    for (const roundType of types) {
      insertTag.run(questionId, companyId, roundType);
    }
  }
}

function seedCodingProblems(
  target: Db,
  topicIds: Map<string, number>,
  companyIds: Map<string, number>,
  questionIds: Map<string, number>,
): number {
  const insertQuestion = target.prepare(
    `INSERT INTO questions (
       public_id, question_type, body, topic_id, subtopic_id, difficulty, marks, negative_marks,
       expected_seconds, explanation, concept_note, hint, provenance, frequently_asked, status
     ) VALUES (?, 'coding', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'authored', ?, 'published')
     ON CONFLICT(public_id) DO UPDATE SET
       body = excluded.body, topic_id = excluded.topic_id, subtopic_id = excluded.subtopic_id,
       difficulty = excluded.difficulty, marks = excluded.marks,
       expected_seconds = excluded.expected_seconds, explanation = excluded.explanation,
       concept_note = excluded.concept_note, hint = excluded.hint,
       frequently_asked = excluded.frequently_asked, updated_at = datetime('now')`,
  );
  const lookupQuestion = target.prepare<[string], { id: number }>('SELECT id FROM questions WHERE public_id = ?');
  // coding_problems.id is referenced by code_submissions, so upsert on question_id.
  const insertProblem = target.prepare(
    `INSERT INTO coding_problems (
       question_id, title, input_format, output_format, constraints, time_limit_ms,
       memory_limit_mb, allowed_languages, starter_code, reference_solution, editorial
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(question_id) DO UPDATE SET
       title = excluded.title, input_format = excluded.input_format,
       output_format = excluded.output_format, constraints = excluded.constraints,
       time_limit_ms = excluded.time_limit_ms, memory_limit_mb = excluded.memory_limit_mb,
       allowed_languages = excluded.allowed_languages, starter_code = excluded.starter_code,
       reference_solution = excluded.reference_solution, editorial = excluded.editorial`,
  );
  const lookupProblem = target.prepare<[number], { id: number }>('SELECT id FROM coding_problems WHERE question_id = ?');
  const insertCase = target.prepare(
    `INSERT INTO test_cases (problem_id, input, expected, is_sample, explanation, weight, sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertTag = target.prepare(
    `INSERT OR IGNORE INTO question_tags (question_id, company_id, round_type, section_slug)
     VALUES (?, ?, ?, NULL)`,
  );

  for (const problem of CODING_PROBLEMS) {
    const topicId = topicIds.get(problem.topic);
    if (!topicId) throw new Error(`Coding problem ${problem.id} references unknown topic "${problem.topic}"`);
    const subtopicId = problem.subtopic ? topicIds.get(problem.subtopic) ?? null : null;

    insertQuestion.run(
      problem.id,
      problem.body,
      topicId,
      subtopicId,
      problem.difficulty,
      marksForDifficulty(problem.difficulty),
      problem.expectedSeconds ?? 600,
      problem.editorial,
      problem.concept ?? null,
      problem.hint ?? null,
      problem.frequentlyAsked ? 1 : 0,
    );
    const questionId = lookupQuestion.get(problem.id)!.id;
    questionIds.set(problem.id, questionId);

    insertProblem.run(
      questionId,
      problem.title,
      problem.inputFormat,
      problem.outputFormat,
      problem.constraints,
      problem.timeLimitMs ?? 2000,
      problem.memoryLimitMb ?? 256,
      stringify(problem.allowedLanguages ?? ['python', 'javascript', 'c', 'cpp', 'java']),
      stringify(problem.starterCode ?? {}),
      problem.referencePython,
      problem.editorial,
    );
    const problemId = lookupProblem.get(questionId)!.id;

    let sequence = 0;
    for (const sample of problem.samples) {
      insertCase.run(problemId, sample.input, sample.expected, 1, sample.explanation ?? null, 1, sequence);
      sequence += 1;
    }
    for (const hidden of problem.hidden) {
      insertCase.run(problemId, hidden.input, hidden.expected, 0, null, 1, sequence);
      sequence += 1;
    }

    tagQuestion(insertTag, questionId, problem.companies, ['coding'], companyIds);
  }

  return CODING_PROBLEMS.length;
}

function marksForDifficulty(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 20;
  if (difficulty === 'medium') return 35;
  return 50;
}

// ──────────────────────────── mock tests ────────────────────────────

/**
 * Builds four tiers of mock test per company, derived from its configured rounds:
 *   • one company-wide full mock (every round's sections)
 *   • one round mock per round
 *   • one sectional mock per section
 *   • one quick 12-question mock
 * Sections carry selection rules rather than fixed questions, so the question
 * engine assembles a fresh paper for every attempt.
 */
function seedMockTests(
  target: Db,
  companyIds: Map<string, number>,
  roundIds: Map<string, number>,
  _sectionIds: Map<string, number>,
  topicIds: Map<string, number>,
): number {
  const insertTest = target.prepare(
    `INSERT INTO mock_tests (
       slug, title, description, company_id, round_id, scope, duration_minutes, total_marks,
       difficulty, negative_marking, shuffle_questions, shuffle_options, section_lock,
       allow_review, fullscreen_required, is_published
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, 1)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title, description = excluded.description, company_id = excluded.company_id,
       round_id = excluded.round_id, scope = excluded.scope,
       duration_minutes = excluded.duration_minutes, total_marks = excluded.total_marks,
       difficulty = excluded.difficulty, negative_marking = excluded.negative_marking,
       shuffle_options = excluded.shuffle_options, section_lock = excluded.section_lock,
       fullscreen_required = excluded.fullscreen_required, updated_at = datetime('now')`,
  );
  const lookupTest = target.prepare<[string], { id: number }>('SELECT id FROM mock_tests WHERE slug = ?');
  const insertSection = target.prepare(
    `INSERT INTO mock_test_sections (
       mock_test_id, name, sequence, question_count, duration_minutes,
       marks_per_question, negative_marks, question_kind, selection_rule
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let count = 0;

  // A section's rule names the topic pool and the question kind; the engine
  // prefers questions tagged for the test's own company but falls back to the
  // shared bank so a paper is never short.
  const rule = (topics: string[], kind: string): string => {
    const ids = topics.map((slug) => topicIds.get(slug)).filter((id): id is number => Boolean(id));
    return stringify({
      topicIds: ids,
      questionTypes: kind === 'coding' ? ['coding'] : ['mcq', 'multi_select'],
    });
  };

  for (const company of COMPANIES) {
    const companyId = companyIds.get(company.slug)!;

    // ── Full company mock ──
    const allSections = company.rounds.flatMap((round) =>
      round.sections.map((section) => ({ round, section })),
    );
    const fullDuration = allSections.reduce(
      (total, { section, round }) =>
        total + (section.durationMinutes ?? Math.round((round.durationMinutes ?? 30) / round.sections.length)),
      0,
    );
    const fullMarks = allSections.reduce(
      (total, { section }) => total + section.questionCount * (section.marksPerQuestion ?? 1),
      0,
    );
    const fullSlug = `${company.slug}-full-mock`;
    insertTest.run(
      fullSlug,
      `${company.name} Full Mock`,
      `Simulates the complete ${company.name} assessment across every configured round.`,
      companyId,
      null,
      'company',
      fullDuration,
      fullMarks,
      company.difficulty,
      company.rounds[0]?.negativeMarking ?? 0,
      1,
      company.rounds.some((r) => r.sectionLock) ? 1 : 0,
      1,
    );
    const fullId = lookupTest.get(fullSlug)!.id;
    allSections.forEach(({ round, section }, index) => {
      insertSection.run(
        fullId,
        `${round.name.replace(/^Round \d+ — /, '')} · ${section.name}`,
        index + 1,
        section.questionCount,
        section.durationMinutes ?? null,
        section.marksPerQuestion ?? 1,
        section.negativeMarks ?? round.negativeMarking ?? 0,
        section.questionKind ?? 'mcq',
        rule(section.topics, section.questionKind ?? 'mcq'),
      );
    });
    count += 1;

    // ── Round mocks ──
    for (const round of company.rounds) {
      const roundId = roundIds.get(`${company.slug}/${round.slug}`)!;
      const duration =
        round.durationMinutes ??
        round.sections.reduce((total, section) => total + (section.durationMinutes ?? 20), 0);
      const marks = round.sections.reduce(
        (total, section) => total + section.questionCount * (section.marksPerQuestion ?? 1),
        0,
      );
      const roundSlug = `${company.slug}-${round.slug}-mock`;
      insertTest.run(
        roundSlug,
        `${company.name} · ${round.name.replace(/^Round \d+ — /, '')} Mock`,
        `A full simulation of ${company.name}'s ${round.name.replace(/^Round \d+ — /, '').toLowerCase()} round.`,
        companyId,
        roundId,
        'round',
        duration,
        marks,
        round.difficulty ?? company.difficulty,
        round.negativeMarking ?? 0,
        1,
        round.sectionLock ? 1 : 0,
        0,
      );
      const roundMockId = lookupTest.get(roundSlug)!.id;
      round.sections.forEach((section, index) => {
        insertSection.run(
          roundMockId,
          section.name,
          index + 1,
          section.questionCount,
          section.durationMinutes ?? null,
          section.marksPerQuestion ?? 1,
          section.negativeMarks ?? round.negativeMarking ?? 0,
          section.questionKind ?? 'mcq',
          rule(section.topics, section.questionKind ?? 'mcq'),
        );
      });
      count += 1;

      // ── Sectional mocks ──
      for (const section of round.sections) {
        const sectionalCount = Math.min(section.questionCount, section.questionKind === 'coding' ? 1 : 15);
        const sectionalSlug = `${company.slug}-${round.slug}-${section.slug}-sectional`;
        insertTest.run(
          sectionalSlug,
          `${company.name} · ${section.name} Sectional`,
          `Focused practice on ${section.name.toLowerCase()} as tested by ${company.name}.`,
          companyId,
          roundId,
          'sectional',
          section.durationMinutes ?? 20,
          sectionalCount * (section.marksPerQuestion ?? 1),
          round.difficulty ?? company.difficulty,
          section.negativeMarks ?? 0,
          1,
          0,
          0,
        );
        insertSection.run(
          lookupTest.get(sectionalSlug)!.id,
          section.name,
          1,
          sectionalCount,
          section.durationMinutes ?? 20,
          section.marksPerQuestion ?? 1,
          section.negativeMarks ?? 0,
          section.questionKind ?? 'mcq',
          rule(section.topics, section.questionKind ?? 'mcq'),
        );
        count += 1;
      }
    }

    // ── Quick mock ──
    const quickTopics = uniqueTopicSlugs(company.rounds).slice(0, 12);
    const quickSlug = `${company.slug}-quick-mock`;
    insertTest.run(
      quickSlug,
      `${company.name} Quick Mock`,
      `A 12-question warm-up drawn from the topics ${company.name} tests most.`,
      companyId,
      null,
      'quick',
      15,
      12,
      company.difficulty,
      0,
      1,
      0,
      0,
    );
    insertSection.run(
      lookupTest.get(quickSlug)!.id,
      'Mixed Warm-up',
      1,
      12,
      15,
      1,
      0,
      'mcq',
      rule(quickTopics, 'mcq'),
    );
    count += 1;
  }

  return count;
}

function uniqueTopicSlugs(rounds: RoundSeed[]): string[] {
  const slugs = new Set<string>();
  for (const round of rounds) {
    for (const section of round.sections) {
      if ((section.questionKind ?? 'mcq') === 'coding') continue;
      for (const topic of section.topics) slugs.add(topic);
    }
  }
  return [...slugs];
}

// ──────────────────────── gamification & settings ────────────────────────

function seedBadges(target: Db, companyIds: Map<string, number>): number {
  const insert = target.prepare(
    `INSERT INTO badges (slug, name, description, icon, tier, criteria, xp_reward, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, description = excluded.description, icon = excluded.icon,
       tier = excluded.tier, criteria = excluded.criteria, xp_reward = excluded.xp_reward,
       company_id = excluded.company_id`,
  );
  for (const badge of BADGES) {
    insert.run(
      badge.slug,
      badge.name,
      badge.description,
      badge.icon,
      badge.tier,
      stringify(badge.criteria),
      badge.xpReward,
      badge.companySlug ? companyIds.get(badge.companySlug) ?? null : null,
    );
  }
  return BADGES.length;
}

function seedChallenges(target: Db, companyIds: Map<string, number>): void {
  const insert = target.prepare(
    `INSERT INTO challenges (slug, title, description, starts_on, ends_on, goal_type, goal_count, xp_reward, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title, description = excluded.description, starts_on = excluded.starts_on,
       ends_on = excluded.ends_on, goal_type = excluded.goal_type, goal_count = excluded.goal_count,
       xp_reward = excluded.xp_reward, company_id = excluded.company_id`,
  );
  const start = today();
  for (const challenge of CHALLENGES) {
    const startsOn = addDays(start, challenge.startsInDays);
    insert.run(
      challenge.slug,
      challenge.title,
      challenge.description,
      startsOn,
      addDays(startsOn, challenge.durationDays),
      challenge.goalType,
      challenge.goalCount,
      challenge.xpReward,
      challenge.companySlug ? companyIds.get(challenge.companySlug) ?? null : null,
    );
  }
}

function seedSettings(target: Db): void {
  const insert = target.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  );
  const defaults: Record<string, unknown> = {
    'platform.name': 'PlacePrep',
    'platform.tagline': 'Company-specific placement preparation',
    'readiness.weights': { topicMastery: 0.45, mockPerformance: 0.4, coverage: 0.15 },
    'readiness.thresholds': { weak: 50, average: 70, strong: 85 },
    'practice.defaultBatchSize': 10,
    'gamification.xp': { correctAnswer: 5, codingAccepted: 40, mockCompleted: 60, topicMastered: 100 },
    'roadmap.defaultHorizonDays': 7,
    'content.disclaimer':
      'Round structures, eligibility rules and CTC bands on this platform are indicative, compiled from publicly discussed campus-placement experiences. They are not official statements of any company’s recruitment policy and change every hiring season. Verify current details with your placement cell.',
  };
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, typeof value === 'string' ? value : stringify(value));
  }
}

// ───────────────────────────── demo users ─────────────────────────────

function seedUsers(target: Db, companyIds: Map<string, number>): number {
  const password = bcrypt.hashSync(config.seed.demoPassword, 10);
  const insert = target.prepare(
    `INSERT INTO users (email, password_hash, name, role, college, branch, graduation_year, cgpa, avatar_seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
  );

  const demoUsers = [
    {
      email: 'admin@placeprep.dev',
      name: 'Platform Admin',
      role: 'super_admin',
      college: null,
      branch: null,
      year: null,
      cgpa: null,
    },
    {
      email: 'faculty@placeprep.dev',
      name: 'Training & Placement Officer',
      role: 'faculty',
      college: 'Demo Institute of Technology',
      branch: null,
      year: null,
      cgpa: null,
    },
    {
      email: 'student@placeprep.dev',
      name: 'Aarav Sharma',
      role: 'student',
      college: 'Demo Institute of Technology',
      branch: 'CSE',
      year: 2026,
      cgpa: 8.1,
    },
    {
      email: 'priya@placeprep.dev',
      name: 'Priya Nair',
      role: 'student',
      college: 'Demo Institute of Technology',
      branch: 'IT',
      year: 2026,
      cgpa: 8.6,
    },
    {
      email: 'rohan@placeprep.dev',
      name: 'Rohan Verma',
      role: 'student',
      college: 'Demo Institute of Technology',
      branch: 'ECE',
      year: 2027,
      cgpa: 7.4,
    },
  ] as const;

  let created = 0;
  for (const user of demoUsers) {
    const info = insert.run(
      user.email,
      password,
      user.name,
      user.role,
      user.college,
      user.branch,
      user.year,
      user.cgpa,
      slugify(user.name),
    );
    if (info.changes > 0) created += 1;
  }

  // Give the primary demo student a couple of target companies so the dashboard
  // has something to show on a fresh install.
  const student = target
    .prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?')
    .get('student@placeprep.dev');
  if (student) {
    const link = target.prepare(
      `INSERT INTO student_companies (user_id, company_id, status, is_primary_target)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, company_id) DO NOTHING`,
    );
    const tcs = companyIds.get('tcs');
    const amazon = companyIds.get('amazon');
    if (tcs) link.run(student.id, tcs, 'preparing', 1);
    if (amazon) link.run(student.id, amazon, 'interested', 0);
  }

  return created;
}
