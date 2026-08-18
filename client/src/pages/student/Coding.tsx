import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { DIFFICULTY_LABEL, LANGUAGE_LABEL, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Input,
  Note,
  SectionHeading,
  Select,
  Spinner,
  Stat,
  Table,
} from '../../components/ui';
import { GroupedColumns } from '../../components/charts';

interface Problem {
  problemId: number;
  questionId: number;
  publicId: string;
  title: string;
  difficulty: string;
  topic: string | null;
  topicId: number | null;
  frequentlyAsked: boolean;
  allowedLanguages: string[];
  companies: { name: string; slug: string }[];
  mySubmissions: number;
  solved: boolean;
}

interface Stats {
  solved: number;
  attempted: number;
  submissions: number;
  accepted: number;
  acceptanceRate: number;
  byDifficulty: { difficulty: string; solved: number; total: number }[];
  averageAttemptsPerSolve: number;
  averageRuntimeMs: number;
}

export default function Coding() {
  const [difficulty, setDifficulty] = useState('');
  const [solved, setSolved] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [search, setSearch] = useState('');

  const { data: companyData } = useApi<{ companies: { slug: string; name: string }[] }>('/companies');
  const { data: langData } = useApi<{ languages: { id: string; label: string; available: boolean }[] }>('/coding/languages');
  const { data: statData } = useApi<{ stats: Stats }>('/coding/stats');
  const { data, loading, error, reload } = useApi<{ problems: Problem[] }>('/coding/problems', {
    difficulty: difficulty || undefined,
    solved: solved || undefined,
    companySlug: companySlug || undefined,
    search: search || undefined,
  });

  const stats = statData?.stats;
  const unavailable = (langData?.languages ?? []).filter((language) => !language.available);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Coding"
        subtitle="Write, run and submit real code against hidden test cases — the same engine the coding rounds use."
      />

      {stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Problems solved" value={stats.solved} accent />
          <Stat label="Attempted" value={stats.attempted} />
          <Stat label="Submissions" value={stats.submissions} />
          <Stat label="Acceptance rate" value={pctText(stats.acceptanceRate, 1)} />
          <Stat label="Avg attempts / solve" value={stats.averageAttemptsPerSolve || '—'} />
          <Stat label="Avg runtime" value={stats.averageRuntimeMs ? `${stats.averageRuntimeMs} ms` : '—'} />
        </div>
      ) : null}

      {stats ? (
        <GroupedColumns
          title="Progress by difficulty"
          subtitle="Solved versus what is available in the bank."
          data={stats.byDifficulty.map((entry) => ({
            label: DIFFICULTY_LABEL[entry.difficulty] ?? entry.difficulty,
            Solved: entry.solved,
            Available: entry.total,
          }))}
          series={[
            { key: 'Solved', label: 'Solved' },
            { key: 'Available', label: 'Available' },
          ]}
          height={200}
        />
      ) : null}

      {unavailable.length > 0 ? (
        <Note tone="warning">
          Not every toolchain is installed on this server. Currently unavailable:{' '}
          {unavailable.map((language) => LANGUAGE_LABEL[language.id] ?? language.id).join(', ')}. Submissions in those
          languages will report “language unavailable” rather than failing your solution.
        </Note>
      ) : null}

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" value={search} onChange={setSearch} placeholder="Problem title" />
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
            label="Company"
            value={companySlug}
            onChange={setCompanySlug}
            options={[
              { value: '', label: 'All companies' },
              ...(companyData?.companies ?? []).map((company) => ({ value: company.slug, label: company.name })),
            ]}
          />
          <Select
            label="Status"
            value={solved}
            onChange={setSolved}
            options={[
              { value: '', label: 'All' },
              { value: 'unsolved', label: 'Unsolved' },
              { value: 'solved', label: 'Solved' },
            ]}
          />
        </div>
      </Card>

      {/* Filtering by company can look odd — a problem can appear under
          Qualcomm while "Asked by" names TCS — so say what the filter means
          rather than letting a student read the list as company-confirmed. */}
      {companySlug ? (
        <Note>
          These problems match{' '}
          <strong>{companyData?.companies.find((c) => c.slug === companySlug)?.name ?? 'this company'}</strong>'s
          roadmap topics. <strong>Asked by</strong> lists the companies a problem is actually reported to have
          appeared at — a blank or different name there does not mean it is off-syllabus here.
        </Note>
      ) : null}

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        <Card>
          <Table
            rows={data.problems}
            keyOf={(row) => row.problemId}
            empty="No problems match those filters."
            columns={[
              {
                key: 'status',
                header: '',
                width: '40px',
                render: (row) =>
                  row.solved ? (
                    <span style={{ color: 'var(--good-text)' }} title="Solved">
                      ✓
                    </span>
                  ) : row.mySubmissions > 0 ? (
                    <span className="ink-muted" title="Attempted">
                      ◔
                    </span>
                  ) : (
                    <span className="ink-muted">·</span>
                  ),
              },
              {
                key: 'title',
                header: 'Problem',
                render: (row) => (
                  <div>
                    <Link to={`/coding/${row.problemId}`} className="font-medium hover:underline">
                      {row.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] ink-muted">
                      <span>{row.publicId}</span>
                      {row.topic ? <span>· {row.topic}</span> : null}
                      {row.frequentlyAsked ? <Badge tone="warning" icon="★">Frequently asked</Badge> : null}
                    </div>
                  </div>
                ),
              },
              {
                key: 'difficulty',
                header: 'Difficulty',
                render: (row) => (
                  <Badge tone={row.difficulty === 'hard' ? 'serious' : row.difficulty === 'medium' ? 'warning' : 'neutral'}>
                    {DIFFICULTY_LABEL[row.difficulty]}
                  </Badge>
                ),
              },
              {
                key: 'companies',
                header: 'Asked by',
                render: (row) => (
                  <span className="text-xs ink-muted">
                    {row.companies.length ? row.companies.map((company) => company.name).join(', ') : 'General'}
                  </span>
                ),
              },
              { key: 'subs', header: 'My tries', align: 'right', render: (row) => String(row.mySubmissions) },
              {
                key: 'go',
                header: '',
                align: 'right',
                render: (row) => (
                  <Link to={`/coding/${row.problemId}`}>
                    <Button size="sm" variant="secondary">
                      Solve
                    </Button>
                  </Link>
                ),
              },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
