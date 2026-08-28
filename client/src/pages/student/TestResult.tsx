import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { DIFFICULTY_LABEL, durationText, pctText } from '../../lib/format';
import {
  Badge,
  BandBadge,
  Button,
  Card,
  Empty,
  ErrorNote,
  HeroScore,
  Meter,
  Note,
  SectionHeading,
  Spinner,
  Stat,
  Table,
  Tabs,
  cx,
} from '../../components/ui';
import { GroupedColumns, MagnitudeBars, SegmentBar } from '../../components/charts';

interface SectionReport {
  key: string;
  name: string;
  questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  timeSpentSeconds: number;
  label: string;
}

interface QuestionOutcome {
  questionId: number;
  publicId: string;
  sectionKey: string;
  difficulty: string;
  selected: string[];
  correctLabels: string[];
  isCorrect: boolean | null;
  marksAwarded: number;
  timeSpentSeconds: number;
  expectedSeconds: number;
  detail: {
    publicId: string;
    body: string;
    topic: string | null;
    explanation: string | null;
    conceptNote: string | null;
    options: { label: string; body: string; isCorrect: boolean; whyWrong: string | null }[];
  } | null;
}

interface ResultData {
  attempt: {
    id: number;
    percentage: number;
    accuracy: number;
    score: number;
    totalMarks: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    readinessScore: number | null;
    percentile: number | null;
    durationSeconds: number | null;
    status: string;
  };
  test: { id: number; slug: string; title: string; scope: string; durationMinutes: number };
  company: { name: string; slug: string } | null;
  report: {
    sections: SectionReport[];
    topics: { topicId: number; name: string; questions: number; correct: number; accuracy: number; label: string; timeSpentSeconds: number }[];
    difficulties: { difficulty: string; questions: number; correct: number; accuracy: number }[];
    recommendations: { title: string; detail: string; topicId?: number }[];
    seenBefore: number;
    timing: { totalSeconds: number; questionSeconds: number; averagePerQuestion: number; overtimeQuestions: number };
  };
  review: QuestionOutcome[];
  cohort: { attempts: number; averagePercentage: number; bestPercentage: number };
}

export default function TestResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, loading, error, reload } = useApi<ResultData>(attemptId ? `/attempts/${attemptId}/result` : null);
  const [tab, setTab] = useState('summary');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'skipped'>('all');

  if (loading) return <Spinner label="Preparing your report…" />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { attempt, report } = data;
  const readiness = attempt.readinessScore ?? attempt.percentage;

  const filteredReview = data.review.filter((item) =>
    reviewFilter === 'wrong' ? item.isCorrect === false : reviewFilter === 'skipped' ? item.isCorrect === null : true,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to="/mock-tests" className="text-xs underline decoration-dotted underline-offset-2 ink-muted">
          ← All mock tests
        </Link>
        <SectionHeading
          level={1}
          title={data.test.title}
          subtitle={
            <>
              {data.company ? `${data.company.name} · ` : ''}
              {attempt.status === 'auto_submitted' ? 'Auto-submitted when the timer ran out' : 'Submitted'} ·{' '}
              {durationText(attempt.durationSeconds)} taken
            </>
          }
          action={
            <div className="flex gap-2">
              <Link to="/roadmap">
                <Button variant="secondary">Update my roadmap</Button>
              </Link>
              <Link to="/mock-tests">
                <Button>Attempt another</Button>
              </Link>
            </div>
          }
        />
      </div>

      {/* ── Headline ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <SectionHeading level={3} title="Placement readiness from this paper" />
          <HeroScore
            score={readiness}
            caption={`Blends your score (${pctText(attempt.percentage, 1)}) with your accuracy (${pctText(attempt.accuracy, 1)}), so guessing does not inflate it.`}
          />
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Score" value={`${attempt.score}/${attempt.totalMarks}`} accent />
          <Stat label="Percentage" value={pctText(attempt.percentage, 1)} />
          <Stat label="Accuracy" value={pctText(attempt.accuracy, 1)} footnote="Of attempted questions" />
          <Stat label="Correct" value={attempt.correctCount} />
          <Stat label="Incorrect" value={attempt.incorrectCount} />
          <Stat label="Skipped" value={attempt.skippedCount} />
          <Stat
            label="Percentile"
            value={attempt.percentile !== null ? Math.round(attempt.percentile) : '—'}
            footnote={`${data.cohort.attempts} attempt(s) on this test`}
          />
          <Stat label="Time taken" value={durationText(attempt.durationSeconds)} footnote={`${data.test.durationMinutes} min allowed`} />
          <Stat
            label="Cohort average"
            value={pctText(data.cohort.averagePercentage, 1)}
            delta={attempt.percentage - data.cohort.averagePercentage}
            footnote="You vs everyone"
          />
        </div>
      </div>

      {report.seenBefore > 0 ? (
        <Note>
          <strong>
            {report.seenBefore} of these {attempt.correctCount + attempt.incorrectCount + attempt.skippedCount}{' '}
            questions you had answered before.
          </strong>{' '}
          Papers draw fresh questions first, but once you have worked through a topic's pool a repeat is
          unavoidable — treat this score as partly a recall check, and read the topic breakdown below rather
          than the headline number.
        </Note>
      ) : null}

      <Card>
        <div className="mb-2 flex items-center justify-between text-xs ink-2">
          <span>Answer distribution</span>
          <span className="tabular">{attempt.correctCount + attempt.incorrectCount + attempt.skippedCount} questions</span>
        </div>
        <SegmentBar
          height={14}
          segments={[
            { label: 'Correct', value: attempt.correctCount, color: 'var(--good)' },
            { label: 'Incorrect', value: attempt.incorrectCount, color: 'var(--critical)' },
            { label: 'Skipped', value: attempt.skippedCount, color: 'var(--baseline)' },
          ]}
        />
      </Card>

      <Tabs
        tabs={[
          { id: 'summary', label: 'Performance breakdown' },
          { id: 'recommendations', label: 'What to do next', count: report.recommendations.length },
          { id: 'review', label: 'Question review', count: data.review.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'summary' ? (
        <div className="space-y-4">
          <Card>
            <SectionHeading level={3} title="Section-wise performance" />
            <Table
              rows={report.sections}
              keyOf={(row) => row.key}
              columns={[
                { key: 'name', header: 'Section', render: (row) => row.name },
                { key: 'score', header: 'Score', align: 'right', render: (row) => `${row.score}/${row.maxScore}` },
                { key: 'pct', header: '%', align: 'right', render: (row) => pctText(row.percentage, 1) },
                { key: 'correct', header: 'Correct', align: 'right', render: (row) => `${row.correct}/${row.questions}` },
                { key: 'skipped', header: 'Skipped', align: 'right', render: (row) => String(row.skipped) },
                { key: 'acc', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 1) },
                { key: 'time', header: 'Time', align: 'right', render: (row) => durationText(row.timeSpentSeconds) },
                { key: 'band', header: 'Verdict', render: (row) => <BandBadge score={row.percentage} /> },
              ]}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {report.topics.length > 0 ? (
              <MagnitudeBars
                title="Topic-wise accuracy"
                subtitle="Weakest first — these drive your next roadmap."
                data={report.topics.slice(0, 10).map((topic) => ({ name: topic.name, value: topic.accuracy }))}
                valueLabel="Accuracy"
              />
            ) : null}

            {report.difficulties.length > 0 ? (
              <GroupedColumns
                title="Difficulty-wise performance"
                subtitle="Where the marks were won and lost."
                data={report.difficulties.map((entry) => ({
                  label: DIFFICULTY_LABEL[entry.difficulty] ?? entry.difficulty,
                  Correct: entry.correct,
                  Attempted: entry.questions,
                }))}
                series={[
                  { key: 'Correct', label: 'Correct' },
                  { key: 'Attempted', label: 'On the paper' },
                ]}
              />
            ) : null}
          </div>

          <Card>
            <SectionHeading
              level={3}
              title="Time management"
              subtitle="Expected time comes from each question's own difficulty budget."
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Elapsed"
                value={durationText(report.timing.totalSeconds)}
                footnote="Start to submit"
              />
              <Stat
                label="Time on questions"
                value={durationText(report.timing.questionSeconds)}
                footnote="Sum of the per-question timers"
              />
              <Stat
                label="Over-time questions"
                value={report.timing.overtimeQuestions}
                footnote={`Took 50%+ longer than budgeted · avg ${report.timing.averagePerQuestion}s per question`}
              />
              <Stat label="Skipped" value={attempt.skippedCount} footnote="Unattempted" />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'recommendations' ? (
        <div className="space-y-4">
          {report.recommendations.length === 0 ? (
            <Card>
              <Empty title="No weak spots found" hint="Strong paper. Try a harder mock or a different company." />
            </Card>
          ) : (
            <>
              <Card>
                <SectionHeading
                  level={3}
                  title="Recommended preparation"
                  subtitle="Ordered by how much each would move your readiness score."
                />
                <ol className="space-y-3">
                  {report.recommendations.map((recommendation, index) => (
                    <li
                      key={index}
                      className="flex gap-3 rounded-lg border p-3"
                      style={{ borderColor: 'var(--hairline)' }}
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium ink">{recommendation.title}</div>
                        <p className="mt-1 text-xs leading-relaxed ink-2">{recommendation.detail}</p>
                      </div>
                      {recommendation.topicId ? (
                        <Link to={`/practice?topicId=${recommendation.topicId}`} className="shrink-0 self-center">
                          <Button size="sm" variant="secondary">
                            Practise
                          </Button>
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Card>

              <Card>
                <SectionHeading level={3} title="Section verdicts" />
                <ul className="space-y-2.5">
                  {report.sections.map((section) => (
                    <li key={section.key}>
                      <Meter
                        value={section.percentage}
                        label={section.name}
                        right={`${pctText(section.percentage, 1)} · ${section.label}`}
                        height={7}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      ) : null}

      {tab === 'review' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'wrong', 'skipped'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setReviewFilter(filter)}
                className="rounded-md px-3 py-1.5 text-xs font-medium"
                style={
                  reviewFilter === filter
                    ? { background: 'var(--brand-wash)', color: 'var(--brand-strong)' }
                    : { background: 'var(--surface-2)', color: 'var(--ink-2)' }
                }
              >
                {filter === 'all' ? 'All questions' : filter === 'wrong' ? 'Got wrong' : 'Skipped'}
                <span className="ml-1.5 tabular">
                  {filter === 'all'
                    ? data.review.length
                    : filter === 'wrong'
                      ? data.review.filter((item) => item.isCorrect === false).length
                      : data.review.filter((item) => item.isCorrect === null).length}
                </span>
              </button>
            ))}
          </div>

          {filteredReview.length === 0 ? (
            <Card>
              <Empty title="Nothing here" hint="Good news — no questions in this category." />
            </Card>
          ) : (
            filteredReview.map((item, index) => (
              <Card key={item.questionId}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold ink-muted">#{index + 1}</span>
                    <Badge
                      tone={item.isCorrect === true ? 'good' : item.isCorrect === false ? 'critical' : 'neutral'}
                      icon={item.isCorrect === true ? '✓' : item.isCorrect === false ? '✕' : '–'}
                    >
                      {item.isCorrect === true ? 'Correct' : item.isCorrect === false ? 'Incorrect' : 'Skipped'}
                    </Badge>
                    <Badge>{DIFFICULTY_LABEL[item.difficulty]}</Badge>
                    {item.detail?.topic ? <Badge tone="neutral">{item.detail.topic}</Badge> : null}
                  </div>
                  <span className="text-xs tabular ink-muted">
                    {item.timeSpentSeconds}s spent / {item.expectedSeconds}s budget ·{' '}
                    {item.marksAwarded >= 0 ? '+' : ''}
                    {item.marksAwarded} marks
                  </span>
                </div>

                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed ink">{item.detail?.body}</p>

                <ul className="mb-3 space-y-1.5">
                  {(item.detail?.options ?? []).map((option) => {
                    const chosen = item.selected.includes(option.label);
                    return (
                      <li key={option.label}>
                        <div
                          className={cx('flex items-start gap-2.5 rounded-lg border p-2.5 text-sm')}
                          style={{
                            borderColor: option.isCorrect
                              ? 'var(--good)'
                              : chosen
                                ? 'var(--critical)'
                                : 'var(--hairline)',
                            background: option.isCorrect
                              ? 'color-mix(in srgb, var(--good) 8%, transparent)'
                              : chosen
                                ? 'color-mix(in srgb, var(--critical) 8%, transparent)'
                                : 'transparent',
                          }}
                        >
                          <span className="text-xs font-semibold ink-muted">{option.label}</span>
                          <span className="min-w-0 flex-1 ink">{option.body}</span>
                          {option.isCorrect ? <span className="text-xs" style={{ color: 'var(--good-text)' }}>Correct</span> : null}
                          {chosen && !option.isCorrect ? (
                            <span className="text-xs" style={{ color: 'var(--critical-text)' }}>
                              Your answer
                            </span>
                          ) : null}
                        </div>
                        {chosen && !option.isCorrect && option.whyWrong ? (
                          <p className="mt-1 ml-7 text-xs" style={{ color: 'var(--critical-text)' }}>
                            {option.whyWrong}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {item.detail?.explanation ? (
                  <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide ink-muted">Explanation</h4>
                    <p className="text-sm leading-relaxed ink-2">{item.detail.explanation}</p>
                    {item.detail.conceptNote ? (
                      <p className="mt-2 text-xs italic ink-muted">{item.detail.conceptNote}</p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
