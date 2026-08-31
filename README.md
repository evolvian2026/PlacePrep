# PlacePrep

A company-specific placement preparation platform. A student picks a target
company and gets its hiring process, a round-by-round roadmap, topic practice, a
realistic mock-test engine, a coding judge, and a preparation plan that rewrites
itself as their scores change.

```
Company roadmap → Round preparation → Topic practice → Mock test
      ↑                                                    │
      └──── AI recommendations ← Performance analysis ←─────┘
```

---

## Quick start

```bash
npm install          # installs the server and client workspaces
npm run db:reset     # creates the SQLite database, migrates and seeds it
npm run dev          # API on :4000, client on :5173 with proxying
```

Open <http://localhost:5173>.

### Demo logins (password `Passw0rd!`)

| Email | Role | What you see |
|---|---|---|
| `student@placeprep.dev` | Student | Dashboard, roadmap, practice, mocks, coding |
| `faculty@placeprep.dev` | Faculty | Everything above plus the admin console (read/author) |
| `admin@placeprep.dev` | Super admin | Full admin console including delete and role changes |

### Single-process deployment

```bash
npm run build        # compiles the server and bundles the client
npm start            # serves the API and the built client from :4000
                     # first run seeds the catalogue automatically
```

The API serves `client/dist` when it exists, so one process hosts everything.

---

## What is in the box

**171 companies** across 11 sectors, with 650 rounds, 930 sections and 105
topics between them. They come from two catalogues, and the difference matters:

- **13 hand-researched companies** — 7 service-based (TCS, Infosys, Wipro,
  Accenture, Cognizant, Capgemini, Deloitte) and 6 product-based (Amazon,
  Microsoft, Google, Adobe, Salesforce, Walmart). Their rounds, durations and
  quirks reflect how these companies are actually known to hire.
- **158 templated companies** — the rest of the employers that recruit on
  Indian campuses, mapped onto one of ten *hiring-process archetypes*
  (mass-hiring services, product SDE loop, semiconductor, quant finance, core
  engineering…). Their round structure is a realistic pattern for that kind of
  employer, **not** a researched account of that company's process.

Every templated company carries that caveat as a `community_reported` insight,
shown as a banner on its roadmap tab. Nothing generic is ever presented as
verified company policy — see [Company data is marked with its provenance](#company-data-is-marked-with-its-provenance).

**403 questions**: 387 MCQs across aptitude, reasoning, verbal, DSA theory,
OOPS, DBMS, SQL, OS, networks, programming fundamentals, system design and HR
behaviour, plus **16 coding problems** with 106 machine-verified test cases.
Every MCQ carries an explanation and a per-option "why this is wrong" note,
revealed only for the option the student actually picked — a test fails the
build if any distractor is missing one.

The bank lives in JSON under `server/src/db/seed/data/`, schema-checked on load
so a malformed question fails the seed rather than reaching a student. Every
topic that appears on any company's roadmap has questions, and **all 1,922 mock
tests now fill their full question count** — the shortfall was 89 papers before
this bank was grown.

**1,922 mock tests**, generated per company as four tiers: a full company
simulation, one mock per round, one per section, and a 12-question quick mock.
Papers are assembled from the shared bank at start time, so a templated
company's mock is drawn from the same verified questions as a researched one.

`npm run audit:mocks` starts all 1,922 papers against a copy of the database:
every one assembles and every one now fills completely. Growing the bank
further still pays off — more questions mean less repetition across repeated
sittings — but no paper is short any more.

**Eligibility** is checked against the student's own branch, batch and CGPA, and
explains itself ("Open to Mechanical, Civil, EEE — not CSE") rather than
returning a bare yes/no. A blank profile field is *unknown*, never a rejection.

**A revision queue** brings back questions the student got wrong, on a Leitner
schedule (1, 3, 7, 21 days). Cards come only from real mistakes, and the hook
sits in the one funnel every graded answer passes through, so a mock or coding
mistake queues revision the same way a practice mistake does.

**Papers prefer fresh questions.** Selection knows what the student has already
answered and sinks it to the back. Where a repeat is unavoidable — the bank is
smaller than the catalogue — the report says how much of the paper was familiar
rather than letting it quietly inflate a score.

**Study plans run to the drive date** when one is set, not a rolling week, and
say how many days are left and the pace needed.

**Integrity signals** (tab hidden, focus lost, fullscreen exited) are recorded
during a paper and shown to both the student and the placement cell — framed as
browser observations, never as accusations, and never affecting a score.

**Students can report what a hiring process was really like.** Reports go to an
admin review queue and are published as `community_reported` on acceptance —
the path from a templated roadmap to a researched one.

**A cohort view** for the placement cell: readiness spread rather than only an
average, per-company readiness by soonest drive, and who has not started.

**Behavioural answers** are drafted in STAR form against real prompts, with a
self-review rubric and a spoken-length estimate. Nothing there is auto-scored —
see [What is deliberately not automated](#what-is-deliberately-not-automated).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + client with hot reload |
| `npm run build` | Type-check and build both workspaces |
| `npm start` | Run the built server (also serves the client) |
| `npm test` | Engine, catalogue and API tests (138 tests) |
| `npm run typecheck` | Type-check both workspaces |
| `npm run audit:mocks` | Start all 1,922 mock tests against a copy of the DB and report any that fail to assemble |
| `npm run measure:repeats` | Sit each of three mocks three times and report how much the paper repeats — the practical read on bank pressure |
| `npm run audit:db` | Whole-database consistency check: SQLite integrity, foreign keys, required fields, orphans, and per-company completeness across rounds, roadmap, mocks, practice and coding |
| `npm run db:reset` | Drop, migrate and seed the database |
| `npm run db:seed` | Re-seed without dropping (safe on a live database) |
| `npm --workspace server run verify:coding` | Run every coding problem's reference solution against its test cases |

---

## Architecture

A three-layer split — client, HTTP API, and engines over SQLite. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture; the short
version:

```
client/                 React + Vite + Tailwind, Recharts for charts
server/src/
  modules/              HTTP layer: routing, validation, response shaping
  engines/              The domain logic, all independently testable
    question-engine     finding and selecting questions
    test-engine         paper assembly, live state, grading, reports
    code-engine         compiling and running submissions
    readiness           mastery, round completion, company readiness
    recommendation      the adaptive roadmap
    progress            the single writer for derived progress tables
    gamification        XP, badges, streaks, leaderboards
  db/                   schema, migrations, seed data
```

Engines take an optional database handle, so every test runs against its own
in-memory database with no shared state.

---

## Notable design decisions

### Readiness is explainable, not a black box

```
readiness = topic mastery × 45% + mock performance × 40% + syllabus coverage × 15%
```

The weights live in the `settings` table and are editable from the admin console.
Any readiness figure in the UI can show its own arithmetic — the dashboard prints
the actual sum. Mastery itself blends accuracy with volume and difficulty, so two
correct easy answers do not read as mastery.

### The roadmap is a deterministic planner, not a language model

Each topic is scored on five signals — mastery gap, importance to the round, how
early the round sits in the process, whether it has ever been attempted, and how
long since it was last revised. The planner sequences the highest-priority work
across the horizon and inserts assessments where a re-measurement is useful.

This was a deliberate choice over an LLM: a student can ask "why is DBMS on day
5?" and get the actual reasons, plans are reproducible for a placement cell, and
the whole loop works with no API key or network access. `generatePlan()` is the
seam an LLM-backed planner would implement — everything else stays unchanged.
Plans regenerate automatically whenever a newer mock result exists.

### Papers are frozen, answer keys never leave the server

`startAttempt` resolves each section's selection rule into concrete questions,
shuffles them, and stores the result on the attempt row. A reload mid-test shows
exactly the same paper. The assembled paper carries no `is_correct` flags — a
test asserts this — and grading happens entirely server-side against the stored
key. The countdown is driven by an absolute server deadline, so backgrounding the
tab does not buy extra time.

### The catalogue converges on boot

A migration brings the schema forward but not the content, so pulling new code
and restarting used to leave the previous catalogue in place — a database seeded
by an older build kept serving 13 companies while the code shipped 171, and
nothing said so. The server now stores a fingerprint of the catalogue it wrote
and compares it on boot; when it differs it re-seeds and logs what changed.
Seeding is idempotent and non-destructive (below), so this is safe to do
unattended, and `PP_AUTO_SEED=0` turns it into a warning instead.

The fingerprint is content-based rather than a company count, so deleting a
company in the admin console is respected rather than silently undone on the
next restart.

### Re-seeding never destroys student work

Content is upserted on natural keys (company slug, question `public_id`, mock
slug), so ids stay stable and `attempt_answers`, `topic_progress`,
`student_companies` and `user_badges` keep pointing at the right rows. Only
purely derived rows — round topics, sections, options, test cases — are rebuilt,
and those are referenced by value rather than by id.

### Company data is marked with its provenance

Nothing here is an official statement of any employer's recruitment policy. Round
structures and eligibility rules are indicative figures compiled from publicly
discussed campus-placement experience, and every intelligence note carries a
`verified` / `community_reported` / `historical` marker that the UI displays next
to the text. Admins can add their own verified notes.

The 158 templated companies go further: because their rounds come from an
archetype rather than research, each one ships a `community_reported` note
saying exactly that, and the roadmap tab shows it as a banner above the round
strip — not buried under a tab a student may never open. A test
(`tests/catalogue.test.ts`) fails the build if a templated company loses that
note, or if any of its insights claims `verified` provenance for a statement
about the employer's process rather than about this platform's own content.

### Every company reaches every feature

A company is only useful if all four student surfaces work for it, so the seed
guarantees each of the 171 gets rounds and a topic-mapped roadmap, a full mock
plus round, sectional and quick mocks, practice questions, and coding problems.
`tests/catalogue.test.ts` asserts this over the seeded database.

Practice and coding reach a company through different routes. Practice matches
question tags, where a NULL company means "applies everywhere" — most of the
bank. Coding has only 16 problems and their tags name only the hand-researched
companies, so filtering by tag alone returned an empty list for the other 158.
The coding filter therefore matches a problem when it is either tagged for that
company **or** sits on a topic that company's roadmap covers, and the page says
so: `Asked by` still lists only where a problem is genuinely reported to have
appeared, so a syllabus match is never dressed up as a company fact.

Capgemini is the one company with no coding round, and that is deliberate — its
researched process runs on pseudocode and a game-based stage rather than a live
editor. Inventing a round to make the numbers tidy would be a lie about a real
employer; its students still reach the coding workspace from the Coding page.

### What is deliberately not automated

Free-text interview answers are not scored. Judging one properly is a
language-model problem, and a keyword heuristic dressed up as feedback is worse
than none, because a student would believe it. The builder gives structure,
per-prompt guidance on what a good answer contains, a self-review rubric and a
spoken-length estimate — and says plainly that a person should read the draft.

Integrity signals are not proof. A notification stealing focus looks exactly
like a deliberate tab switch. Nothing blocks a submission or changes a score,
and the admin copy says to treat a signal as a prompt to ask rather than as
evidence.

An accepted student report defaults to `community_reported`, not `verified`.
One person's account of a hiring process is not company policy; marking it
verified stays possible but is a deliberate choice, never the default.

---

## The coding evaluation engine

Supports **C, C++, Java, Python and JavaScript**. Submissions are compiled where
needed and run against sample and hidden test cases, with per-case verdicts,
runtime and peak memory.

Limits are enforced by a small Python runner (`server/src/engines/runner.py`) that
applies `setrlimit` caps on CPU time, address space, file size and process count
in the child before `exec`, plus a wall-clock kill on the whole process group.

> **Isolation caveat.** This is enough for a trusted classroom or a local install,
> and it is **not a security sandbox**: there is no filesystem namespace, no
> network isolation and no seccomp filter. For untrusted submissions, run the
> engine behind a container per submission with a read-only rootfs and no
> network, gVisor, or a dedicated judge such as isolate. Set
> `PP_CODE_ENGINE_ENABLED=false` to disable execution entirely.

The engine probes which toolchains actually exist at startup and reports
"language unavailable" rather than failing a student's solution.

---

## Configuration

All optional — the defaults work out of the box.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `PP_JWT_SECRET` | dev value | **Required in production**; the server refuses to start with the dev default when `NODE_ENV=production` |
| `PP_DATABASE_FILE` | `server/data/placeprep.db` | SQLite file |
| `PP_CLIENT_ORIGINS` | `http://localhost:5173` | Extra CORS origins (same-origin always passes) |
| `PP_CLIENT_DIST` | `client/dist` | Built client to serve |
| `PP_CODE_ENGINE_ENABLED` | `true` | Set `false` to disable code execution |
| `PP_CODE_TIMEOUT_MS` | `5000` | Per-test-case wall clock |
| `PP_CODE_MAX_CONCURRENT` | `4` | Concurrent user programs |
| `PP_DEMO_PASSWORD` | `Passw0rd!` | Password for seeded demo accounts |

---

## Testing

```bash
npm test                                     # 38 engine and seed-integrity tests
npm --workspace server run verify:coding     # 106 coding test cases against reference solutions
```

The suite covers mastery maths and its edge cases, question filtering and
selection (including difficulty mixes and shortfalls), the full attempt
lifecycle, readiness arithmetic, plan generation and staleness, badge
idempotency, and seed integrity — every round has topics, every MCQ has exactly
one correct option, every coding problem has samples and hidden cases.

`verify:coding` executes each problem's reference solution against every sample
and hidden case, so a wrong expected output cannot ship and silently fail correct
student submissions. It caught three during development.

---

## Extending it

The architecture is deliberately additive:

- **A new company** — add it in the admin console, or add an entry to
  `server/src/db/seed/companies.ts` (hand-researched rounds) or
  `server/src/db/seed/companies-extended.ts` (a one-line brief that inherits an
  archetype's rounds). No code changes either way.
- **A new hiring pattern** — add an archetype to
  `server/src/db/seed/company-archetypes.ts` and point briefs at it; every
  company using it picks up the new rounds on the next seed.
- **A new topic or question** — admin console, CSV/JSON bulk import, or a seed
  file. Questions are tagged to companies and round types, so one question can
  serve many papers.
- **A new mock test** — the admin builder composes sections from selection rules
  and shows how many questions the bank can actually supply before you publish.
- **A new question type** — add it to the `questions.question_type` check
  constraint, teach `toPaperQuestions` to shape it and the grader to score it.
- **An LLM-backed planner** — implement `generatePlan()` against the same
  signature.
