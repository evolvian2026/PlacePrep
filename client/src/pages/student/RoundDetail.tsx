import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { DIFFICULTY_LABEL, ROUND_TYPE_LABEL, durationText, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Meter,
  SectionHeading,
  Spinner,
  Stat,
  Table,
} from '../../components/ui';
import { GroupedColumns, MagnitudeBars } from '../../components/charts';

interface RoundTopic {
  id: number;
  name: string;
  slug: string;
  category: string;
  estHours: number;
  importance: string;
  questionCounts: { total: number; easy: number; medium: number; hard: number };
  mastery: number;
  attempted: number;
  correct: number;
  accuracy: number;
  resources: { title: string; type: string; url: string | null; provider: string | null; estMinutes: number | null }[];
}

interface RoundDetailData {
  company: { id: number; name: string; slug: string };
  round: {
    id: number;
    name: string;
    slug: string;
    roundType: string;
    sequence: number;
    description: string | null;
    durationMinutes: number | null;
    difficulty: string;
    estimatedPrepHours: number;
    elimination: boolean;
    negativeMarking: number;
    sectionLock: boolean;
  };
  stats: {
    totalQuestions: number;
    easy: number;
    medium: number;
    hard: number;
    attempted: number;
    correct: number;
    accuracy: number;
    averageTimeSeconds: number;
  };
  topics: RoundTopic[];
  weakTopics: { id: number; name: string; mastery: number }[];
  mockTests: { id: number; slug: string; title: string; scope: string; durationMinutes: number; totalMarks: number }[];
}

export default function RoundDetail() {
  const { slug, roundSlug } = useParams<{ slug: string; roundSlug: string }>();
  const { data, loading, error, reload } = useApi<RoundDetailData>(
    slug && roundSlug ? `/companies/${slug}/rounds/${roundSlug}` : null,
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { round, stats, topics } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/companies/${data.company.slug}`} className="text-xs underline decoration-dotted underline-offset-2 ink-muted">
          ← {data.company.name} roadmap
        </Link>
        <SectionHeading
          level={1}
          title={round.name}
          subtitle={round.description ?? undefined}
          action={
            <div className="flex flex-wrap gap-2">
              <Link to={`/practice?roundId=${round.id}`}>
                <Button variant="secondary">Practise this round</Button>
              </Link>
              <Link to="/mock-tests">
                <Button>Attempt round mock</Button>
              </Link>
            </div>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{ROUND_TYPE_LABEL[round.roundType]}</Badge>
          <Badge>{DIFFICULTY_LABEL[round.difficulty]}</Badge>
          {round.elimination ? <Badge tone="serious" icon="!">Eliminating round</Badge> : null}
          {round.durationMinutes ? <Badge>{round.durationMinutes} minutes</Badge> : null}
          {round.negativeMarking > 0 ? <Badge tone="warning" icon="−">{round.negativeMarking} per wrong answer</Badge> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total questions" value={stats.totalQuestions} />
        <Stat label="Easy" value={stats.easy} />
        <Stat label="Medium" value={stats.medium} />
        <Stat label="Hard" value={stats.hard} />
        <Stat label="Solved" value={stats.correct} footnote={`${stats.attempted} attempted`} />
        <Stat label="Accuracy" value={pctText(stats.accuracy, 1)} accent footnote={`Avg ${durationText(stats.averageTimeSeconds)} / question`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MagnitudeBars
          title="Topic mastery in this round"
          subtitle="Ordered weakest first — the order your plan will attack them in."
          data={topics.map((topic) => ({ name: topic.name, value: topic.mastery })).sort((a, b) => a.value - b.value).slice(0, 10)}
          valueLabel="Mastery"
        />

        <GroupedColumns
          title="Question bank by difficulty"
          subtitle="What is available to practise for this round."
          data={[
            { label: 'Easy', Available: stats.easy },
            { label: 'Medium', Available: stats.medium },
            { label: 'Hard', Available: stats.hard },
          ]}
          series={[{ key: 'Available', label: 'Questions available' }]}
        />
      </div>

      {data.weakTopics.length > 0 ? (
        <Card>
          <SectionHeading level={3} title="Recommended focus" subtitle="Weakest topics in this round, in priority order." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.weakTopics.map((topic) => (
              <Link
                key={topic.id}
                to={`/practice?topicId=${topic.id}`}
                className="rounded-lg border p-3 transition-opacity hover:opacity-80"
                style={{ borderColor: 'var(--hairline)' }}
              >
                <div className="mb-2 truncate text-sm font-medium ink">{topic.name}</div>
                <Meter value={topic.mastery} right={pctText(topic.mastery)} height={6} />
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeading level={3} title="Topics in this round" subtitle="Practise topic-wise, then verify with a sectional mock." />
        <Table
          rows={topics}
          keyOf={(row) => row.id}
          empty="No topics configured for this round yet."
          columns={[
            {
              key: 'name',
              header: 'Topic',
              render: (row) => (
                <div>
                  <Link to={`/practice?topicId=${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-[11px] ink-muted">
                    {row.importance === 'core' ? 'Core' : row.importance === 'recommended' ? 'Recommended' : 'Optional'} ·{' '}
                    {row.estHours}h estimated
                  </div>
                </div>
              ),
            },
            {
              key: 'bank',
              header: 'Questions',
              align: 'right',
              render: (row) => (
                <span className="text-xs">
                  <span className="font-medium ink">{row.questionCounts.total}</span>
                  <span className="ink-muted">
                    {' '}
                    ({row.questionCounts.easy}/{row.questionCounts.medium}/{row.questionCounts.hard})
                  </span>
                </span>
              ),
            },
            { key: 'attempted', header: 'Attempted', align: 'right', render: (row) => String(row.attempted) },
            { key: 'accuracy', header: 'Accuracy', align: 'right', render: (row) => (row.attempted ? pctText(row.accuracy, 1) : '—') },
            {
              key: 'mastery',
              header: 'Mastery',
              width: '150px',
              render: (row) => <Meter value={row.mastery} right={pctText(row.mastery)} height={6} />,
            },
            {
              key: 'go',
              header: '',
              align: 'right',
              render: (row) => (
                <Link to={`/practice?topicId=${row.id}`}>
                  <Button size="sm" variant="secondary">
                    Practise
                  </Button>
                </Link>
              ),
            },
          ]}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading level={3} title="Mock tests for this round" />
          {data.mockTests.length === 0 ? (
            <Empty title="No mocks configured" />
          ) : (
            <ul className="space-y-2">
              {data.mockTests.map((mock) => (
                <li
                  key={mock.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  style={{ borderColor: 'var(--hairline)' }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium ink">{mock.title}</div>
                    <div className="text-xs tabular ink-muted">
                      {mock.durationMinutes} min · {mock.totalMarks} marks
                    </div>
                  </div>
                  <Link to="/mock-tests">
                    <Button size="sm">Start</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading level={3} title="Recommended resources" subtitle="Reference material attached to this round's topics." />
          {topics.every((topic) => topic.resources.length === 0) ? (
            <Empty title="No resources attached yet" hint="Your placement cell can add reading material from the admin console." />
          ) : (
            <ul className="space-y-2">
              {topics
                .flatMap((topic) => topic.resources.map((resource) => ({ ...resource, topic: topic.name })))
                .slice(0, 8)
                .map((resource, index) => (
                  <li key={index} className="rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium ink">{resource.title}</div>
                        <div className="text-[11px] ink-muted">
                          {resource.topic} · {resource.type}
                          {resource.estMinutes ? ` · ${resource.estMinutes} min` : ''}
                        </div>
                      </div>
                      {resource.url ? (
                        <a href={resource.url} target="_blank" rel="noreferrer" className="text-xs underline ink-muted">
                          Open
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
