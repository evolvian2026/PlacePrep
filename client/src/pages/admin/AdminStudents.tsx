import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { CATEGORY_LABEL, dateText, dateTimeText, pctText } from '../../lib/format';
import {
  Avatar,
  Badge,
  BandBadge,
  Button,
  Card,
  ErrorNote,
  Input,
  Meter,
  Modal,
  SectionHeading,
  Select,
  Spinner,
  Table,
} from '../../components/ui';

interface Student {
  id: number;
  name: string;
  email: string;
  college: string | null;
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  mocksAttempted: number;
  averageScore: number;
  bestScore: number;
  questionsSolved: number;
  readiness: number;
  targetCompany: string | null;
  xp: number;
}

interface StudentDetail {
  student: {
    id: number;
    name: string;
    email: string;
    college: string | null;
    branch: string | null;
    graduation_year: number | null;
    cgpa: number | null;
    created_at: string;
    last_login_at: string | null;
  };
  companies: { name: string; slug: string; status: string; is_primary_target: number; readiness_score: number }[];
  topics: { name: string; category: string; questions_attempted: number; questions_correct: number; mastery: number; is_completed: number }[];
  attempts: { id: number; title: string; percentage: number; accuracy: number; status: string; submitted_at: string | null }[];
}

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [viewing, setViewing] = useState<Student | null>(null);

  const { data, loading, error, reload } = useApi<{ students: Student[] }>('/admin/students', {
    search: search || undefined,
    branch: branch || undefined,
    year: year || undefined,
    limit: 200,
  });

  const toggleActive = useMutation(async (student: Student) => {
    await api(`/admin/students/${student.id}`, { method: 'PATCH', body: { isActive: !student.isActive } });
    reload();
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Students"
        subtitle="Readiness, activity and progress for everyone on the platform."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Search" value={search} onChange={setSearch} placeholder="Name or email" />
          <Select
            label="Branch"
            value={branch}
            onChange={setBranch}
            options={[
              { value: '', label: 'All branches' },
              ...['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'].map((value) => ({ value, label: value })),
            ]}
          />
          <Input label="Graduation year" type="number" value={year} onChange={setYear} placeholder="2026" />
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <Card>
          <Table
            rows={data.students}
            keyOf={(row) => row.id}
            empty="No students match those filters."
            columns={[
              {
                key: 'name',
                header: 'Student',
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} size={30} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{row.name}</span>
                        {!row.isActive ? <Badge tone="critical">Disabled</Badge> : null}
                      </div>
                      <div className="truncate text-[11px] ink-muted">{row.email}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'cohort',
                header: 'Cohort',
                render: (row) => (
                  <span className="text-xs ink-2">
                    {row.branch ?? '—'} · {row.graduationYear ?? '—'}
                    {row.cgpa !== null ? ` · CGPA ${row.cgpa}` : ''}
                  </span>
                ),
              },
              { key: 'target', header: 'Target', render: (row) => row.targetCompany ?? <span className="ink-muted">—</span> },
              {
                key: 'readiness',
                header: 'Readiness',
                width: '150px',
                render: (row) => <Meter value={row.readiness} right={pctText(row.readiness)} height={6} />,
              },
              { key: 'mocks', header: 'Mocks', align: 'right', render: (row) => String(row.mocksAttempted) },
              { key: 'avg', header: 'Avg', align: 'right', render: (row) => (row.mocksAttempted ? pctText(row.averageScore, 1) : '—') },
              { key: 'solved', header: 'Solved', align: 'right', render: (row) => String(row.questionsSolved) },
              { key: 'xp', header: 'XP', align: 'right', render: (row) => row.xp.toLocaleString() },
              {
                key: 'seen',
                header: 'Last seen',
                align: 'right',
                render: (row) => <span className="text-xs ink-muted">{row.lastLoginAt ? dateText(row.lastLoginAt) : 'Never'}</span>,
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setViewing(row)}>
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive.mutate(row)}>
                      {row.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      {viewing ? <StudentModal student={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

function StudentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data, loading } = useApi<StudentDetail>(`/admin/students/${student.id}`);

  return (
    <Modal open onClose={onClose} wide title={student.name}>
      {loading ? <Spinner /> : null}
      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {[
              { label: 'Email', value: data.student.email },
              { label: 'College', value: data.student.college ?? '—' },
              { label: 'Branch / year', value: `${data.student.branch ?? '—'} · ${data.student.graduation_year ?? '—'}` },
              { label: 'Joined', value: dateText(data.student.created_at) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
                <div className="ink-muted">{item.label}</div>
                <div className="mt-0.5 truncate font-medium ink">{item.value}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold ink">Companies</h3>
            <Table
              rows={data.companies}
              keyOf={(row) => row.slug}
              empty="Not following any company yet."
              columns={[
                {
                  key: 'name',
                  header: 'Company',
                  render: (row) => (
                    <span className="flex items-center gap-1.5">
                      {row.name}
                      {row.is_primary_target === 1 ? <Badge tone="brand">Target</Badge> : null}
                    </span>
                  ),
                },
                { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
                {
                  key: 'readiness',
                  header: 'Readiness',
                  width: '160px',
                  render: (row) => <Meter value={row.readiness_score} right={pctText(row.readiness_score)} height={6} />,
                },
              ]}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold ink">Weakest topics</h3>
            <Table
              rows={data.topics.slice(0, 10)}
              keyOf={(_row, index) => index}
              empty="No topic activity yet."
              columns={[
                { key: 'name', header: 'Topic', render: (row) => row.name },
                { key: 'category', header: 'Area', render: (row) => CATEGORY_LABEL[row.category] ?? row.category },
                {
                  key: 'attempts',
                  header: 'Correct / attempted',
                  align: 'right',
                  render: (row) => `${row.questions_correct}/${row.questions_attempted}`,
                },
                {
                  key: 'mastery',
                  header: 'Mastery',
                  width: '150px',
                  render: (row) => <Meter value={row.mastery} right={pctText(row.mastery)} height={6} />,
                },
              ]}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold ink">Recent attempts</h3>
            <Table
              rows={data.attempts}
              keyOf={(row) => row.id}
              empty="No mock tests attempted."
              columns={[
                { key: 'title', header: 'Test', render: (row) => row.title },
                { key: 'score', header: 'Score', align: 'right', render: (row) => pctText(row.percentage, 1) },
                { key: 'accuracy', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 1) },
                { key: 'band', header: 'Verdict', render: (row) => <BandBadge score={row.percentage} /> },
                {
                  key: 'when',
                  header: 'When',
                  align: 'right',
                  render: (row) => <span className="text-xs ink-muted">{dateTimeText(row.submitted_at)}</span>,
                },
              ]}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
