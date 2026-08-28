import { useApi } from '../../lib/hooks';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, pctText } from '../../lib/format';
import { Badge, Card, ErrorNote, Meter, Note, SectionHeading, Spinner, Stat, Table } from '../../components/ui';
import { MagnitudeBars, GroupedColumns } from '../../components/charts';

interface Analytics {
  mostAttemptedCompanies: { name: string; slug: string; followers: number; attempts: number; avg_score: number }[];
  popularTests: { title: string; slug: string; scope: string; attempts: number; avg_score: number; completion_rate: number }[];
  hardestQuestions: {
    publicId: string;
    preview: string;
    declaredDifficulty: string;
    topic: string | null;
    attempts: number;
    accuracy: number;
    skipped: number;
  }[];
  mostSkippedQuestions: { publicId: string; preview: string; topic: string | null; skipped: number; attempts: number }[];
  miscalibrated: { publicId: string; topic: string | null; declaredDifficulty: string; accuracy: number; attempts: number }[];
  topicPerformance: { name: string; category: string; students: number; avg_mastery: number; avg_accuracy: number }[];
  readinessDistribution: { bucket: string; students: number }[];
  completion: { started: number; submitted: number; abandoned: number; completionRate: number };
}

export default function AdminAnalytics() {
  const { data, loading, error, reload } = useApi<Analytics>('/admin/analytics');
  const integrity = useApi<{ attempts: IntegrityRow[] }>('/admin/attempts/integrity');

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Analytics"
        subtitle="Where students struggle, which content works, and how ready the cohort is."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Attempts started" value={data.completion.started} />
        <Stat label="Attempts submitted" value={data.completion.submitted} accent />
        <Stat label="Abandoned" value={data.completion.abandoned} />
        <Stat label="Completion rate" value={pctText(data.completion.completionRate, 1)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.readinessDistribution.length > 0 ? (
          <GroupedColumns
            title="Cohort readiness distribution"
            subtitle="Students bucketed by their best company readiness score."
            data={data.readinessDistribution.map((bucket) => ({ label: bucket.bucket, Students: bucket.students }))}
            series={[{ key: 'Students', label: 'Students' }]}
          />
        ) : (
          <Card>
            <p className="py-8 text-center text-sm ink-muted">No readiness data yet.</p>
          </Card>
        )}

        {data.topicPerformance.length > 0 ? (
          <MagnitudeBars
            title="Weakest topics across the cohort"
            subtitle="Average mastery, lowest first — these are the topics to teach."
            data={data.topicPerformance.slice(0, 10).map((topic) => ({ name: topic.name, value: topic.avg_mastery }))}
            valueLabel="Avg mastery"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading level={3} title="Most attempted companies" />
          <Table
            rows={data.mostAttemptedCompanies}
            keyOf={(row) => row.slug}
            empty="No company activity yet."
            columns={[
              { key: 'name', header: 'Company', render: (row) => row.name },
              { key: 'followers', header: 'Following', align: 'right', render: (row) => String(row.followers) },
              { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => String(row.attempts) },
              { key: 'avg', header: 'Avg score', align: 'right', render: (row) => (row.attempts ? pctText(row.avg_score, 1) : '—') },
            ]}
          />
        </Card>

        <Card>
          <SectionHeading level={3} title="Most popular mock tests" />
          <Table
            rows={data.popularTests}
            keyOf={(row) => row.slug}
            empty="No attempts yet."
            columns={[
              { key: 'title', header: 'Test', render: (row) => <span className="block max-w-xs truncate">{row.title}</span> },
              { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => String(row.attempts) },
              { key: 'avg', header: 'Avg score', align: 'right', render: (row) => pctText(row.avg_score, 1) },
              { key: 'completion', header: 'Completion', align: 'right', render: (row) => pctText(row.completion_rate, 0) },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            level={3}
            title="Hardest questions"
            subtitle="Lowest observed accuracy — check these are hard, not broken."
          />
          <Table
            rows={data.hardestQuestions}
            keyOf={(row) => row.publicId}
            empty="Not enough answer data yet."
            columns={[
              {
                key: 'q',
                header: 'Question',
                render: (row) => (
                  <div className="max-w-sm">
                    <span className="text-[11px] font-mono ink-muted">{row.publicId}</span>
                    <p className="line-clamp-2 text-xs ink">{row.preview}</p>
                  </div>
                ),
              },
              { key: 'topic', header: 'Topic', render: (row) => <span className="text-xs">{row.topic ?? '—'}</span> },
              { key: 'declared', header: 'Declared', render: (row) => DIFFICULTY_LABEL[row.declaredDifficulty] },
              { key: 'accuracy', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 0) },
              { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => String(row.attempts) },
            ]}
          />
        </Card>

        <Card>
          <SectionHeading
            level={3}
            title="Most skipped questions"
            subtitle="High skip rates usually mean an unclear statement or an unrealistic time budget."
          />
          <Table
            rows={data.mostSkippedQuestions}
            keyOf={(row) => row.publicId}
            empty="Not enough data yet."
            columns={[
              {
                key: 'q',
                header: 'Question',
                render: (row) => (
                  <div className="max-w-sm">
                    <span className="text-[11px] font-mono ink-muted">{row.publicId}</span>
                    <p className="line-clamp-2 text-xs ink">{row.preview}</p>
                  </div>
                ),
              },
              { key: 'topic', header: 'Topic', render: (row) => <span className="text-xs">{row.topic ?? '—'}</span> },
              { key: 'skipped', header: 'Skipped', align: 'right', render: (row) => String(row.skipped) },
              { key: 'attempts', header: 'Answered', align: 'right', render: (row) => String(row.attempts) },
            ]}
          />
        </Card>
      </div>

      <Card>
        <SectionHeading
          level={3}
          title="Difficulty calibration"
          subtitle="Questions whose observed accuracy contradicts their declared difficulty."
        />
        {data.miscalibrated.length === 0 ? (
          <Note>
            No miscalibrated questions detected. This check needs at least three recorded answers per question, so it
            fills in as students work through the bank.
          </Note>
        ) : (
          <Table
            rows={data.miscalibrated}
            keyOf={(row) => row.publicId}
            columns={[
              { key: 'id', header: 'QID', render: (row) => <span className="font-mono text-xs">{row.publicId}</span> },
              { key: 'topic', header: 'Topic', render: (row) => row.topic ?? '—' },
              { key: 'declared', header: 'Declared', render: (row) => <Badge>{DIFFICULTY_LABEL[row.declaredDifficulty]}</Badge> },
              { key: 'accuracy', header: 'Observed accuracy', align: 'right', render: (row) => pctText(row.accuracy, 0) },
              { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => String(row.attempts) },
              {
                key: 'suggestion',
                header: 'Suggestion',
                render: (row) => (
                  <span className="text-xs ink-2">
                    {row.declaredDifficulty === 'easy'
                      ? 'Consider re-tagging as medium or hard'
                      : 'Consider re-tagging as medium or easy'}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={3} title="Topic performance across the cohort" />
        <Table
          rows={data.topicPerformance}
          keyOf={(row) => row.name}
          empty="No topic activity yet."
          columns={[
            { key: 'name', header: 'Topic', render: (row) => row.name },
            { key: 'category', header: 'Area', render: (row) => CATEGORY_LABEL[row.category] ?? row.category },
            { key: 'students', header: 'Students', align: 'right', render: (row) => String(row.students) },
            { key: 'accuracy', header: 'Avg accuracy', align: 'right', render: (row) => pctText(row.avg_accuracy, 1) },
            {
              key: 'mastery',
              header: 'Avg mastery',
              width: '160px',
              render: (row) => <Meter value={row.avg_mastery} right={pctText(row.avg_mastery)} height={6} />,
            },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading
          level={3}
          title="Test integrity signals"
          subtitle="Attempts where the browser reported the student leaving the paper."
        />
        <Note>
          These are browser hints — a notification stealing focus looks the same as a deliberate switch. Treat
          them as a prompt to ask, never as evidence. Nothing here affects anyone's score.
        </Note>
        <div className="mt-3">
          <Table
            rows={integrity.data?.attempts ?? []}
            keyOf={(row) => row.attemptId}
            empty="No integrity signals recorded yet."
            columns={[
              { key: 'student', header: 'Student', render: (row) => row.student },
              { key: 'test', header: 'Mock test', render: (row) => row.test },
              {
                key: 'signals',
                header: 'What was recorded',
                render: (row) => row.integrity.notes.join(' ') || '—',
              },
              {
                key: 'level',
                header: 'Level',
                align: 'right',
                render: (row) => (
                  <Badge tone={row.integrity.level === 'notable' ? 'warning' : 'neutral'}>
                    {row.integrity.level}
                  </Badge>
                ),
              },
              {
                key: 'score',
                header: 'Score',
                align: 'right',
                render: (row) => pctText(row.percentage, 1),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

interface IntegrityRow {
  attemptId: number;
  student: string;
  email: string;
  test: string;
  submittedAt: string | null;
  percentage: number;
  integrity: { level: string; notes: string[]; awaySeconds: number };
}
