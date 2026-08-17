import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  CompanyLogo,
  Empty,
  ErrorNote,
  Input,
  Meter,
  Note,
  SectionHeading,
  Select,
  Spinner,
  cx,
} from '../../components/ui';

interface Company {
  id: number;
  slug: string;
  name: string;
  logoText: string | null;
  brandColor: string | null;
  companyType: 'service' | 'product';
  industry: string | null;
  description: string | null;
  difficulty: string;
  hiringFrequency: string | null;
  eligibleBranches: string[];
  eligibleYears: number[];
  minCgpa: number | null;
  ctcMinLpa: number | null;
  ctcMaxLpa: number | null;
  expectedPrepWeeks: number | null;
  roundCount: number;
  mockCount: number;
  questionCount: number;
  studentStatus: string | null;
  studentReadiness: number | null;
  isPrimaryTarget: boolean;
}

const STATUSES = [
  { value: 'interested', label: 'Interested' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'good' | 'warning'> = {
  interested: 'neutral',
  preparing: 'brand',
  shortlisted: 'warning',
  completed: 'good',
};

export default function Companies() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [branch, setBranch] = useState('');
  const [sort, setSort] = useState('');

  const { data, loading, error, reload } = useApi<{ companies: Company[]; total: number }>('/companies', {
    search,
    type,
    difficulty,
    branch,
    sort,
  });

  const track = useMutation(async (input: { slug: string; status: string; primary?: boolean }) => {
    await api(`/companies/${input.slug}/track`, {
      method: 'PUT',
      body: { status: input.status, isPrimaryTarget: input.primary },
    });
    reload();
  });

  const companies = data?.companies ?? [];
  const grouped = useMemo(
    () => ({
      following: companies.filter((company) => company.studentStatus),
      rest: companies.filter((company) => !company.studentStatus),
    }),
    [companies],
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Company directory"
        subtitle="Every company is configured by your placement cell — hiring process, eligibility and mock tests included."
      />

      {/* Filters sit in one row above the results. */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Search" value={search} onChange={setSearch} placeholder="Company or industry" />
          <Select
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: '', label: 'All types' },
              { value: 'service', label: 'Service-based' },
              { value: 'product', label: 'Product-based' },
            ]}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: '', label: 'Any difficulty' },
              { value: 'easy', label: 'Easy' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'hard', label: 'Hard' },
              { value: 'very_hard', label: 'Very hard' },
            ]}
          />
          <Select
            label="My branch"
            value={branch}
            onChange={setBranch}
            options={[
              { value: '', label: 'All branches' },
              ...['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'].map((value) => ({ value, label: value })),
            ]}
          />
          <Select
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              { value: '', label: 'Recommended' },
              { value: 'name', label: 'Name' },
              { value: 'difficulty', label: 'Difficulty' },
              { value: 'ctc', label: 'Highest CTC' },
              { value: 'readiness', label: 'My readiness' },
            ]}
          />
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {!loading && !error ? (
        <>
          {grouped.following.length > 0 ? (
            <section>
              <SectionHeading title="Your companies" subtitle="Marked as interested, preparing, shortlisted or completed." />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grouped.following.map((company) => (
                  <CompanyCard key={company.id} company={company} onTrack={track.mutate} pending={track.pending} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionHeading
              title={grouped.following.length > 0 ? 'All companies' : `${companies.length} companies`}
              subtitle="Mark a company to start tracking readiness against its rounds."
            />
            {grouped.rest.length === 0 && grouped.following.length === 0 ? (
              <Card>
                <Empty title="No companies match those filters" hint="Try clearing the search or branch filter." />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grouped.rest.map((company) => (
                  <CompanyCard key={company.id} company={company} onTrack={track.mutate} pending={track.pending} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function CompanyCard({
  company,
  onTrack,
  pending,
}: {
  company: Company;
  onTrack: (input: { slug: string; status: string; primary?: boolean }) => Promise<unknown>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-start gap-3">
        <CompanyLogo name={company.name} logoText={company.logoText} brandColor={company.brandColor} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to={`/companies/${company.slug}`} className="truncate font-semibold ink hover:underline">
              {company.name}
            </Link>
            {company.isPrimaryTarget ? <Badge tone="brand" icon="★">Target</Badge> : null}
          </div>
          <div className="mt-0.5 truncate text-xs ink-muted">{company.industry}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge tone={company.companyType === 'product' ? 'brand' : 'neutral'}>
          {company.companyType === 'product' ? 'Product-based' : 'Service-based'}
        </Badge>
        <Badge tone={company.difficulty === 'very_hard' || company.difficulty === 'hard' ? 'serious' : 'neutral'}>
          {DIFFICULTY_LABEL[company.difficulty] ?? company.difficulty}
        </Badge>
        {company.studentStatus ? (
          <Badge tone={STATUS_TONE[company.studentStatus]}>
            {STATUSES.find((s) => s.value === company.studentStatus)?.label}
          </Badge>
        ) : null}
      </div>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed ink-2">{company.description}</p>

      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="ink-muted">CTC range</dt>
          <dd className="tabular font-medium ink">
            {company.ctcMinLpa !== null ? `₹${company.ctcMinLpa}–${company.ctcMaxLpa} LPA` : '—'}
          </dd>
        </div>
        <div>
          <dt className="ink-muted">Hiring</dt>
          <dd className="truncate font-medium ink">{company.hiringFrequency ?? '—'}</dd>
        </div>
        <div>
          <dt className="ink-muted">Eligible branches</dt>
          <dd className="truncate font-medium ink">{company.eligibleBranches.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="ink-muted">Graduation years</dt>
          <dd className="tabular font-medium ink">{company.eligibleYears.join(', ') || '—'}</dd>
        </div>
      </dl>

      <div className="mb-3 flex gap-3 border-y py-2 text-xs" style={{ borderColor: 'var(--hairline)' }}>
        <span className="ink-2">
          <span className="tabular font-semibold ink">{company.roundCount}</span> rounds
        </span>
        <span className="ink-2">
          <span className="tabular font-semibold ink">{company.mockCount}</span> mocks
        </span>
        <span className="ink-2">
          <span className="tabular font-semibold ink">{company.questionCount}</span> questions
        </span>
      </div>

      {company.studentStatus ? (
        <div className="mb-3">
          <Meter value={company.studentReadiness ?? 0} label="Readiness" right={`${Math.round(company.studentReadiness ?? 0)}%`} height={6} />
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOpen((value) => !value)} variant={company.studentStatus ? 'secondary' : 'primary'}>
          {company.studentStatus ? 'Change status' : 'Track this company'}
        </Button>
        <Link to={`/companies/${company.slug}`}>
          <Button size="sm" variant="ghost">
            View roadmap →
          </Button>
        </Link>
      </div>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          {STATUSES.map((status) => (
            <button
              key={status.value}
              disabled={pending}
              onClick={() => {
                void onTrack({ slug: company.slug, status: status.value, primary: status.value === 'preparing' });
                setOpen(false);
              }}
              className={cx(
                'rounded-md px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-70',
                company.studentStatus === status.value && 'ring-1',
              )}
              style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
            >
              {status.label}
            </button>
          ))}
          <p className="col-span-2 mt-1">
            <Note>Marking a company as “Preparing” makes it your primary target and drives your roadmap.</Note>
          </p>
        </div>
      ) : null}
    </Card>
  );
}
