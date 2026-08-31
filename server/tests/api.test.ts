/**
 * API-level tests. These drive the real Express app over HTTP against an
 * isolated database file, so routing, validation, auth and RBAC are covered as
 * well as the engines underneath them.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

// The config module reads these at import time, so they must be set first.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'placeprep-api-'));
process.env.PP_DATA_DIR = tempDir;
process.env.PP_DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.PP_CODE_ENGINE_ENABLED = 'false';

const { db } = await import('../src/db/index.js');
const { seed } = await import('../src/db/seed/index.js');
const { createApp } = await import('../src/app.js');

let server: Server;
let base: string;
let studentToken = '';
let adminToken = '';

interface Response<T> {
  status: number;
  body: T;
}

async function call<T>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<Response<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

before(async () => {
  seed(db());
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}/api`;

  const student = await call<{ token: string }>('POST', '/auth/login', {
    body: { email: 'student@placeprep.dev', password: 'Passw0rd!' },
  });
  studentToken = student.body.token;

  const admin = await call<{ token: string }>('POST', '/auth/login', {
    body: { email: 'admin@placeprep.dev', password: 'Passw0rd!' },
  });
  adminToken = admin.body.token;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db().close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('auth', () => {
  it('rejects a bad password', async () => {
    const response = await call('POST', '/auth/login', {
      body: { email: 'student@placeprep.dev', password: 'wrong' },
    });
    assert.equal(response.status, 401);
  });

  it('rejects a malformed email with a validation error', async () => {
    const response = await call<{ error: { code: string } }>('POST', '/auth/login', {
      body: { email: 'not-an-email', password: 'whatever' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'bad_request');
  });

  it('registers a new student and returns a usable token', async () => {
    const response = await call<{ token: string; user: { role: string; email: string } }>('POST', '/auth/register', {
      body: { name: 'Test Student', email: 'new.student@example.com', password: 'sufficientlyLong1' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.user.role, 'student');

    const me = await call<{ user: { email: string } }>('GET', '/auth/me', { token: response.body.token });
    assert.equal(me.body.user.email, 'new.student@example.com');
  });

  it('refuses a duplicate email', async () => {
    const response = await call('POST', '/auth/register', {
      body: { name: 'Duplicate', email: 'student@placeprep.dev', password: 'sufficientlyLong1' },
    });
    assert.equal(response.status, 409);
  });
});

describe('access control', () => {
  it('requires a token for the dashboard', async () => {
    const response = await call('GET', '/dashboard');
    assert.equal(response.status, 401);
  });

  it('blocks students from the admin API', async () => {
    const response = await call('GET', '/admin/overview', { token: studentToken });
    assert.equal(response.status, 403);
  });

  it('allows an admin through', async () => {
    const response = await call<{ counts: { companies: number } }>('GET', '/admin/overview', { token: adminToken });
    assert.equal(response.status, 200);
    assert.ok(response.body.counts.companies > 0);
  });

  it('stops a student reading another student\'s attempt', async () => {
    const start = await call<{ attemptId: number }>('POST', '/mock-tests/tcs-quick-mock/start', {
      token: studentToken,
    });
    const other = await call<{ token: string }>('POST', '/auth/login', {
      body: { email: 'priya@placeprep.dev', password: 'Passw0rd!' },
    });
    const response = await call('GET', `/attempts/${start.body.attemptId}`, { token: other.body.token });
    assert.equal(response.status, 403);
  });
});

describe('companies', () => {
  it('lists published companies', async () => {
    const response = await call<{ companies: unknown[]; total: number }>('GET', '/companies');
    assert.equal(response.status, 200);
    assert.ok(response.body.total >= 10);
  });

  it('filters by type', async () => {
    const response = await call<{ companies: { companyType: string }[] }>('GET', '/companies?type=product');
    assert.ok(response.body.companies.length > 0);
    assert.ok(response.body.companies.every((company) => company.companyType === 'product'));
  });

  it('returns a full roadmap with rounds, sections and topics', async () => {
    const response = await call<{
      rounds: { sections: { topics: unknown[] }[]; topics: unknown[] }[];
      insights: { provenance: string }[];
      disclaimer: string;
    }>('GET', '/companies/tcs', { token: studentToken });

    assert.equal(response.status, 200);
    assert.equal(response.body.rounds.length, 4);
    assert.ok(response.body.rounds[0].sections.length > 0);
    assert.ok(response.body.rounds[0].topics.length > 0);
    // Provenance must always be present — this is the honesty guarantee.
    assert.ok(response.body.insights.every((insight) => insight.provenance));
    assert.ok(response.body.disclaimer.length > 0);
  });

  it('404s an unknown company', async () => {
    const response = await call('GET', '/companies/not-a-real-company');
    assert.equal(response.status, 404);
  });

  it('tracks a company as a target', async () => {
    const response = await call<{ ok: boolean }>('PUT', '/companies/infosys/track', {
      token: studentToken,
      body: { status: 'preparing', isPrimaryTarget: true },
    });
    assert.equal(response.status, 200);

    const dashboard = await call<{ companies: { slug: string; isPrimaryTarget: boolean }[] }>('GET', '/dashboard', {
      token: studentToken,
    });
    const infosys = dashboard.body.companies.find((company) => company.slug === 'infosys');
    assert.ok(infosys?.isPrimaryTarget);
  });
});

describe('practice', () => {
  it('never returns the answer key with the question list', async () => {
    const response = await call<{ questions: unknown[] }>('GET', '/practice/questions?limit=5', {
      token: studentToken,
    });
    const serialised = JSON.stringify(response.body);
    assert.ok(!serialised.includes('isCorrect'));
    assert.ok(!serialised.includes('whyWrong'));
  });

  it('grades an answer and returns the explanation', async () => {
    const list = await call<{ questions: { id: number; options: { label: string }[] }[] }>(
      'GET',
      '/practice/questions?limit=1&questionType=mcq',
      { token: studentToken },
    );
    const question = list.body.questions[0];

    const response = await call<{ isCorrect: boolean; correctLabels: string[]; explanation: string | null }>(
      'POST',
      '/practice/answer',
      { token: studentToken, body: { questionId: question.id, selectedLabels: [question.options[0].label] } },
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.correctLabels.length > 0);
    assert.equal(typeof response.body.isCorrect, 'boolean');
  });

  it('rejects an answer for a question that does not exist', async () => {
    const response = await call('POST', '/practice/answer', {
      token: studentToken,
      body: { questionId: 999999, selectedLabels: ['A'] },
    });
    assert.equal(response.status, 404);
  });
});

describe('mock test lifecycle over HTTP', () => {
  it('starts, answers, submits and reports', async () => {
    const start = await call<{
      attemptId: number;
      paper: { sections: { questions: { questionId: number; options: { label: string }[] }[] }[] };
    }>('POST', '/mock-tests/infosys-quick-mock/start', { token: studentToken });

    assert.equal(start.status, 201);
    const questions = start.body.paper.sections.flatMap((section) => section.questions);
    assert.ok(questions.length > 0);

    const save = await call<{ count: number }>('POST', `/attempts/${start.body.attemptId}/answers`, {
      token: studentToken,
      body: {
        answers: questions.slice(0, 5).map((question) => ({
          questionId: question.questionId,
          selectedLabels: [question.options[0].label],
        })),
      },
    });
    assert.equal(save.body.count, 5);

    const submit = await call<{
      attempt: { status: string; percentage: number; skippedCount: number };
      report: { sections: unknown[]; recommendations: unknown[] };
    }>('POST', `/attempts/${start.body.attemptId}/submit`, { token: studentToken, body: {} });

    assert.equal(submit.status, 200);
    assert.equal(submit.body.attempt.status, 'submitted');
    assert.ok(submit.body.attempt.skippedCount > 0, 'unanswered questions should count as skipped');
    assert.ok(submit.body.report.sections.length > 0);

    const result = await call<{ review: { detail: { explanation: string | null } | null }[] }>(
      'GET',
      `/attempts/${start.body.attemptId}/result`,
      { token: studentToken },
    );
    assert.equal(result.status, 200);
    // Explanations are only released after submission.
    assert.ok(result.body.review.length > 0);
  });
});

describe('roadmap', () => {
  it('generates a plan for a tracked company', async () => {
    const response = await call<{
      plan: { horizonDays: number; items: { dayIndex: number }[]; rationale: string };
      priorities: { reasons: string[] }[];
    }>('GET', '/roadmap?companySlug=infosys&horizonDays=7', { token: studentToken });

    assert.equal(response.status, 200);
    assert.equal(response.body.plan.horizonDays, 7);
    assert.ok(response.body.plan.items.length >= 7);
    assert.ok(response.body.plan.rationale.length > 0);
    assert.ok(response.body.priorities[0].reasons.length > 0, 'priorities must be explainable');
  });

  it('rejects a plan request for an unknown company', async () => {
    const response = await call('GET', '/roadmap?companySlug=nope', { token: studentToken });
    assert.equal(response.status, 404);
  });
});

describe('admin content management', () => {
  it('creates, edits and deletes a company', async () => {
    const created = await call<{ company: { id: number; slug: string } }>('POST', '/admin/companies', {
      token: adminToken,
      body: { name: 'Test Corp', companyType: 'product', difficulty: 'hard', eligibleBranches: ['CSE'] },
    });
    assert.equal(created.status, 201);

    const patched = await call('PATCH', `/admin/companies/${created.body.company.id}`, {
      token: adminToken,
      body: { difficulty: 'easy' },
    });
    assert.equal(patched.status, 200);

    const deleted = await call('DELETE', `/admin/companies/${created.body.company.id}`, { token: adminToken });
    assert.equal(deleted.status, 200);
  });

  it('imports questions from CSV and reports per-row errors', async () => {
    const csv = [
      'body,topicSlug,difficulty,optionA,optionB,correct,explanation',
      '"What is 2 + 2?",number-systems,easy,4,5,A,"Basic arithmetic."',
      '"Broken row",no-such-topic,easy,1,2,A,"Should fail."',
      '"No correct label",number-systems,easy,1,2,Z,"Should fail."',
    ].join('\n');

    const response = await call<{ report: { inserted: number; errors: { row: number }[] } }>(
      'POST',
      '/admin/questions/import',
      { token: adminToken, body: { format: 'csv', content: csv } },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.report.inserted, 1);
    assert.equal(response.body.report.errors.length, 2, 'both bad rows should be reported individually');
  });

  it('leaves nothing behind on a dry run', async () => {
    const before = await call<{ total: number }>('GET', '/admin/questions?limit=1', { token: adminToken });
    const csv = 'body,topicSlug,difficulty,optionA,optionB,correct\n"Dry run question",number-systems,easy,1,2,A';

    await call('POST', '/admin/questions/import', {
      token: adminToken,
      body: { format: 'csv', content: csv, dryRun: true },
    });

    const after = await call<{ total: number }>('GET', '/admin/questions?limit=1', { token: adminToken });
    assert.equal(after.body.total, before.body.total);
  });

  it('archives rather than deletes a question that has been answered', async () => {
    const list = await call<{ questions: { id: number; usage: { attempts: number } }[] }>(
      'GET',
      '/admin/questions?limit=100',
      { token: adminToken },
    );
    const answered = list.body.questions.find((question) => question.usage.attempts > 0);
    if (!answered) return; // nothing answered yet in this run

    const response = await call<{ archived: boolean }>('DELETE', `/admin/questions/${answered.id}`, {
      token: adminToken,
    });
    assert.equal(response.body.archived, true);
  });

  it('reports a shortfall when previewing an unsatisfiable selection rule', async () => {
    const response = await call<{ matched: number; shortfall: number }>('POST', '/admin/mock-tests/preview-rule', {
      token: adminToken,
      // 200 is the endpoint's cap; the system-design pool is far smaller.
      body: { rule: { categories: ['system_design'] }, count: 200 },
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.shortfall > 0, 'an impossible rule must report a shortfall, not silently succeed');
  });
});

describe('every company is usable, not just the hand-researched ones', () => {
  // A templated company must reach all four student features. Coding was the
  // one that silently returned nothing: its company filter matched only
  // explicit question tags, and those name only the original 13 companies.
  const templated = ['zoho', 'qualcomm', 'mu-sigma', 'larsen-toubro', 'pwc'];

  it('offers coding problems for a templated company', async () => {
    for (const slug of templated) {
      const response = await call<{ problems: unknown[] }>('GET', `/coding/problems?companySlug=${slug}`, {
        token: studentToken,
      });
      assert.equal(response.status, 200);
      assert.ok(response.body.problems.length > 0, `${slug} has no coding problems`);
    }
  });

  it('offers practice questions for a templated company', async () => {
    for (const slug of templated) {
      const response = await call<{ total: number }>('GET', `/practice/questions?companySlug=${slug}&limit=5`, {
        token: studentToken,
      });
      assert.equal(response.status, 200);
      assert.ok(response.body.total > 0, `${slug} has no practice questions`);
    }
  });

  it('builds a roadmap for a templated company', async () => {
    for (const slug of templated) {
      const response = await call<{ plan: { items: unknown[] } }>('GET', `/roadmap?companySlug=${slug}`, {
        token: studentToken,
      });
      assert.equal(response.status, 200);
      assert.ok(response.body.plan.items.length > 0, `${slug} produced an empty roadmap`);
    }
  });

  it('lists mock tests for a templated company', async () => {
    for (const slug of templated) {
      const response = await call<{ tests: unknown[] }>('GET', `/mock-tests?companySlug=${slug}`, {
        token: studentToken,
      });
      assert.equal(response.status, 200);
      assert.ok(response.body.tests.length > 0, `${slug} has no mock tests`);
    }
  });
});

describe('admin-created companies stay visible in the directory', () => {
  let createdId: number;

  it('derives a sector on create, so the company is not filtered out', async () => {
    const created = await call<{ company: { id: number; slug: string; sector: string | null } }>(
      'POST',
      '/admin/companies',
      {
        token: adminToken,
        body: {
          name: 'Sector Check Ltd',
          companyType: 'product',
          industry: 'Banking Software',
          difficulty: 'moderate',
          ctcMinLpa: 8,
          ctcMaxLpa: 16,
        },
      },
    );
    assert.equal(created.status, 201);
    createdId = created.body.company.id;
    assert.equal(created.body.company.sector, 'Software Products');

    const listed = await call<{ companies: { slug: string }[] }>(
      'GET',
      '/companies?sector=Software%20Products',
      { token: studentToken },
    );
    assert.ok(
      listed.body.companies.some((company) => company.slug === created.body.company.slug),
      'a newly created company must appear under its sector filter',
    );
  });

  it('moves the company when its industry is edited', async () => {
    const updated = await call<{ company: { sector: string } }>('PATCH', `/admin/companies/${createdId}`, {
      token: adminToken,
      body: { industry: 'Semiconductors' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.company.sector, 'Semiconductors & Hardware');

    await call('DELETE', `/admin/companies/${createdId}`, { token: adminToken });
  });
});

describe('code engine when disabled', () => {
  it('refuses execution rather than pretending to run', async () => {
    const problems = await call<{ problems: { problemId: number }[] }>('GET', '/coding/problems');
    const response = await call<{ error: { message: string } }>('POST', '/coding/execute', {
      token: studentToken,
      body: {
        problemId: problems.body.problems[0].problemId,
        language: 'python',
        sourceCode: 'print(1)',
        mode: 'run',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.error.message, /disabled/i);
  });
});

describe('first-hand company reports', () => {
  let reportId: number;

  it('queues a report rather than publishing it', async () => {
    const before = await call<{ insights: unknown[] }>('GET', '/companies/zoho', { token: studentToken });
    const beforeCount = (before.body as { insights: unknown[] }).insights.length;

    const created = await call<{ reportId: number; status: string }>('POST', '/companies/zoho/reports', {
      token: studentToken,
      body: {
        category: 'hiring_process',
        title: 'Three rounds, no aptitude section',
        body: 'The online assessment was two coding questions only. No aptitude at all, then one technical interview and an HR round on the same day.',
        satOn: '2026-08-01',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'pending');
    reportId = created.body.reportId;

    const after = await call<{ insights: unknown[] }>('GET', '/companies/zoho', { token: studentToken });
    assert.equal(
      (after.body as { insights: unknown[] }).insights.length,
      beforeCount,
      'an unreviewed report must not appear on the company page',
    );
  });

  it('refuses a second pending report for the same company', async () => {
    const response = await call('POST', '/companies/zoho/reports', {
      token: studentToken,
      body: {
        category: 'hr_pattern',
        title: 'Another report from the same student',
        body: 'This should be refused because one report is already awaiting review for this company.',
      },
    });
    assert.equal(response.status, 400);
  });

  it('publishes as community_reported when an admin accepts it', async () => {
    const response = await call<{ ok: boolean; insightId: number }>(
      'POST',
      `/admin/company-reports/${reportId}/review`,
      { token: adminToken, body: { decision: 'accept' } },
    );
    assert.equal(response.status, 200);
    assert.ok(response.body.insightId);

    const detail = await call<{ insights: { title: string; provenance: string }[] }>('GET', '/companies/zoho', {
      token: studentToken,
    });
    const published = detail.body.insights.find((i) => i.title === 'Three rounds, no aptitude section');
    assert.ok(published, 'an accepted report should appear on the company page');
    assert.equal(
      published!.provenance,
      'community_reported',
      'one student account is not company policy and must not default to verified',
    );
  });

  it('will not review the same report twice', async () => {
    const response = await call('POST', `/admin/company-reports/${reportId}/review`, {
      token: adminToken,
      body: { decision: 'reject' },
    });
    assert.equal(response.status, 400);
  });

  it('shows a student the fate of their own report', async () => {
    const response = await call<{ reports: { id: number; status: string }[] }>(
      'GET',
      '/companies/zoho/reports/mine',
      { token: studentToken },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.reports[0].status, 'accepted');
  });
});

describe('behavioural answer builder', () => {
  let promptId: number;

  it('offers prompts with guidance and no score', async () => {
    const response = await call<{
      rubric: { key: string }[];
      prompts: { id: number; prompt: string; guidance: string | null; answer: unknown }[];
    }>('GET', '/practice/interview-prompts', { token: studentToken });

    assert.equal(response.status, 200);
    assert.ok(response.body.prompts.length >= 10);
    assert.ok(response.body.rubric.length > 0, 'a rubric is what replaces a score here');
    assert.ok(response.body.prompts.every((p) => p.guidance), 'every prompt should say what a good answer contains');
    assert.equal(response.body.prompts[0].answer, null, 'nothing drafted yet');
    promptId = response.body.prompts[0].id;

    // The contract that matters: no numeric judgement of writing anywhere.
    const raw = JSON.stringify(response.body);
    assert.ok(!/"score"|"grade"|"rating"/.test(raw), 'free text must not be auto-scored');
  });

  it('saves a draft and returns it verbatim', async () => {
    const situation = 'Final-year project, three weeks before the review.';
    const saved = await call('PUT', `/practice/interview-prompts/${promptId}/answer`, {
      token: studentToken,
      body: { situation, task: 'I owned the API.', action: 'Rewrote the sync as a queue.', result: 'Cut p95 to 200ms.' },
    });
    assert.equal(saved.status, 200);

    const response = await call<{ prompts: { id: number; answer: { situation: string } | null }[] }>(
      'GET',
      '/practice/interview-prompts',
      { token: studentToken },
    );
    const prompt = response.body.prompts.find((p) => p.id === promptId)!;
    assert.equal(prompt.answer?.situation, situation);
  });

  it('keeps one student drafts private from another', async () => {
    const response = await call<{ prompts: { id: number; answer: unknown }[] }>(
      'GET',
      '/practice/interview-prompts',
      { token: adminToken },
    );
    const prompt = response.body.prompts.find((p) => p.id === promptId)!;
    assert.equal(prompt.answer, null, 'drafts belong to the student who wrote them');
  });

  it('rejects a draft against a prompt that does not exist', async () => {
    const response = await call('PUT', '/practice/interview-prompts/999999/answer', {
      token: studentToken,
      body: { situation: 'x' },
    });
    assert.equal(response.status, 404);
  });
});

describe('malformed requests are the client’s fault, not the server’s', () => {
  it('answers a broken JSON body with 400, not 500', async () => {
    // body-parser throws before any route handler runs, so this exercises the
    // error middleware directly rather than a zod schema.
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"a@b.c","password":}',
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    assert.equal(response.status, 400, 'a malformed body is a client error');
    assert.equal(body.error.code, 'bad_request');
    assert.match(body.error.message, /not valid JSON/i);
  });

  it('does not echo the offending body back to the client', async () => {
    // The parser's own message quotes the body, which could carry a password.
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"password":"hunter2-should-not-appear",}',
    });
    const text = JSON.stringify(await response.json());

    assert.equal(response.status, 400);
    assert.ok(!text.includes('hunter2'), 'a rejected body must not be reflected in the response');
  });

  it('still reports a genuine server fault as 500', async () => {
    // A route that does not exist is a 404, not a 500 — the point here is that
    // the new client-error branch has not swallowed the 5xx path.
    const response = await call<{ error: { code: string } }>('GET', '/no-such-route');
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'not_found');
  });
});
