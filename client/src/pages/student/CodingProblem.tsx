import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, LANGUAGE_LABEL, VERDICT_LABEL, dateTimeText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Spinner,
  Table,
  Tabs,
  cx,
} from '../../components/ui';

interface CaseResult {
  index: number;
  isSample: boolean;
  passed: boolean;
  input?: string;
  expected?: string;
  actual?: string;
  runtimeMs: number;
  memoryKb: number;
  status: string;
  stderr?: string;
}

interface EvaluationResult {
  verdict: string;
  passed: number;
  total: number;
  score: number;
  runtimeMs: number;
  memoryKb: number;
  compileOutput: string | null;
  cases: CaseResult[];
}

interface ProblemData {
  problem: {
    problemId: number;
    publicId: string;
    title: string;
    body: string;
    difficulty: string;
    marks: number;
    inputFormat: string | null;
    outputFormat: string | null;
    constraints: string | null;
    timeLimitMs: number;
    memoryLimitMb: number;
    allowedLanguages: string[];
    starterCode: Record<string, string>;
    topic: string | null;
    topicId: number | null;
    hint: string | null;
    editorial: string | null;
    conceptNote: string | null;
    samples: { input: string; expected: string; explanation: string | null }[];
    hiddenTestCount: number;
  };
  submissions: {
    id: number;
    language: string;
    verdict: string;
    passed_count: number;
    total_count: number;
    runtime_ms: number | null;
    memory_kb: number | null;
    created_at: string;
  }[];
  solved: boolean;
}

export default function CodingProblem() {
  const { problemId } = useParams<{ problemId: string }>();
  const { data, loading, error, reload } = useApi<ProblemData>(problemId ? `/coding/problems/${problemId}` : null);

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [tab, setTab] = useState('problem');
  const [showEditorial, setShowEditorial] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Draft code is kept per problem+language so switching away does not lose work.
  const draftKey = `pp_code_${problemId}_${language}`;

  useEffect(() => {
    if (!data) return;
    const allowed = data.problem.allowedLanguages;
    if (!allowed.includes(language)) setLanguage(allowed[0] ?? 'python');
  }, [data, language]);

  useEffect(() => {
    if (!data) return;
    const saved = localStorage.getItem(draftKey);
    setCode(saved ?? data.problem.starterCode[language] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, language, draftKey]);

  useEffect(() => {
    if (code) localStorage.setItem(draftKey, code);
  }, [code, draftKey]);

  const execute = useMutation(async (mode: 'run' | 'submit') => {
    const response = await api<{ submissionId: number; result: EvaluationResult; xpAwarded: number }>('/coding/execute', {
      method: 'POST',
      body: { problemId: Number(problemId), language, sourceCode: code, mode },
    });
    setResult(response.result);
    setTab('results');
    if (mode === 'submit') reload();
    return response;
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { problem } = data;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/coding" className="text-xs underline decoration-dotted underline-offset-2 ink-muted">
          ← All problems
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold ink">{problem.title}</h1>
          <Badge tone={problem.difficulty === 'hard' ? 'serious' : problem.difficulty === 'medium' ? 'warning' : 'neutral'}>
            {DIFFICULTY_LABEL[problem.difficulty]}
          </Badge>
          {problem.topic ? <Badge tone="neutral">{problem.topic}</Badge> : null}
          {data.solved ? <Badge tone="good" icon="✓">Solved</Badge> : null}
          <span className="text-xs tabular ink-muted">
            {problem.timeLimitMs} ms · {problem.memoryLimitMb} MB · {problem.samples.length} sample +{' '}
            {problem.hiddenTestCount} hidden tests
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Statement ── */}
        <div className="space-y-4">
          <Card>
            <Tabs
              tabs={[
                { id: 'problem', label: 'Problem' },
                { id: 'results', label: 'Results', count: result ? result.total : undefined },
                { id: 'submissions', label: 'Submissions', count: data.submissions.length },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === 'problem' ? (
              <div className="mt-4 space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed ink">{problem.body}</p>

                <dl className="space-y-2 text-xs">
                  {[
                    { label: 'Input format', value: problem.inputFormat },
                    { label: 'Output format', value: problem.outputFormat },
                    { label: 'Constraints', value: problem.constraints },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
                      <dt className="mb-0.5 font-semibold ink-muted">{item.label}</dt>
                      <dd className="whitespace-pre-wrap ink-2">{item.value ?? '—'}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide ink-muted">Sample test cases</h3>
                  <div className="space-y-2">
                    {problem.samples.map((sample, index) => (
                      <div key={index} className="rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[11px] font-medium ink-muted">Input</div>
                            <pre className="overflow-x-auto rounded p-2 font-mono text-xs ink" style={{ background: 'var(--surface-2)' }}>
                              {sample.input}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium ink-muted">Expected output</div>
                            <pre className="overflow-x-auto rounded p-2 font-mono text-xs ink" style={{ background: 'var(--surface-2)' }}>
                              {sample.expected}
                            </pre>
                          </div>
                        </div>
                        {sample.explanation ? (
                          <p className="mt-2 text-xs ink-2">{sample.explanation}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {problem.hint ? (
                  <div>
                    <button
                      onClick={() => setShowHint((value) => !value)}
                      className="text-xs font-medium underline decoration-dotted underline-offset-2 ink-muted"
                    >
                      {showHint ? 'Hide hint' : 'Show hint'}
                    </button>
                    {showHint ? (
                      <p className="mt-2 rounded-lg p-3 text-sm ink-2" style={{ background: 'var(--surface-2)' }}>
                        {problem.hint}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {problem.editorial ? (
                  <div>
                    <button
                      onClick={() => setShowEditorial((value) => !value)}
                      className="text-xs font-medium underline decoration-dotted underline-offset-2 ink-muted"
                    >
                      {showEditorial ? 'Hide editorial' : 'Show editorial (spoiler)'}
                    </button>
                    {showEditorial ? (
                      <div className="mt-2 rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-sm leading-relaxed ink-2">{problem.editorial}</p>
                        {problem.conceptNote ? (
                          <p className="mt-2 text-xs italic ink-muted">{problem.conceptNote}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === 'results' ? (
              <div className="mt-4">
                {!result ? (
                  <p className="py-8 text-center text-sm ink-muted">Run or submit your code to see results.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={result.verdict === 'accepted' ? 'good' : result.verdict === 'partial' ? 'warning' : 'critical'}
                        icon={result.verdict === 'accepted' ? '✓' : '✕'}
                      >
                        {VERDICT_LABEL[result.verdict] ?? result.verdict}
                      </Badge>
                      <span className="text-sm tabular ink-2">
                        {result.passed}/{result.total} test cases passed
                      </span>
                      {result.runtimeMs > 0 ? (
                        <span className="text-xs tabular ink-muted">
                          {result.runtimeMs} ms · {Math.round(result.memoryKb / 1024)} MB peak
                        </span>
                      ) : null}
                    </div>

                    {result.compileOutput ? (
                      <pre
                        className="overflow-x-auto rounded-lg p-3 font-mono text-xs"
                        style={{ background: 'color-mix(in srgb, var(--critical) 8%, transparent)', color: 'var(--critical-text)' }}
                      >
                        {result.compileOutput}
                      </pre>
                    ) : null}

                    <ul className="space-y-2">
                      {result.cases.map((testCase) => (
                        <li
                          key={testCase.index}
                          className="rounded-lg border p-2.5 text-xs"
                          style={{
                            borderColor: testCase.passed ? 'var(--good)' : 'var(--critical)',
                            background: testCase.passed
                              ? 'color-mix(in srgb, var(--good) 6%, transparent)'
                              : 'color-mix(in srgb, var(--critical) 6%, transparent)',
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium ink">
                              {testCase.passed ? '✓' : '✕'} {testCase.isSample ? 'Sample' : 'Hidden'} case{' '}
                              {testCase.index + 1}
                            </span>
                            <span className="tabular ink-muted">
                              {testCase.status.replace(/_/g, ' ')} · {testCase.runtimeMs} ms
                            </span>
                          </div>
                          {testCase.isSample && !testCase.passed ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              <div>
                                <div className="mb-0.5 text-[10px] ink-muted">Input</div>
                                <pre className="overflow-x-auto font-mono ink-2">{testCase.input}</pre>
                              </div>
                              <div>
                                <div className="mb-0.5 text-[10px] ink-muted">Expected</div>
                                <pre className="overflow-x-auto font-mono ink-2">{testCase.expected}</pre>
                              </div>
                              <div>
                                <div className="mb-0.5 text-[10px] ink-muted">Your output</div>
                                <pre className="overflow-x-auto font-mono ink-2">{testCase.actual || '(empty)'}</pre>
                              </div>
                            </div>
                          ) : null}
                          {testCase.stderr ? (
                            <pre className="mt-2 overflow-x-auto font-mono" style={{ color: 'var(--critical-text)' }}>
                              {testCase.stderr}
                            </pre>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {tab === 'submissions' ? (
              <div className="mt-4">
                <Table
                  rows={data.submissions}
                  keyOf={(row) => row.id}
                  empty="No submissions yet."
                  columns={[
                    {
                      key: 'verdict',
                      header: 'Verdict',
                      render: (row) => (
                        <Badge tone={row.verdict === 'accepted' ? 'good' : 'critical'}>
                          {VERDICT_LABEL[row.verdict] ?? row.verdict}
                        </Badge>
                      ),
                    },
                    { key: 'lang', header: 'Language', render: (row) => LANGUAGE_LABEL[row.language] ?? row.language },
                    {
                      key: 'cases',
                      header: 'Cases',
                      align: 'right',
                      render: (row) => `${row.passed_count}/${row.total_count}`,
                    },
                    { key: 'runtime', header: 'Runtime', align: 'right', render: (row) => (row.runtime_ms ? `${row.runtime_ms} ms` : '—') },
                    {
                      key: 'when',
                      header: 'When',
                      align: 'right',
                      render: (row) => <span className="text-xs ink-muted">{dateTimeText(row.created_at)}</span>,
                    },
                  ]}
                />
              </div>
            ) : null}
          </Card>
        </div>

        {/* ── Editor ── */}
        <div className="space-y-3">
          <Card padded={false}>
            <div
              className="flex flex-wrap items-center gap-2 border-b p-3"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
              >
                {problem.allowedLanguages.map((option) => (
                  <option key={option} value={option}>
                    {LANGUAGE_LABEL[option] ?? option}
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCode(problem.starterCode[language] ?? '')}
                title="Reset to the starter template"
              >
                Reset
              </Button>

              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void execute.mutate('run')} disabled={execute.pending}>
                  {execute.pending ? 'Running…' : '▶ Run samples'}
                </Button>
                <Button size="sm" onClick={() => void execute.mutate('submit')} disabled={execute.pending}>
                  Submit
                </Button>
              </div>
            </div>

            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
              rows={26}
              aria-label="Code editor"
              className={cx('w-full resize-y p-4 font-mono text-xs leading-relaxed outline-none')}
              style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: 'none', borderRadius: '0 0 0.875rem 0.875rem' }}
            />
          </Card>

          {execute.error ? <ErrorNote message={execute.error} /> : null}

          <p className="text-xs ink-muted">
            Your draft is saved in this browser per problem and language. Run tests against the samples first, then
            submit to run every hidden case.
          </p>
        </div>
      </div>
    </div>
  );
}
