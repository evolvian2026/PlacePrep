import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { pctText } from '../../lib/format';
import {
  Badge,
  Card,
  Empty,
  ErrorNote,
  Note,
  SectionHeading,
  Select,
  Spinner,
  Stat,
  Table,
} from '../../components/ui';
import { MagnitudeBars, SegmentBar } from '../../components/charts';

interface CohortData {
  overview: {
    students: number;
    active: number;
    neverAttempted: number;
    averageReadiness: number;
    medianReadiness: number;
    bands: { band: string; students: number }[];
    branches: { branch: string; students: number; averageReadiness: number }[];
  };
  companies: {
    companyId: number;
    company: string;
    slug: string;
    tracking: number;
    averageReadiness: number;
    ready: number;
    targetDate: string | null;
  }[];
  dormant: { id: number; name: string; email: string; branch: string | null; created_at: string }[];
}

const BAND_LABEL: Record<string, string> = {
  weak: 'Weak',
  average: 'Average',
  strong: 'Strong',
  excellent: 'Excellent',
};

// Ordered worst to best, using the same semantic colours the student sees on
// their own readiness dial so the two views never contradict each other.
const BAND_COLOR: Record<string, string> = {
  weak: 'var(--critical)',
  average: 'var(--warning)',
  strong: 'var(--brand)',
  excellent: 'var(--good)',
};

export default function AdminCohort() {
  const [collegeId, setCollegeId] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');

  const { data: collegeData } = useApi<{ colleges: { id: number; name: string; students: number }[] }>(
    '/admin/colleges',
  );
  const { data, loading, error, reload } = useApi<CohortData>('/admin/cohort', {
    collegeId: collegeId || undefined,
    branch: branch || undefined,
    graduationYear: year || undefined,
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Cohort readiness"
        subtitle="How prepared this group is, for which companies, and who has not started."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="College"
            value={collegeId}
            onChange={setCollegeId}
            options={[
              { value: '', label: 'All colleges' },
              ...(collegeData?.colleges ?? []).map((college) => ({
                value: String(college.id),
                label: `${college.name} (${college.students})`,
              })),
            ]}
          />
          <Select
            label="Branch"
            value={branch}
            onChange={setBranch}
            options={[
              { value: '', label: 'All branches' },
              ...['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'].map((value) => ({ value, label: value })),
            ]}
          />
          <Select
            label="Graduating"
            value={year}
            onChange={setYear}
            options={[
              { value: '', label: 'All years' },
              ...['2026', '2027', '2028'].map((value) => ({ value, label: value })),
            ]}
          />
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        data.overview.students === 0 ? (
          <Card>
            <Empty title="No students match those filters" hint="Try clearing the college or branch filter." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Students" value={data.overview.students} accent />
              <Stat label="Have started" value={data.overview.active} />
              <Stat
                label="Not started"
                value={data.overview.neverAttempted}
                footnote="No mock or practice yet"
              />
              <Stat label="Average readiness" value={pctText(data.overview.averageReadiness, 1)} />
              <Stat
                label="Median readiness"
                value={pctText(data.overview.medianReadiness, 1)}
                footnote="Half are below this"
              />
            </div>

            <Card>
              <SectionHeading
                level={3}
                title="Readiness spread"
                subtitle="A cohort average hides its tail — this is the shape of it."
              />
              <SegmentBar
                height={16}
                segments={data.overview.bands.map((band) => ({
                  label: BAND_LABEL[band.band] ?? band.band,
                  value: band.students,
                  color: BAND_COLOR[band.band] ?? 'var(--brand)',
                }))}
              />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <MagnitudeBars
                  title="Readiness by branch"
                  subtitle="Average across every company each student is tracking."
                  data={data.overview.branches.map((row) => ({
                    name: row.branch,
                    value: row.averageReadiness,
                    meta: `${row.students} student${row.students === 1 ? '' : 's'}`,
                  }))}
                />
              </Card>

              <Card>
                <SectionHeading
                  level={3}
                  title="By company"
                  subtitle="Soonest drive first. 'Ready' uses the same bar the student sees."
                />
                <Table
                  rows={data.companies}
                  keyOf={(row) => row.companyId}
                  empty="No students are tracking a company yet."
                  columns={[
                    {
                      key: 'company',
                      header: 'Company',
                      render: (row) => (
                        <Link to={`/admin/companies`} className="hover:underline">
                          {row.company}
                        </Link>
                      ),
                    },
                    {
                      key: 'drive',
                      header: 'Drive',
                      render: (row) => row.targetDate ?? <span className="ink-muted">Not set</span>,
                    },
                    { key: 'tracking', header: 'Tracking', align: 'right', render: (row) => String(row.tracking) },
                    {
                      key: 'ready',
                      header: 'Ready',
                      align: 'right',
                      render: (row) => (
                        <Badge tone={row.ready > 0 ? 'good' : 'neutral'}>
                          {row.ready}/{row.tracking}
                        </Badge>
                      ),
                    },
                    {
                      key: 'avg',
                      header: 'Avg readiness',
                      align: 'right',
                      render: (row) => pctText(row.averageReadiness, 1),
                    },
                  ]}
                />
              </Card>
            </div>

            <Card>
              <SectionHeading
                level={3}
                title="Not started yet"
                subtitle="Students with no mock attempt and no practice activity."
              />
              <Note>
                This list exists to be acted on — a nudge, an email, a session — not to rank anyone. Readiness
                is a measure of preparation so far, not of ability.
              </Note>
              <div className="mt-3">
                <Table
                  rows={data.dormant}
                  keyOf={(row) => row.id}
                  empty="Everyone in this cohort has started."
                  columns={[
                    { key: 'name', header: 'Student', render: (row) => row.name },
                    { key: 'email', header: 'Email', render: (row) => row.email },
                    { key: 'branch', header: 'Branch', render: (row) => row.branch ?? '—' },
                    {
                      key: 'joined',
                      header: 'Joined',
                      align: 'right',
                      render: (row) => row.created_at.slice(0, 10),
                    },
                  ]}
                />
              </div>
            </Card>
          </>
        )
      ) : null}
    </div>
  );
}
