/**
 * Coding evaluation engine.
 *
 * Compiles (where needed) and runs a submission against test cases, comparing
 * trimmed stdout with the expected output.
 *
 * ── Isolation caveat, stated plainly ─────────────────────────────────────────
 * This engine runs untrusted code as a child process of the API server with
 * setrlimit-based caps on CPU time, address space, file size and process count,
 * plus a wall-clock kill. That is enough for a trusted classroom or a local
 * development install, and it is NOT a security sandbox: there is no filesystem
 * namespace, no network isolation and no seccomp filter, so a determined
 * submission can still read files the server user can read and open sockets.
 *
 * For any deployment where submissions come from people you do not trust, run
 * this engine behind a real isolation layer — a container per submission with a
 * read-only rootfs and no network, gVisor, or a dedicated judge such as isolate.
 * `PP_CODE_ENGINE_ENABLED=false` disables execution entirely.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { badRequest, notFound } from '../lib/http.js';
import { round, stringify } from '../lib/util.js';
import type { Language, Verdict } from '../types.js';
import { loadTestCases } from './question-engine.js';

const RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runner.py');

interface LanguageSpec {
  id: Language;
  label: string;
  sourceName: string;
  /** Compile step; omit for interpreted languages. */
  compile?: (dir: string) => { command: string; args: string[] };
  run: (dir: string) => { command: string; args: string[] };
  /**
   * Address-space cap in KB. The JVM reserves far more virtual memory than it
   * uses, so an RLIMIT_AS cap makes it fail to start — 0 disables the cap and
   * relies on the wall-clock and CPU limits instead.
   */
  memoryCapKb: (limitMb: number) => number;
  /** Extra wall-clock allowance for interpreter/VM start-up. */
  startupMs: number;
}

const LANGUAGES: Record<Language, LanguageSpec> = {
  python: {
    id: 'python',
    label: 'Python 3',
    sourceName: 'main.py',
    run: (dir) => ({ command: 'python3', args: [path.join(dir, 'main.py')] }),
    memoryCapKb: (mb) => Math.max(mb, 128) * 1024,
    startupMs: 400,
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript (Node)',
    // Deliberately .cjs: the sandbox lives inside a package whose package.json
    // sets "type": "module", which would otherwise make Node parse a plain .js
    // submission as an ES module and break the `require` that judge-style code
    // (and our own starter template) relies on. A .cjs extension is CommonJS
    // regardless of any package.json above it.
    sourceName: 'main.cjs',
    run: (dir) => ({ command: process.execPath, args: [path.join(dir, 'main.cjs')] }),
    // Node's own heap reservations need headroom above the stated problem limit.
    memoryCapKb: (mb) => Math.max(mb, 256) * 1024 * 4,
    startupMs: 400,
  },
  c: {
    id: 'c',
    label: 'C (gcc)',
    sourceName: 'main.c',
    compile: (dir) => ({
      command: 'gcc',
      args: ['-O2', '-std=c11', '-o', path.join(dir, 'program'), path.join(dir, 'main.c'), '-lm'],
    }),
    run: (dir) => ({ command: path.join(dir, 'program'), args: [] }),
    memoryCapKb: (mb) => Math.max(mb, 64) * 1024,
    startupMs: 50,
  },
  cpp: {
    id: 'cpp',
    label: 'C++ (g++)',
    sourceName: 'main.cpp',
    compile: (dir) => ({
      command: 'g++',
      args: ['-O2', '-std=c++17', '-o', path.join(dir, 'program'), path.join(dir, 'main.cpp')],
    }),
    run: (dir) => ({ command: path.join(dir, 'program'), args: [] }),
    memoryCapKb: (mb) => Math.max(mb, 64) * 1024,
    startupMs: 50,
  },
  java: {
    id: 'java',
    label: 'Java',
    sourceName: 'Main.java',
    compile: (dir) => ({ command: 'javac', args: ['-d', dir, path.join(dir, 'Main.java')] }),
    run: (dir) => ({ command: 'java', args: ['-XX:+UseSerialGC', '-Xss64m', '-cp', dir, 'Main'] }),
    memoryCapKb: () => 0, // see LanguageSpec.memoryCapKb
    startupMs: 1200,
  },
};

export interface LanguageInfo {
  id: Language;
  label: string;
  available: boolean;
}

let availabilityCache: LanguageInfo[] | null = null;

/** Probes which toolchains actually exist on this machine. */
export async function languageAvailability(): Promise<LanguageInfo[]> {
  if (availabilityCache) return availabilityCache;
  const probes: Record<Language, string[]> = {
    python: ['python3', '--version'],
    javascript: [process.execPath, '--version'],
    c: ['gcc', '--version'],
    cpp: ['g++', '--version'],
    java: ['javac', '-version'],
  };

  const results = await Promise.all(
    (Object.keys(LANGUAGES) as Language[]).map(async (id) => {
      const [command, ...args] = probes[id];
      const ok = await new Promise<boolean>((resolve) => {
        const child = spawn(command, args, { stdio: 'ignore' });
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
      });
      return { id, label: LANGUAGES[id].label, available: ok };
    }),
  );

  availabilityCache = results;
  return results;
}

export interface CaseResult {
  index: number;
  isSample: boolean;
  passed: boolean;
  /** Only revealed for sample cases — hidden inputs stay hidden. */
  input?: string;
  expected?: string;
  actual?: string;
  runtimeMs: number;
  memoryKb: number;
  status: 'passed' | 'wrong_answer' | 'runtime_error' | 'time_limit_exceeded';
  stderr?: string;
}

export interface EvaluationResult {
  verdict: Verdict;
  passed: number;
  total: number;
  score: number;
  runtimeMs: number;
  memoryKb: number;
  compileOutput: string | null;
  cases: CaseResult[];
}

export interface EvaluateInput {
  problemId: number;
  language: string;
  sourceCode: string;
  /** 'run' evaluates sample cases only; 'submit' evaluates everything. */
  mode: 'run' | 'submit';
}

interface RunOutcome {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  wallMs: number;
  maxRssKb: number;
  timedOut: boolean;
}

/** Serialises execution so a burst of submissions cannot swamp the host. */
let running = 0;
const queue: (() => void)[] = [];

async function acquireSlot(): Promise<() => void> {
  if (running >= config.codeEngine.maxConcurrent) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    running -= 1;
    const next = queue.shift();
    if (next) next();
  };
}

export async function evaluate(input: EvaluateInput, target: Db = sharedDb()): Promise<EvaluationResult> {
  if (!config.codeEngine.enabled) {
    throw badRequest('Code execution is disabled on this server (PP_CODE_ENGINE_ENABLED=false)');
  }
  if (input.sourceCode.length > config.codeEngine.maxSourceBytes) {
    throw badRequest(`Source code exceeds ${config.codeEngine.maxSourceBytes} bytes`);
  }
  if (!input.sourceCode.trim()) throw badRequest('Source code is empty');

  const spec = LANGUAGES[input.language as Language];
  if (!spec) {
    return {
      verdict: 'unsupported_language',
      passed: 0,
      total: 0,
      score: 0,
      runtimeMs: 0,
      memoryKb: 0,
      compileOutput: `Language "${input.language}" is not supported. Choose one of: ${Object.keys(LANGUAGES).join(', ')}.`,
      cases: [],
    };
  }

  const availability = await languageAvailability();
  if (!availability.find((entry) => entry.id === spec.id)?.available) {
    return {
      verdict: 'unsupported_language',
      passed: 0,
      total: 0,
      score: 0,
      runtimeMs: 0,
      memoryKb: 0,
      compileOutput: `The ${spec.label} toolchain is not installed on this server.`,
      cases: [],
    };
  }

  const problem = target
    .prepare<[number], { id: number; time_limit_ms: number; memory_limit_mb: number; allowed_languages: string }>(
      'SELECT id, time_limit_ms, memory_limit_mb, allowed_languages FROM coding_problems WHERE id = ?',
    )
    .get(input.problemId);
  if (!problem) throw notFound('Coding problem not found');

  const allowed = JSON.parse(problem.allowed_languages) as Language[];
  if (!allowed.includes(spec.id)) {
    throw badRequest(`${spec.label} is not permitted for this problem. Allowed: ${allowed.join(', ')}.`);
  }

  const cases = loadTestCases(problem.id, input.mode === 'run', target);
  if (cases.length === 0) throw badRequest('This problem has no test cases configured');

  const release = await acquireSlot();
  const dir = path.join(config.codeEngine.sandboxDir, randomUUID());

  try {
    await fs.mkdir(dir, { recursive: true });
    // A package boundary of its own, so nothing about the server's package.json
    // (module type, dependencies, name) leaks into how a submission is resolved.
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'submission', private: true, type: 'commonjs' }),
      'utf8',
    );
    await fs.writeFile(path.join(dir, spec.sourceName), input.sourceCode, 'utf8');

    // ── compile ──
    if (spec.compile) {
      const { command, args } = spec.compile(dir);
      const compileRun = await runProcess({
        command,
        args,
        stdin: '',
        timeoutMs: config.codeEngine.compileTimeoutMs,
        memoryCapKb: 0,
        cpuSeconds: Math.ceil(config.codeEngine.compileTimeoutMs / 1000),
        dir,
      });
      if (compileRun.exitCode !== 0) {
        return {
          verdict: 'compile_error',
          passed: 0,
          total: cases.length,
          score: 0,
          runtimeMs: compileRun.wallMs,
          memoryKb: 0,
          compileOutput: truncate(compileRun.stderr || compileRun.stdout || 'Compilation failed.'),
          cases: [],
        };
      }
    }

    // ── run each case ──
    const results: CaseResult[] = [];
    let passed = 0;
    let peakRuntime = 0;
    let peakMemory = 0;
    let sawTimeout = false;
    let sawRuntimeError = false;

    const { command, args } = spec.run(dir);
    const timeoutMs = problem.time_limit_ms + spec.startupMs;

    for (const [index, testCase] of cases.entries()) {
      const outcome = await runProcess({
        command,
        args,
        stdin: testCase.input,
        timeoutMs,
        memoryCapKb: spec.memoryCapKb(problem.memory_limit_mb),
        cpuSeconds: Math.ceil(timeoutMs / 1000) + 1,
        dir,
      });

      peakRuntime = Math.max(peakRuntime, outcome.wallMs);
      peakMemory = Math.max(peakMemory, outcome.maxRssKb);

      let status: CaseResult['status'];
      if (outcome.timedOut) {
        status = 'time_limit_exceeded';
        sawTimeout = true;
      } else if (outcome.exitCode !== 0) {
        status = 'runtime_error';
        sawRuntimeError = true;
      } else if (normalise(outcome.stdout) === normalise(testCase.expected)) {
        status = 'passed';
        passed += 1;
      } else {
        status = 'wrong_answer';
      }

      const result: CaseResult = {
        index,
        isSample: testCase.is_sample === 1,
        passed: status === 'passed',
        runtimeMs: outcome.wallMs,
        memoryKb: outcome.maxRssKb,
        status,
      };

      if (testCase.is_sample === 1) {
        result.input = testCase.input;
        result.expected = testCase.expected;
        result.actual = truncate(outcome.stdout, 2000);
      }
      if (status === 'runtime_error' && outcome.stderr) {
        result.stderr = truncate(outcome.stderr, 1200);
      }

      results.push(result);
    }

    const total = cases.length;
    const verdict: Verdict =
      passed === total
        ? 'accepted'
        : sawTimeout && passed === 0
          ? 'time_limit_exceeded'
          : sawRuntimeError && passed === 0
            ? 'runtime_error'
            : passed === 0
              ? 'wrong_answer'
              : 'partial';

    return {
      verdict,
      passed,
      total,
      score: round((passed / total) * 100, 1),
      runtimeMs: peakRuntime,
      memoryKb: peakMemory,
      compileOutput: null,
      cases: results,
    };
  } catch (error) {
    return {
      verdict: 'internal_error',
      passed: 0,
      total: 0,
      score: 0,
      runtimeMs: 0,
      memoryKb: 0,
      compileOutput: error instanceof Error ? error.message : 'Evaluation failed',
      cases: [],
    };
  } finally {
    release();
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Trailing whitespace and line-ending differences must not fail a submission. */
function normalise(output: string): string {
  return output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

function truncate(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}\n… (truncated)` : text;
}

interface RunProcessInput {
  command: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
  memoryCapKb: number;
  cpuSeconds: number;
  dir: string;
}

function runProcess(input: RunProcessInput): Promise<RunOutcome> {
  const metaPath = path.join(input.dir, `meta-${randomUUID()}.json`);
  const runnerArgs = [
    RUNNER,
    '--meta',
    metaPath,
    '--timeout-ms',
    String(input.timeoutMs),
    '--memory-kb',
    String(input.memoryCapKb),
    '--cpu-seconds',
    String(input.cpuSeconds),
    '--output-bytes',
    String(config.codeEngine.maxOutputBytes),
    '--',
    input.command,
    ...input.args,
  ];

  return new Promise<RunOutcome>((resolve, reject) => {
    const child = spawn('python3', runnerArgs, {
      cwd: input.dir,
      env: {
        // Minimal environment: no inherited secrets, no proxy configuration.
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: input.dir,
        LANG: 'C.UTF-8',
        TMPDIR: input.dir,
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);

    // Belt-and-braces: if the runner itself wedges, stop waiting on it.
    const hardKill = setTimeout(() => child.kill('SIGKILL'), input.timeoutMs + 10_000);

    child.on('close', () => {
      clearTimeout(hardKill);
      void fs
        .readFile(metaPath, 'utf8')
        .then((raw) => JSON.parse(raw) as { exit_code: number | null; wall_ms: number; max_rss_kb: number; timed_out: boolean })
        .then((meta) =>
          resolve({
            stdout,
            stderr,
            exitCode: meta.exit_code,
            wallMs: meta.wall_ms,
            maxRssKb: meta.max_rss_kb,
            timedOut: meta.timed_out,
          }),
        )
        .catch(() =>
          // No meta file means the runner died before writing it.
          resolve({ stdout, stderr, exitCode: 1, wallMs: input.timeoutMs, maxRssKb: 0, timedOut: true }),
        );
    });

    child.stdin.on('error', () => {});
    child.stdin.end(input.stdin);
  });
}

// ───────────────────────── persistence ─────────────────────────

export interface RecordSubmissionInput extends EvaluateInput {
  userId: number;
  attemptId?: number | null;
  result: EvaluationResult;
}

export function recordSubmission(input: RecordSubmissionInput, target: Db = sharedDb()): number {
  const info = target
    .prepare(
      `INSERT INTO code_submissions (
         user_id, problem_id, attempt_id, language, source_code, mode, verdict,
         passed_count, total_count, score, runtime_ms, memory_kb, compile_output, result_detail
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.problemId,
      input.attemptId ?? null,
      input.language,
      input.sourceCode,
      input.mode,
      input.result.verdict,
      input.result.passed,
      input.result.total,
      input.result.score,
      input.result.runtimeMs,
      input.result.memoryKb,
      input.result.compileOutput,
      stringify(input.result.cases),
    );
  return Number(info.lastInsertRowid);
}

export interface CodingStats {
  solved: number;
  attempted: number;
  submissions: number;
  accepted: number;
  acceptanceRate: number;
  byDifficulty: { difficulty: string; solved: number; total: number }[];
  averageAttemptsPerSolve: number;
  averageRuntimeMs: number;
}

export function codingStats(userId: number, target: Db = sharedDb()): CodingStats {
  const totals = target
    .prepare<[number], { submissions: number; accepted: number; avg_runtime: number | null }>(
      `SELECT COUNT(*) AS submissions,
              SUM(CASE WHEN verdict = 'accepted' THEN 1 ELSE 0 END) AS accepted,
              AVG(runtime_ms) AS avg_runtime
       FROM code_submissions WHERE user_id = ? AND mode = 'submit'`,
    )
    .get(userId)!;

  const solvedRows = target
    .prepare<[number], { difficulty: string; solved: number }>(
      `SELECT q.difficulty, COUNT(DISTINCT cp.id) AS solved
       FROM code_submissions cs
       JOIN coding_problems cp ON cp.id = cs.problem_id
       JOIN questions q ON q.id = cp.question_id
       WHERE cs.user_id = ? AND cs.verdict = 'accepted'
       GROUP BY q.difficulty`,
    )
    .all(userId);

  const totalRows = target
    .prepare<[], { difficulty: string; total: number }>(
      `SELECT q.difficulty, COUNT(*) AS total
       FROM coding_problems cp JOIN questions q ON q.id = cp.question_id
       WHERE q.status = 'published'
       GROUP BY q.difficulty`,
    )
    .all();

  const attempted = target
    .prepare<[number], { count: number }>(
      "SELECT COUNT(DISTINCT problem_id) AS count FROM code_submissions WHERE user_id = ? AND mode = 'submit'",
    )
    .get(userId)!.count;

  const solved = solvedRows.reduce((total, row) => total + row.solved, 0);
  const solvedMap = new Map(solvedRows.map((row) => [row.difficulty, row.solved]));

  return {
    solved,
    attempted,
    submissions: totals.submissions,
    accepted: totals.accepted ?? 0,
    acceptanceRate: totals.submissions > 0 ? round(((totals.accepted ?? 0) / totals.submissions) * 100, 1) : 0,
    byDifficulty: ['easy', 'medium', 'hard'].map((difficulty) => ({
      difficulty,
      solved: solvedMap.get(difficulty) ?? 0,
      total: totalRows.find((row) => row.difficulty === difficulty)?.total ?? 0,
    })),
    averageAttemptsPerSolve: solved > 0 ? round(totals.submissions / solved, 2) : 0,
    averageRuntimeMs: totals.avg_runtime ? Math.round(totals.avg_runtime) : 0,
  };
}

export function supportedLanguages(): Language[] {
  return Object.keys(LANGUAGES) as Language[];
}
