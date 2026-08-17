import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useCountdown, useFullscreen } from '../../lib/hooks';
import { clockText, parseServerTime } from '../../lib/format';
import { Badge, Button, ErrorNote, Modal, Spinner, cx } from '../../components/ui';

interface PaperQuestion {
  questionId: number;
  publicId: string;
  questionType: string;
  body: string;
  difficulty: string;
  topic: string | null;
  marks: number;
  negativeMarks: number;
  expectedSeconds: number;
  options: { label: string; body: string }[];
  coding?: {
    problemId: number;
    title: string;
    inputFormat: string | null;
    outputFormat: string | null;
    constraints: string | null;
    allowedLanguages: string[];
    starterCode: Record<string, string>;
    samples: { input: string; expected: string; explanation: string | null }[];
  };
}

interface PaperSection {
  key: string;
  name: string;
  sequence: number;
  durationMinutes: number | null;
  marksPerQuestion: number;
  negativeMarks: number;
  questionKind: string;
  questions: PaperQuestion[];
}

interface AttemptData {
  attemptId: number;
  status: string;
  expiresAt: string;
  serverTime: string;
  startedAt: string;
  paper: { sections: PaperSection[]; sectionLock: boolean };
  state: {
    questionId: number;
    sectionKey: string;
    selectedLabels: string[];
    markedForReview: boolean;
    visited: boolean;
    timeSpentSeconds: number;
    codeSubmissionId: number | null;
  }[];
  test: {
    id: number;
    slug: string;
    title: string;
    durationMinutes: number;
    sectionLock: boolean;
    allowReview: boolean;
    fullscreenRequired: boolean;
    negativeMarking: number;
  };
}

interface LocalAnswer {
  selected: string[];
  marked: boolean;
  visited: boolean;
  dirty: boolean;
  codeSubmissionId: number | null;
}

export default function TestRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<AttemptData>(attemptId ? `/attempts/${attemptId}` : null);
  const fullscreen = useFullscreen();

  const [answers, setAnswers] = useState<Record<number, LocalAnswer>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submittedSections, setSubmittedSections] = useState<string[]>([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [navOpen, setNavOpen] = useState(false);
  const questionStart = useRef(Date.now());

  // Hydrate local state from whatever the server already has for this attempt.
  useEffect(() => {
    if (!data) return;
    const next: Record<number, LocalAnswer> = {};
    for (const row of data.state) {
      next[row.questionId] = {
        selected: row.selectedLabels ?? [],
        marked: row.markedForReview,
        visited: row.visited,
        dirty: false,
        codeSubmissionId: row.codeSubmissionId,
      };
    }
    setAnswers(next);
    if (data.status !== 'in_progress') navigate(`/results/${data.attemptId}`, { replace: true });
  }, [data, navigate]);

  const sections = data?.paper.sections ?? [];
  const section = sections[sectionIndex];
  const question = section?.questions[questionIndex];

  const deadline = useMemo(() => (data ? parseServerTime(data.expiresAt) : null), [data]);

  const flush = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!attemptId) return;
      const pending = Object.entries(answers).filter(([, value]) => value.dirty);
      if (pending.length === 0) return;

      if (!options.silent) setSaveState('saving');
      try {
        await api(`/attempts/${attemptId}/answers`, {
          method: 'POST',
          body: {
            answers: pending.map(([id, value]) => ({
              questionId: Number(id),
              selectedLabels: value.selected,
              markedForReview: value.marked,
              codeSubmissionId: value.codeSubmissionId,
            })),
          },
        });
        setAnswers((current) => {
          const next = { ...current };
          for (const [id] of pending) next[Number(id)] = { ...next[Number(id)], dirty: false };
          return next;
        });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [answers, attemptId],
  );

  // Autosave every 15 seconds and on unload — a dropped connection must not
  // cost the student their answers.
  useEffect(() => {
    const id = window.setInterval(() => void flush({ silent: true }), 15_000);
    return () => window.clearInterval(id);
  }, [flush]);

  useEffect(() => {
    const onHide = () => void flush({ silent: true });
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (!attemptId || submitting) return;
      setSubmitting(true);
      await flush({ silent: true });
      try {
        await api(`/attempts/${attemptId}/submit`, { method: 'POST', body: { auto } });
        fullscreen.exit();
        navigate(`/results/${attemptId}`, { replace: true });
      } catch {
        setSubmitting(false);
      }
    },
    [attemptId, flush, navigate, submitting, fullscreen],
  );

  const remaining = useCountdown(deadline, () => void submit(true));

  const recordTime = useCallback(
    (questionId: number) => {
      const spent = Math.round((Date.now() - questionStart.current) / 1000);
      questionStart.current = Date.now();
      if (spent <= 0 || !attemptId) return;
      // Time is reported per question as the student leaves it.
      void api(`/attempts/${attemptId}/answer`, {
        method: 'POST',
        body: { questionId, timeSpentSeconds: spent },
      }).catch(() => {});
    },
    [attemptId],
  );

  const goTo = (nextSection: number, nextQuestion: number) => {
    if (question) recordTime(question.questionId);
    setSectionIndex(nextSection);
    setQuestionIndex(nextQuestion);
    setNavOpen(false);
  };

  const update = (questionId: number, patch: Partial<LocalAnswer>) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        selected: current[questionId]?.selected ?? [],
        marked: current[questionId]?.marked ?? false,
        visited: true,
        codeSubmissionId: current[questionId]?.codeSubmissionId ?? null,
        ...patch,
        dirty: true,
      },
    }));
  };

  useEffect(() => {
    if (question && !answers[question.questionId]?.visited) {
      update(question.questionId, { visited: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.questionId]);

  if (loading) return <Spinner label="Loading your paper…" />;
  if (error) return <div className="p-6"><ErrorNote message={error} onRetry={reload} /></div>;
  if (!data || !section || !question) return null;

  const counts = sections.flatMap((s) => s.questions).reduce(
    (acc, q) => {
      const answer = answers[q.questionId];
      if (answer?.marked) acc.marked += 1;
      else if (answer?.selected.length || answer?.codeSubmissionId) acc.answered += 1;
      else if (answer?.visited) acc.seen += 1;
      else acc.untouched += 1;
      return acc;
    },
    { answered: 0, marked: 0, seen: 0, untouched: 0 },
  );

  const urgent = remaining <= 300;
  const sectionLocked = (key: string) => data.test.sectionLock && submittedSections.includes(key);

  return (
    <div className="flex min-h-full flex-col" style={{ background: 'var(--page)' }}>
      {/* ── Test header ── */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold ink">{data.test.title}</h1>
            <p className="text-xs ink-muted">
              Section {sectionIndex + 1} of {sections.length}: {section.name}
            </p>
          </div>

          <div
            className="rounded-lg px-3 py-1.5 text-center"
            style={{
              background: urgent ? 'color-mix(in srgb, var(--critical) 14%, transparent)' : 'var(--surface-2)',
              color: urgent ? 'var(--critical-text)' : 'var(--ink)',
            }}
            role="timer"
            aria-live={urgent ? 'assertive' : 'off'}
          >
            <div className="text-lg font-semibold leading-none tabular">{clockText(remaining)}</div>
            <div className="text-[10px] ink-muted">{urgent ? 'Time running out' : 'Time left'}</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs ink-muted sm:inline">
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? '⚠ Save failed' : 'Saved'}
            </span>
            <Button size="sm" variant="secondary" onClick={() => (fullscreen.active ? fullscreen.exit() : fullscreen.enter())}>
              {fullscreen.active ? 'Exit full screen' : 'Full screen'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setNavOpen((value) => !value)} className="xl:hidden">
              Palette
            </Button>
            <Button size="sm" onClick={() => setConfirmSubmit(true)}>
              Submit test
            </Button>
          </div>
        </div>

        {/* Section switcher */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto scroll-thin px-4 pb-2">
          {sections.map((entry, index) => {
            const locked = sectionLocked(entry.key);
            return (
              <button
                key={entry.key}
                disabled={locked}
                onClick={() => goTo(index, 0)}
                className={cx(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  locked && 'cursor-not-allowed opacity-50',
                )}
                style={
                  index === sectionIndex
                    ? { background: 'var(--brand-wash)', color: 'var(--brand-strong)' }
                    : { background: 'var(--surface-2)', color: 'var(--ink-2)' }
                }
              >
                {locked ? '🔒 ' : ''}
                {entry.name}
                <span className="ml-1.5 tabular ink-muted">{entry.questions.length}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 p-4">
        {/* ── Question pane ── */}
        <main className="min-w-0 flex-1">
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold ink">
                  Question {questionIndex + 1}
                  <span className="ink-muted"> / {section.questions.length}</span>
                </span>
                <Badge>{question.difficulty}</Badge>
                {question.topic ? <Badge tone="neutral">{question.topic}</Badge> : null}
              </div>
              <div className="flex items-center gap-2 text-xs ink-muted">
                <span className="tabular">
                  +{question.marks > 1 ? question.marks : section.marksPerQuestion} marks
                  {section.negativeMarks > 0 ? ` / −${section.negativeMarks}` : ''}
                </span>
              </div>
            </div>

            {question.questionType === 'coding' && question.coding ? (
              <CodingPanel
                question={question}
                attemptId={Number(attemptId)}
                onSubmission={(submissionId) => update(question.questionId, { codeSubmissionId: submissionId })}
                submitted={answers[question.questionId]?.codeSubmissionId ?? null}
              />
            ) : (
              <>
                <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed ink">{question.body}</p>
                <ul className="space-y-2">
                  {question.options.map((option) => {
                    const chosen = answers[question.questionId]?.selected.includes(option.label) ?? false;
                    const multi = question.questionType === 'multi_select';
                    return (
                      <li key={option.label}>
                        <button
                          onClick={() => {
                            const current = answers[question.questionId]?.selected ?? [];
                            const next = multi
                              ? current.includes(option.label)
                                ? current.filter((label) => label !== option.label)
                                : [...current, option.label]
                              : current.includes(option.label)
                                ? []
                                : [option.label];
                            update(question.questionId, { selected: next });
                          }}
                          className="flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:opacity-80"
                          style={{
                            borderColor: chosen ? 'var(--brand)' : 'var(--hairline)',
                            background: chosen ? 'var(--brand-wash)' : 'transparent',
                          }}
                        >
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
                            style={
                              chosen
                                ? { background: 'var(--brand)', color: '#fff' }
                                : { background: 'var(--surface-2)', color: 'var(--ink-2)' }
                            }
                          >
                            {option.label}
                          </span>
                          <span className="min-w-0 flex-1 ink">{option.body}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={sectionIndex === 0 && questionIndex === 0}
                onClick={() => {
                  if (questionIndex > 0) goTo(sectionIndex, questionIndex - 1);
                  else if (sectionIndex > 0) goTo(sectionIndex - 1, sections[sectionIndex - 1].questions.length - 1);
                }}
              >
                ← Previous
              </Button>

              <Button
                variant={answers[question.questionId]?.marked ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => update(question.questionId, { marked: !answers[question.questionId]?.marked })}
              >
                {answers[question.questionId]?.marked ? '★ Marked for review' : '☆ Mark for review'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => update(question.questionId, { selected: [] })}
                disabled={!(answers[question.questionId]?.selected.length)}
              >
                Clear response
              </Button>

              <Button size="sm" variant="secondary" onClick={() => void flush()}>
                Save
              </Button>

              <div className="ml-auto flex gap-2">
                {questionIndex === section.questions.length - 1 && sectionIndex < sections.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (data.test.sectionLock) setSubmittedSections((current) => [...current, section.key]);
                      void flush({ silent: true });
                      goTo(sectionIndex + 1, 0);
                    }}
                  >
                    {data.test.sectionLock ? 'Submit section & continue →' : 'Next section →'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={sectionIndex === sections.length - 1 && questionIndex === section.questions.length - 1}
                    onClick={() => {
                      if (questionIndex < section.questions.length - 1) goTo(sectionIndex, questionIndex + 1);
                      else goTo(sectionIndex + 1, 0);
                    }}
                  >
                    Save & next →
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ── Question palette ── */}
        <aside className={cx('w-64 shrink-0', navOpen ? 'block' : 'hidden xl:block')}>
          <div className="card sticky top-32 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide ink-muted">Question palette</h2>

            <div className="mb-3 grid grid-cols-2 gap-1.5 text-[11px]">
              {[
                { label: 'Answered', value: counts.answered, color: 'var(--good)' },
                { label: 'Marked', value: counts.marked, color: 'var(--warning)' },
                { label: 'Seen', value: counts.seen, color: 'var(--baseline)' },
                { label: 'Not visited', value: counts.untouched, color: 'var(--surface-3)' },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5 ink-2">
                  <span aria-hidden="true" className="size-2.5 rounded" style={{ background: item.color }} />
                  {item.label} <span className="tabular font-medium ink">{item.value}</span>
                </span>
              ))}
            </div>

            <div className="max-h-[50vh] space-y-3 overflow-y-auto scroll-thin">
              {sections.map((entry, sIndex) => (
                <div key={entry.key}>
                  <div className="mb-1.5 text-[11px] font-medium ink-2">{entry.name}</div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {entry.questions.map((entryQuestion, qIndex) => {
                      const answer = answers[entryQuestion.questionId];
                      const isCurrent = sIndex === sectionIndex && qIndex === questionIndex;
                      const background = answer?.marked
                        ? 'var(--warning)'
                        : answer?.selected.length || answer?.codeSubmissionId
                          ? 'var(--good)'
                          : answer?.visited
                            ? 'var(--baseline)'
                            : 'var(--surface-3)';
                      const answered = Boolean(answer?.selected.length || answer?.codeSubmissionId || answer?.marked);
                      return (
                        <button
                          key={entryQuestion.questionId}
                          onClick={() => goTo(sIndex, qIndex)}
                          disabled={sectionLocked(entry.key)}
                          title={`Question ${qIndex + 1}`}
                          className={cx(
                            'flex size-7 items-center justify-center rounded text-[11px] font-medium tabular transition-transform',
                            isCurrent && 'ring-2 ring-offset-1',
                            sectionLocked(entry.key) && 'opacity-40',
                          )}
                          style={{
                            background,
                            color: answered ? '#fff' : 'var(--ink-2)',
                          }}
                        >
                          {qIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button full className="mt-4" onClick={() => setConfirmSubmit(true)}>
              Submit test
            </Button>
          </div>
        </aside>
      </div>

      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Submit this test?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSubmit(false)}>
              Keep working
            </Button>
            <Button disabled={submitting} onClick={() => void submit(false)}>
              {submitting ? 'Submitting…' : 'Submit now'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="ink-2">Once submitted you cannot change your answers. Your report is generated immediately.</p>
          <dl className="grid grid-cols-2 gap-2">
            {[
              { label: 'Answered', value: counts.answered },
              { label: 'Marked for review', value: counts.marked },
              { label: 'Seen but unanswered', value: counts.seen },
              { label: 'Not visited', value: counts.untouched },
            ].map((item) => (
              <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
                <dt className="text-xs ink-muted">{item.label}</dt>
                <dd className="text-lg font-semibold tabular ink">{item.value}</dd>
              </div>
            ))}
          </dl>
          {counts.untouched + counts.seen > 0 ? (
            <p className="text-xs" style={{ color: 'var(--critical-text)' }}>
              ⚠ {counts.untouched + counts.seen} question(s) have no answer recorded.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

/** In-test coding panel — a compact editor with run and submit. */
function CodingPanel({
  question,
  attemptId,
  onSubmission,
  submitted,
}: {
  question: PaperQuestion;
  attemptId: number;
  onSubmission: (submissionId: number) => void;
  submitted: number | null;
}) {
  const coding = question.coding!;
  const [language, setLanguage] = useState(coding.allowedLanguages[0] ?? 'python');
  const [code, setCode] = useState(coding.starterCode[language] ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ verdict: string; passed: number; total: number; compileOutput: string | null } | null>(null);

  useEffect(() => {
    setCode(coding.starterCode[language] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const execute = async (mode: 'run' | 'submit') => {
    setRunning(true);
    try {
      const response = await api<{
        submissionId: number;
        result: { verdict: string; passed: number; total: number; compileOutput: string | null };
      }>('/coding/execute', {
        method: 'POST',
        body: { problemId: coding.problemId, language, sourceCode: code, mode, attemptId },
      });
      setResult(response.result);
      if (mode === 'submit') onSubmission(response.submissionId);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold ink">{coding.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed ink-2">{question.body}</p>
      </div>

      <dl className="grid gap-3 text-xs sm:grid-cols-3">
        {[
          { label: 'Input', value: coding.inputFormat },
          { label: 'Output', value: coding.outputFormat },
          { label: 'Constraints', value: coding.constraints },
        ].map((item) => (
          <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
            <dt className="mb-0.5 font-medium ink-muted">{item.label}</dt>
            <dd className="whitespace-pre-wrap ink-2">{item.value}</dd>
          </div>
        ))}
      </dl>

      {coding.samples.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {coding.samples.map((sample, index) => (
            <div key={index} className="rounded-lg border p-2.5 text-xs" style={{ borderColor: 'var(--hairline)' }}>
              <div className="mb-1 font-medium ink-muted">Sample {index + 1}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono ink-2">{sample.input}</pre>
              <div className="my-1 font-medium ink-muted">Expected</div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono ink-2">{sample.expected}</pre>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
        >
          {coding.allowedLanguages.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => void execute('run')} disabled={running}>
          {running ? 'Running…' : 'Run samples'}
        </Button>
        <Button size="sm" onClick={() => void execute('submit')} disabled={running}>
          Submit code
        </Button>
        {submitted ? <Badge tone="good" icon="✓">Solution recorded</Badge> : null}
      </div>

      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        rows={16}
        spellCheck={false}
        className="w-full rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
      />

      {result ? (
        <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--surface-2)' }}>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={result.verdict === 'accepted' ? 'good' : 'critical'}>{result.verdict.replace(/_/g, ' ')}</Badge>
            <span className="tabular ink-2">
              {result.passed}/{result.total} test cases passed
            </span>
          </div>
          {result.compileOutput ? (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono" style={{ color: 'var(--critical-text)' }}>
              {result.compileOutput}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
