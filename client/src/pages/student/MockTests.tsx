import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, SCOPE_LABEL, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  CompanyLogo,
  Empty,
  ErrorNote,
  Input,
  Modal,
  Note,
  SectionHeading,
  Select,
  Spinner,
  Tabs,
} from '../../components/ui';

interface MockTest {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  scope: 'quick' | 'sectional' | 'round' | 'company';
  durationMinutes: number;
  totalMarks: number;
  difficulty: string;
  negativeMarking: number;
  sectionLock: boolean;
  fullscreenRequired: boolean;
  company: { name: string; slug: string; brandColor: string | null } | null;
  roundName: string | null;
  sectionCount: number;
  questionTotal: number;
  myAttempts: number;
  myBest: number | null;
  inProgressAttemptId: number | null;
}

const PAGE_SIZE = 60;

export default function MockTests() {
  const navigate = useNavigate();
  const [scope, setScope] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<MockTest | null>(null);
  // The catalogue holds close to two thousand mocks; the grid grows a page at
  // a time rather than mounting a card for every one of them.
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: companyData } = useApi<{ companies: { slug: string; name: string }[] }>('/companies');
  const { data, loading, error, reload } = useApi<{ tests: MockTest[]; total: number }>('/mock-tests', {
    scope: scope || undefined,
    companySlug: companySlug || undefined,
    search: search || undefined,
    limit,
  });

  useEffect(() => setLimit(PAGE_SIZE), [scope, companySlug, search]);

  const start = useMutation(async (test: MockTest) => {
    const result = await api<{ attemptId: number }>(`/mock-tests/${test.slug}/start`, { method: 'POST' });
    navigate(`/attempt/${result.attemptId}`);
    return result;
  });

  const tests = data?.tests ?? [];
  const total = data?.total ?? tests.length;
  const scopes: MockTest['scope'][] = ['quick', 'sectional', 'round', 'company'];

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Mock tests"
        subtitle="Quick warm-ups, single sections, whole rounds, or a full company simulation — each assembled fresh from the question bank."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
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
            label="Type"
            value={scope}
            onChange={setScope}
            options={[{ value: '', label: 'All types' }, ...scopes.map((value) => ({ value, label: SCOPE_LABEL[value] }))]}
          />
          <Input label="Search" value={search} onChange={setSearch} placeholder="Test name" />
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: '', label: 'All', count: tests.length },
          ...scopes.map((value) => ({
            id: value,
            label: SCOPE_LABEL[value],
            count: tests.filter((test) => test.scope === value).length,
          })),
        ]}
        active={scope}
        onChange={setScope}
      />

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        tests.length === 0 ? (
          <Card>
            <Empty title="No mock tests match" hint="Try clearing the company or type filter." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tests.map((test) => (
              <Card key={test.id} className="flex flex-col">
                <div className="mb-3 flex items-start gap-3">
                  {test.company ? (
                    <CompanyLogo name={test.company.name} brandColor={test.company.brandColor} size={36} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug ink">{test.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="brand">{SCOPE_LABEL[test.scope]}</Badge>
                      <Badge>{DIFFICULTY_LABEL[test.difficulty]}</Badge>
                    </div>
                  </div>
                </div>

                <p className="mb-3 line-clamp-2 text-xs ink-2">{test.description}</p>

                <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="ink-muted">Duration</dt>
                    <dd className="tabular font-medium ink">{test.durationMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="ink-muted">Questions</dt>
                    <dd className="tabular font-medium ink">
                      {test.questionTotal} in {test.sectionCount} section{test.sectionCount === 1 ? '' : 's'}
                    </dd>
                  </div>
                  <div>
                    <dt className="ink-muted">Marks</dt>
                    <dd className="tabular font-medium ink">{test.totalMarks}</dd>
                  </div>
                  <div>
                    <dt className="ink-muted">Negative marking</dt>
                    <dd className="tabular font-medium ink">{test.negativeMarking > 0 ? `−${test.negativeMarking}` : 'None'}</dd>
                  </div>
                </dl>

                {test.myAttempts > 0 ? (
                  <p className="mb-3 text-xs ink-muted">
                    Attempted {test.myAttempts}× · best {pctText(test.myBest ?? 0, 1)}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2">
                  {test.inProgressAttemptId ? (
                    <Button size="sm" onClick={() => navigate(`/attempt/${test.inProgressAttemptId}`)}>
                      Resume attempt →
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConfirming(test)}>
                      Start test
                    </Button>
                  )}
                  {test.sectionLock ? <Badge tone="warning" icon="🔒">Section-locked</Badge> : null}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {data && !loading && tests.length < total ? (
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm ink-muted">
            Showing {tests.length} of {total} mock tests
          </span>
          <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show more
          </Button>
        </div>
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={confirming?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              disabled={start.pending}
              onClick={() => {
                if (confirming) void start.mutate(confirming);
              }}
            >
              {start.pending ? 'Preparing paper…' : 'Begin test'}
            </Button>
          </>
        }
      >
        {confirming ? (
          <div className="space-y-3 text-sm">
            <p className="ink-2">{confirming.description}</p>
            <ul className="space-y-1.5 text-sm ink-2">
              <li>
                ⏱ <strong className="ink">{confirming.durationMinutes} minutes</strong> — the timer runs on the server,
                so closing the tab does not pause it.
              </li>
              <li>
                📄 <strong className="ink">{confirming.questionTotal} questions</strong> across{' '}
                {confirming.sectionCount} section{confirming.sectionCount === 1 ? '' : 's'}.
              </li>
              {confirming.negativeMarking > 0 ? (
                <li>
                  ➖ <strong className="ink">{confirming.negativeMarking} mark</strong> deducted per wrong answer.
                </li>
              ) : (
                <li>➖ No negative marking.</li>
              )}
              {confirming.sectionLock ? (
                <li>🔒 Sections are locked — once you submit a section you cannot return to it.</li>
              ) : (
                <li>🔓 You can move freely between sections.</li>
              )}
              {confirming.fullscreenRequired ? <li>🖥 Full-screen mode is recommended for this paper.</li> : null}
            </ul>
            <Note>
              Your answers are saved continuously. If the timer runs out the paper is submitted automatically with
              whatever you have answered.
            </Note>
            {start.error ? <ErrorNote message={start.error} /> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
