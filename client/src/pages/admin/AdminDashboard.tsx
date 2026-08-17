import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { CATEGORY_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { Card, ErrorNote, SectionHeading, Spinner, Stat } from '../../components/ui';
import { ActivityArea, MagnitudeBars, GroupedColumns } from '../../components/charts';

interface Overview {
  counts: {
    companies: number;
    rounds: number;
    questions: number;
    coding: number;
    mocks: number;
    students: number;
    attempts: number;
    submissions: number;
  };
  questionMix: { difficulty: string; count: number }[];
  byCategory: { category: string; count: number }[];
  recentActivity: { day: string; attempts: number; students: number }[];
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi<Overview>('/admin/overview');

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { counts } = data;

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Admin dashboard"
        subtitle="Content health and platform activity at a glance."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Companies" value={counts.companies} />
        <Stat label="Rounds" value={counts.rounds} />
        <Stat label="Questions" value={counts.questions} accent />
        <Stat label="Coding problems" value={counts.coding} />
        <Stat label="Mock tests" value={counts.mocks} />
        <Stat label="Students" value={counts.students} />
        <Stat label="Attempts" value={counts.attempts} />
        <Stat label="Code submissions" value={counts.submissions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupedColumns
          title="Question bank by difficulty"
          subtitle="A healthy bank skews medium, with enough hard questions for product-based mocks."
          data={['easy', 'medium', 'hard'].map((difficulty) => ({
            label: DIFFICULTY_LABEL[difficulty],
            Questions: data.questionMix.find((entry) => entry.difficulty === difficulty)?.count ?? 0,
          }))}
          series={[{ key: 'Questions', label: 'Questions' }]}
        />

        <MagnitudeBars
          title="Coverage by subject area"
          subtitle="Question counts per category — thin areas are where mock assembly will fall short."
          data={data.byCategory.map((entry) => ({
            name: CATEGORY_LABEL[entry.category] ?? entry.category,
            value: entry.count,
          }))}
          unit=""
          valueLabel="Questions"
        />
      </div>

      {data.recentActivity.length > 0 ? (
        <ActivityArea
          title="Mock test attempts (last 30 days)"
          subtitle="Submitted attempts per day."
          data={data.recentActivity.map((day) => ({ label: day.day.slice(5), value: day.attempts }))}
          height={220}
        />
      ) : (
        <Card>
          <p className="py-8 text-center text-sm ink-muted">No attempts recorded in the last 30 days.</p>
        </Card>
      )}

      <Card>
        <SectionHeading level={3} title="Quick actions" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/admin/companies', label: 'Add a company', hint: 'Configure hiring process and eligibility' },
            { to: '/admin/questions', label: 'Bulk import questions', hint: 'CSV or JSON upload with validation' },
            { to: '/admin/mock-tests', label: 'Build a mock test', hint: 'Rule-based or hand-picked papers' },
            { to: '/admin/analytics', label: 'Review analytics', hint: 'Hardest questions and readiness spread' },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="rounded-lg border p-3 transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <div className="text-sm font-medium ink">{action.label}</div>
              <div className="mt-0.5 text-xs ink-muted">{action.hint}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
