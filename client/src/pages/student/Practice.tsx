import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useElapsed, useMutation } from '../../lib/hooks';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  Meter,
  SectionHeading,
  Select,
  Spinner,
  cx,
} from '../../components/ui';

interface Question {
  id: number;
  publicId: string;
  questionType: string;
  body: string;
  difficulty: string;
  topic: string | null;
  topicId: number | null;
  subtopic: string | null;
  expectedSeconds: number;
  frequentlyAsked: boolean;
  options: { label: string; body: string }[];
  coding?: { problemId: number; title: string };
  state: { attempts: number; solved: boolean; lastCorrect: boolean | null };
}

interface AnswerResult {
  isCorrect: boolean;
  correctLabels: string[];
  explanation: string | null;
  conceptNote: string | null;
  optionFeedback: { label: string; isCorrect: boolean; whyWrong: string | null }[];
  xpAwarded: number;
  topicMastery: number;
  newBadges: { name: string; icon: string }[];
}

interface TopicRow {
  id: number;
  name: string;
  slug: string;
  category: string;
  parentId: number | null;
  counts: { total: number; easy: number; medium: number; hard: number; coding: number };
  mastery: number;
  attempted: number;
  accuracy: number;
}

export default function Practice() {
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topicId') ?? '';
  const roundId = params.get('roundId') ?? '';

  const [difficulty, setDifficulty] = useState('');
  const [solved, setSolved] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [search, setSearch] = useState('');
  const [frequentlyAsked, setFrequentlyAsked] = useState(false);
  const [order, setOrder] = useState('newest');

  const { data: topicData } = useApi<{ topics: TopicRow[] }>('/practice/topics');
  const { data: companyData } = useApi<{ companies: { slug: string; name: string }[] }>('/companies');

  const { data, loading, error, reload } = useApi<{ questions: Question[]; total: number }>('/practice/questions', {
    topicIds: topicId || undefined,
    roundId: roundId || undefined,
    difficulty: difficulty || undefined,
    solved: solved || undefined,
    companySlug: companySlug || undefined,
    search: search || undefined,
    frequentlyAsked: frequentlyAsked ? 'true' : undefined,
    order,
    limit: 20,
  });

  const topics = topicData?.topics ?? [];
  const currentTopic = topics.find((topic) => String(topic.id) === topicId);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Practice"
        subtitle="Topic-wise questions with full explanations. Every answer feeds your mastery scores and your roadmap."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Topic"
            value={topicId}
            onChange={(value) => setParam('topicId', value)}
            options={[
              { value: '', label: 'All topics' },
              ...topics
                .filter((topic) => topic.counts.total > 0)
                .map((topic) => ({
                  value: String(topic.id),
                  label: `${topic.parentId ? '— ' : ''}${topic.name} (${topic.counts.total})`,
                })),
            ]}
          />
          <Select
            label="Company"
            value={companySlug}
            onChange={setCompanySlug}
            options={[
              { value: '', label: 'All companies' },
              ...(companyData?.companies ?? []).map((company) => ({ value: company.slug, label: company.name })),
            ]}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: '', label: 'Any' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
          <Select
            label="Status"
            value={solved}
            onChange={setSolved}
            options={[
              { value: '', label: 'All questions' },
              { value: 'unsolved', label: 'Unsolved' },
              { value: 'solved', label: 'Solved' },
              { value: 'attempted', label: 'Previously attempted' },
            ]}
          />
          <Input label="Search" value={search} onChange={setSearch} placeholder="Keyword or QID" />
          <Select
            label="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'difficulty', label: 'Easiest first' },
              { value: 'topic', label: 'By topic' },
              { value: 'random', label: 'Random' },
              { value: 'most_missed', label: 'Most missed by students' },
            ]}
          />
          <label className="flex items-end gap-2 pb-2 text-sm ink-2">
            <input
              type="checkbox"
              checked={frequentlyAsked}
              onChange={(event) => setFrequentlyAsked(event.target.checked)}
              className="size-4"
              style={{ accentColor: 'var(--brand)' }}
            />
            Frequently asked only
          </label>
          <div className="flex items-end">
            <Button
              variant="secondary"
              full
              onClick={() => {
                setDifficulty('');
                setSolved('');
                setCompanySlug('');
                setSearch('');
                setFrequentlyAsked(false);
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      {currentTopic ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs ink-muted">{CATEGORY_LABEL[currentTopic.category]}</div>
              <h2 className="text-lg font-semibold ink">{currentTopic.name}</h2>
              <p className="mt-1 text-xs ink-muted">
                {currentTopic.counts.total} questions · {currentTopic.counts.easy} easy ·{' '}
                {currentTopic.counts.medium} medium · {currentTopic.counts.hard} hard
                {currentTopic.counts.coding > 0 ? ` · ${currentTopic.counts.coding} coding` : ''}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Meter
                value={currentTopic.mastery}
                label="Your mastery"
                right={`${pctText(currentTopic.mastery)} · ${currentTopic.attempted} attempted`}
              />
            </div>
          </div>
        </Card>
      ) : null}

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        data.questions.length === 0 ? (
          <Card>
            <Empty title="No questions match those filters" hint="Try widening the difficulty or clearing the topic." />
          </Card>
        ) : (
          <>
            <p className="text-xs ink-muted">
              Showing {data.questions.length} of {data.total} questions
            </p>
            <div className="space-y-4">
              {data.questions.map((question, index) => (
                <QuestionCard key={question.id} question={question} index={index + 1} companySlug={companySlug} />
              ))}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

function QuestionCard({ question, index, companySlug }: { question: Question; index: number; companySlug: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const elapsed = useElapsed(question.id);
  const multi = question.questionType === 'multi_select';

  useEffect(() => {
    setSelected([]);
    setResult(null);
  }, [question.id]);

  const submit = useMutation(async () => {
    const answer = await api<AnswerResult>('/practice/answer', {
      method: 'POST',
      body: {
        questionId: question.id,
        selectedLabels: selected,
        timeSpentSeconds: elapsed(),
        companySlug: companySlug || undefined,
      },
    });
    setResult(answer);
    return answer;
  });

  const feedbackFor = (label: string) => result?.optionFeedback.find((entry) => entry.label === label);

  if (question.questionType === 'coding' && question.coding) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone="brand" icon="⌘">Coding</Badge>
              <Badge>{DIFFICULTY_LABEL[question.difficulty]}</Badge>
              {question.topic ? <span className="text-xs ink-muted">{question.topic}</span> : null}
            </div>
            <h3 className="text-sm font-semibold ink">{question.coding.title}</h3>
          </div>
          <Link to={`/coding/${question.coding.problemId}`}>
            <Button size="sm">Open in editor →</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold ink-muted">Q{index}</span>
          <Badge>{DIFFICULTY_LABEL[question.difficulty]}</Badge>
          {question.topic ? <Badge tone="neutral">{question.topic}</Badge> : null}
          {question.frequentlyAsked ? <Badge tone="warning" icon="★">Frequently asked</Badge> : null}
          {question.state.solved ? <Badge tone="good" icon="✓">Solved before</Badge> : null}
          {multi ? <Badge tone="brand">Select all that apply</Badge> : null}
        </div>
        <span className="text-xs tabular ink-muted">
          {question.publicId} · ~{question.expectedSeconds}s
        </span>
      </div>

      <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed ink">{question.body}</p>

      <ul className="space-y-2">
        {question.options.map((option) => {
          const feedback = feedbackFor(option.label);
          const chosen = selected.includes(option.label);
          const revealed = Boolean(result);
          const isRight = revealed && feedback?.isCorrect;
          const isWrongChoice = revealed && chosen && !feedback?.isCorrect;

          return (
            <li key={option.label}>
              <button
                disabled={revealed}
                onClick={() =>
                  setSelected((current) =>
                    multi
                      ? current.includes(option.label)
                        ? current.filter((label) => label !== option.label)
                        : [...current, option.label]
                      : [option.label],
                  )
                }
                className={cx(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                  revealed ? 'cursor-default' : 'hover:opacity-80',
                )}
                style={{
                  borderColor: isRight
                    ? 'var(--good)'
                    : isWrongChoice
                      ? 'var(--critical)'
                      : chosen
                        ? 'var(--brand)'
                        : 'var(--hairline)',
                  background: isRight
                    ? 'color-mix(in srgb, var(--good) 8%, transparent)'
                    : isWrongChoice
                      ? 'color-mix(in srgb, var(--critical) 8%, transparent)'
                      : chosen
                        ? 'var(--brand-wash)'
                        : 'transparent',
                }}
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                >
                  {option.label}
                </span>
                <span className="min-w-0 flex-1 ink">{option.body}</span>
                {revealed ? (
                  <span aria-hidden="true" className="shrink-0 text-sm">
                    {isRight ? '✓' : isWrongChoice ? '✕' : ''}
                  </span>
                ) : null}
              </button>

              {/* Why the option the student picked is wrong. */}
              {revealed && chosen && feedback?.whyWrong ? (
                <p className="mt-1.5 ml-9 text-xs leading-relaxed" style={{ color: 'var(--critical-text)' }}>
                  {feedback.whyWrong}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!result ? (
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => void submit.mutate(undefined)} disabled={selected.length === 0 || submit.pending}>
            {submit.pending ? 'Checking…' : 'Check answer'}
          </Button>
          {selected.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={result.isCorrect ? 'good' : 'critical'} icon={result.isCorrect ? '✓' : '✕'}>
              {result.isCorrect ? 'Correct' : 'Incorrect'}
            </Badge>
            <span className="text-xs ink-muted">
              Correct answer: <strong className="ink">{result.correctLabels.join(', ')}</strong>
            </span>
            {result.xpAwarded > 0 ? <Badge tone="brand">+{result.xpAwarded} XP</Badge> : null}
            {question.topicId ? (
              <span className="text-xs ink-muted">Topic mastery now {pctText(result.topicMastery)}</span>
            ) : null}
          </div>

          {result.explanation ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide ink-muted">Explanation</h4>
              <p className="text-sm leading-relaxed ink-2">{result.explanation}</p>
            </div>
          ) : null}

          {result.conceptNote ? (
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide ink-muted">The concept</h4>
              <p className="text-sm leading-relaxed ink-2">{result.conceptNote}</p>
            </div>
          ) : null}

          {result.newBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {result.newBadges.map((badge) => (
                <Badge key={badge.name} tone="good" icon={badge.icon}>
                  Badge earned: {badge.name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelected([]);
                setResult(null);
              }}
            >
              Try again
            </Button>
            {question.topicId ? (
              <Link to={`/practice?topicId=${question.topicId}`}>
                <Button size="sm" variant="ghost">
                  More on this topic →
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
