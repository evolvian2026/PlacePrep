import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { CATEGORY_LABEL, dateTimeText, durationText, pctText } from '../../lib/format';
import {
  BandBadge,
  Card,
  Empty,
  ErrorNote,
  Meter,
  SectionHeading,
  Spinner,
  Stat,
  Table,
} from '../../components/ui';
import { ActivityArea, GroupedColumns, MagnitudeBars, TrendLine } from '../../components/charts';

interface PerformanceData {
  trend: { date: string; percentage: number; accuracy: number; title: string }[];
  topics: {
    topicId: number;
    name: string;
    category: string;
    attempted: number;
    correct: number;
    accuracy: number;
    mastery: number;
    isCompleted: boolean;
    averageTimeSeconds: number;
    difficulty: {
      easy: { attempted: number; correct: number };
      medium: { attempted: number; correct: number };
      hard: { attempted: number; correct: number };
    };
  }[];
  weakAreas: { name: string; mastery: number; topicId: number }[];
  strongAreas: { name: string; mastery: number; topicId: number }[];
  consistency: { current: number; longest: number; activeToday: boolean; last30: { day: string; questions: number; minutes: number }[] };
  coding: { solved: number; acceptanceRate: number; byDifficulty: { difficulty: string; solved: number; total: number }[] };
  attempts: {
    id: number;
    title: string;
    company_name: string | null;
    percentage: number;
    accuracy: number;
    status: string;
    duration_seconds: number | null;
    percentile: number | null;
    submitted_at: string | null;
  }[];
  improvement: { early: number; recent: number; delta: number; samples: number };
}

export default function Performance() {
  const { data, loading, error, reload } = useApi<PerformanceData>('/performance');

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const difficultyTotals = data.topics.reduce(
    (acc, topic) => ({
      easy: {
        attempted: acc.easy.attempted + topic.difficulty.easy.attempted,
        correct: acc.easy.correct + topic.difficulty.easy.correct,
      },
      medium: {
        attempted: acc.medium.attempted + topic.difficulty.medium.attempted,
        correct: acc.medium.correct + topic.difficulty.medium.correct,
      },
      hard: {
        attempted: acc.hard.attempted + topic.difficulty.hard.attempted,
        correct: acc.hard.correct + topic.difficulty.hard.correct,
      },
    }),
    {
      easy: { attempted: 0, correct: 0 },
      medium: { attempted: 0, correct: 0 },
      hard: { attempted: 0, correct: 0 },
    },
  );

  const byCategory = Object.entries(
    data.topics.reduce<Record<string, { total: number; count: number }>>((acc, topic) => {
      const entry = acc[topic.category] ?? { total: 0, count: 0 };
      entry.total += topic.mastery;
      entry.count += 1;
      acc[topic.category] = entry;
      return acc;
    }, {}),
  ).map(([category, value]) => ({
    name: CATEGORY_LABEL[category] ?? category,
    value: Math.round((value.total / value.count) * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Performance"
        subtitle="Score trends, topic mastery, difficulty progression and how consistently you are preparing."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Mock tests" value={data.attempts.length} />
        <Stat
          label="Recent average"
          value={pctText(data.improvement.recent, 1)}
          delta={data.improvement.samples >= 2 ? data.improvement.delta : null}
          footnote={data.improvement.samples >= 2 ? `vs ${pctText(data.improvement.early, 1)} early on` : 'Needs 2+ tests'}
        />
        <Stat label="Topics practised" value={data.topics.length} />
        <Stat label="Topics mastered" value={data.topics.filter((topic) => topic.isCompleted).length} accent />
        <Stat label="Current streak" value={`${data.consistency.current}d`} footnote={`Longest ${data.consistency.longest}d`} />
        <Stat label="Coding solved" value={data.coding.solved} footnote={pctText(data.coding.acceptanceRate, 0) + ' acceptance'} />
      </div>

      {data.trend.length >= 2 ? (
        <TrendLine
          title="Score trend across mock tests"
          subtitle="Percentage and accuracy over time. Accuracy rising faster than score usually means you are attempting fewer questions."
          data={data.trend.map((point, index) => ({
            label: `T${index + 1}`,
            Score: point.percentage,
            Accuracy: point.accuracy,
          }))}
          series={[
            { key: 'Score', label: 'Score %' },
            { key: 'Accuracy', label: 'Accuracy %' },
          ]}
        />
      ) : (
        <Card>
          <Empty
            title="Not enough data for a trend yet"
            hint="Attempt at least two mock tests and your score trajectory will appear here."
          />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {byCategory.length > 0 ? (
          <MagnitudeBars
            title="Mastery by subject area"
            subtitle="Averaged across the topics you have practised in each area."
            data={byCategory.sort((a, b) => b.value - a.value)}
            valueLabel="Mastery"
          />
        ) : null}

        <GroupedColumns
          title="Difficulty progression"
          subtitle="Are you converting harder questions, or only the easy ones?"
          data={[
            { label: 'Easy', Correct: difficultyTotals.easy.correct, Attempted: difficultyTotals.easy.attempted },
            { label: 'Medium', Correct: difficultyTotals.medium.correct, Attempted: difficultyTotals.medium.attempted },
            { label: 'Hard', Correct: difficultyTotals.hard.correct, Attempted: difficultyTotals.hard.attempted },
          ]}
          series={[
            { key: 'Correct', label: 'Correct' },
            { key: 'Attempted', label: 'Attempted' },
          ]}
        />
      </div>

      {data.consistency.last30.length > 1 ? (
        <ActivityArea
          title="Preparation consistency"
          subtitle="Questions answered per active day. Regular short sessions beat occasional long ones."
          data={data.consistency.last30.map((day) => ({ label: day.day.slice(5), value: day.questions }))}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading level={3} title="Weak areas" subtitle="Where the next hour of study pays off most." />
          {data.weakAreas.length === 0 ? (
            <Empty title="Nothing practised yet" />
          ) : (
            <ul className="space-y-2.5">
              {data.weakAreas.map((area) => (
                <li key={area.topicId}>
                  <Meter
                    value={area.mastery}
                    label={
                      <Link to={`/practice?topicId=${area.topicId}`} className="hover:underline">
                        {area.name}
                      </Link>
                    }
                    right={pctText(area.mastery)}
                    height={6}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading level={3} title="Strong areas" subtitle="Maintain with short revision sets." />
          {data.strongAreas.length === 0 ? (
            <Empty title="Nothing practised yet" />
          ) : (
            <ul className="space-y-2.5">
              {data.strongAreas.map((area) => (
                <li key={area.topicId}>
                  <Meter value={area.mastery} label={area.name} right={pctText(area.mastery)} height={6} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionHeading level={3} title="Topic-wise detail" subtitle="Accuracy, mastery and pace for every topic you have touched." />
        <Table
          rows={data.topics}
          keyOf={(row) => row.topicId}
          empty="No topics practised yet."
          columns={[
            {
              key: 'name',
              header: 'Topic',
              render: (row) => (
                <div>
                  <Link to={`/practice?topicId=${row.topicId}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-[11px] ink-muted">{CATEGORY_LABEL[row.category] ?? row.category}</div>
                </div>
              ),
            },
            { key: 'attempted', header: 'Attempted', align: 'right', render: (row) => String(row.attempted) },
            { key: 'correct', header: 'Correct', align: 'right', render: (row) => String(row.correct) },
            { key: 'accuracy', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 1) },
            {
              key: 'split',
              header: 'E / M / H',
              align: 'right',
              render: (row) => (
                <span className="text-xs ink-muted">
                  {row.difficulty.easy.correct}/{row.difficulty.easy.attempted} ·{' '}
                  {row.difficulty.medium.correct}/{row.difficulty.medium.attempted} ·{' '}
                  {row.difficulty.hard.correct}/{row.difficulty.hard.attempted}
                </span>
              ),
            },
            { key: 'time', header: 'Avg time', align: 'right', render: (row) => `${row.averageTimeSeconds}s` },
            {
              key: 'mastery',
              header: 'Mastery',
              width: '150px',
              render: (row) => <Meter value={row.mastery} right={pctText(row.mastery)} height={6} />,
            },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading level={3} title="All attempts" />
        <Table
          rows={data.attempts}
          keyOf={(row) => row.id}
          empty="No mock tests attempted yet."
          columns={[
            {
              key: 'title',
              header: 'Test',
              render: (row) => (
                <Link to={`/results/${row.id}`} className="font-medium hover:underline">
                  {row.title}
                  {row.company_name ? <span className="ink-muted"> · {row.company_name}</span> : null}
                </Link>
              ),
            },
            { key: 'score', header: 'Score', align: 'right', render: (row) => pctText(row.percentage, 1) },
            { key: 'accuracy', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 1) },
            {
              key: 'percentile',
              header: 'Percentile',
              align: 'right',
              render: (row) => (row.percentile !== null ? Math.round(row.percentile) : '—'),
            },
            { key: 'time', header: 'Time', align: 'right', render: (row) => durationText(row.duration_seconds) },
            { key: 'band', header: 'Verdict', render: (row) => <BandBadge score={row.percentage} /> },
            {
              key: 'when',
              header: 'When',
              align: 'right',
              render: (row) => <span className="text-xs ink-muted">{dateTimeText(row.submitted_at)}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
