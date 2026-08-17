# Architecture

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  client/  React 18 · Vite · Tailwind v4 · Recharts                │
│    pages/student  pages/admin  components/ui  components/charts   │
└───────────────────────────────┬──────────────────────────────────┘
                                │  JSON over HTTP, bearer JWT
┌───────────────────────────────▼──────────────────────────────────┐
│  server/src/modules/   HTTP layer                                 │
│    auth · companies · practice · mocktests · coding · dashboard   │
│    roadmap · performance · gamification · admin                   │
│    Responsibilities: routing, zod validation, RBAC, shaping       │
├──────────────────────────────────────────────────────────────────┤
│  server/src/engines/   Domain layer (no HTTP knowledge)           │
│    question-engine · test-engine · code-engine · readiness        │
│    progress · recommendation-engine · gamification                │
├──────────────────────────────────────────────────────────────────┤
│  server/src/db/        SQLite via better-sqlite3                  │
│    migrations/ (SQL)   seed/ (typed content)                      │
└──────────────────────────────────────────────────────────────────┘
```

The modules layer never contains domain logic and the engines layer never
touches `req`/`res`. Every engine function accepts an optional `Db` handle as its
last argument, which is what lets the test suite run each case against a fresh
in-memory database.

## Data model

The content hierarchy the product is built around:

```
company ──< round ──< section ──< (round_topics) >── topic ──< topic (subtopic)
                                                        │
questions ──< question_options                          │
   │  └──< question_tags >── company / round_type       │
   └──< coding_problems ──< test_cases                  │
                                                        │
mock_tests ──< mock_test_sections ──(selection_rule)────┘
                     └──< mock_test_questions   (optional hand-picked pins)
```

Student-owned data hangs off `users`:

```
users ──< student_companies ──> companies
      ──< attempts ──< attempt_answers
      ──< practice_events
      ──< topic_progress          (derived, written only by progress.ts)
      ──< round_progress          (derived)
      ──< study_plans ──< study_plan_items
      ──< code_submissions
      ──< xp_events · user_badges · activity_days
```

Questions live in **one** central bank. `question_tags` maps a question to any
number of companies and round types, with `NULL` meaning "available to all", so
the same question serves a TCS aptitude mock and an Infosys one without being
duplicated.

## Request lifecycle: taking a mock test

1. `POST /api/mock-tests/:slug/start`
   `test-engine.startAttempt` reads the blueprint's sections, hands each
   section's `selection_rule` to `question-engine.selectForRule`, shuffles, and
   writes the assembled paper as JSON onto the `attempts` row. Answer rows are
   pre-created so navigation state has somewhere to live. Returns the paper
   **without** any answer key.

2. `POST /api/attempts/:id/answers` (autosave, every 15s and on tab hide)
   Bulk-upserts selections, review flags and per-question timers. If the server
   deadline has passed, it auto-submits instead.

3. `POST /api/attempts/:id/submit`
   Grades against `loadAnswerKeys`, applies per-section negative marking, awards
   partial credit for coding by fraction of test cases passed, and builds the
   report: section, topic and difficulty breakdowns, per-question outcomes,
   timing, and ranked recommendations. Then:
   - `progress.recordGradedAnswers` updates topic counters and recomputes mastery
   - `progress.refreshCompanyProgress` recomputes readiness and round progress
   - percentiles are recomputed for every attempt on that test
   - XP is awarded once, keyed to the attempt id so retries cannot double-pay

4. The next `GET /api/roadmap` sees an attempt newer than the current plan,
   marks it stale, and regenerates. That is the feedback loop closing.

## The engines

### question-engine
`findQuestions` builds a parameterised filter (topic and its subtopics, category,
difficulty, type, company/round tags, solved state, search) shared by the
practice browser, the admin bank and mock assembly. `selectForRule` resolves a
section rule in three widening stages — company-tagged questions matching the
rule, then the shared bank, then the same topic *categories* — so a section
reaches its count whenever the bank has material at all, and honestly falls short
when it does not. `toPaperQuestions` shapes questions for a live paper and is the
only place that decides what a student may see.

### test-engine
Paper assembly, live answer state, grading, reporting, percentiles. Submission is
idempotent: re-submitting returns the stored report rather than erroring, which
matters when a timer and a click race.

### readiness
`computeMastery` blends accuracy (70%) with difficulty progression (30%), damped
by a confidence factor that saturates around 12 attempts. `computeCompanyReadiness`
weights topic mastery, mock performance and coverage, returns the component
values alongside the total, and `explainCompanyReadiness` renders the arithmetic
as a sentence.

### progress
The **single writer** for `topic_progress`, `round_progress`, `activity_days` and
cached readiness. Everything that grades an answer funnels through
`recordGradedAnswers`, so there is exactly one place where derived state can drift.

### recommendation-engine
Scores topics, sequences a plan, persists it, and decides when it is stale. See
the README for the scoring signals and why it is deterministic.

### code-engine
Writes the submission to a temp directory, compiles if needed, runs each test
case through `runner.py` under `setrlimit` caps, compares trimmed output, and
returns per-case verdicts. Concurrency is capped by a small queue so a burst of
submissions cannot swamp the host.

### gamification
Badge criteria are JSON rules stored on the `badges` row and interpreted at
evaluation time, so a new achievement is a database row rather than a deploy.

## Security posture

- **Auth** — bcrypt password hashes, JWTs signed with `PP_JWT_SECRET`. The role
  is re-read from the database on every request, so a demotion takes effect
  immediately rather than at token expiry. Production refuses to boot with the
  development secret.
- **RBAC** — four ranked roles (student < faculty < admin < super_admin). Only a
  super admin can grant elevated roles or delete a company.
- **Input** — every request body and query string is parsed by a zod schema.
  Every SQL statement is parameterised; the only interpolated fragments are
  generated placeholder lists.
- **Answer keys** — never serialised into a live paper; a test asserts it.
- **Rate limiting** — in-memory limiter on the API surface, tighter on login and
  code execution. A multi-instance deployment should front this with a shared
  store.
- **Code execution** — see the caveat in the README. This is the one place where
  untrusted input is executed, and it is not isolated to a standard that would be
  safe for anonymous public submissions.

## Frontend

Routing is flat and role-gated. The mock-test runner deliberately sits **outside**
the app shell: a live paper needs the full viewport and no navigation that could
lose answers.

Theming is CSS custom properties on `:root`, with dark values declared under both
`prefers-color-scheme` and a `data-theme` attribute so the in-app toggle wins in
both directions.

Charts follow a validated data-visualisation method — see
[DATAVIZ.md](DATAVIZ.md).

## Known limits

- **SQLite** suits a single-institute deployment comfortably. Multi-tenant scale
  wants Postgres; the query layer is plain SQL behind engine functions, so the
  port is mechanical.
- **The in-memory rate limiter** and the code-execution queue are per-process.
- **Percentiles** are recomputed for all attempts on a test at submit time —
  fine at campus scale, worth batching beyond it.
- **The code sandbox** is not suitable for untrusted public submissions as-is.
