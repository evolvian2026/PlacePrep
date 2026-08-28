import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, PROVENANCE_LABEL, ROUND_TYPE_LABEL, SCOPE_LABEL, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  CompanyLogo,
  Empty,
  ErrorNote,
  HeroScore,
  Meter,
  Note,
  SectionHeading,
  Spinner,
  Tabs,
} from '../../components/ui';
import { MagnitudeBars } from '../../components/charts';

interface Topic {
  id: number;
  name: string;
  slug: string;
  category: string;
  estHours: number;
  importance: string;
  questionCount: number;
  isSubtopic: boolean;
}

interface RoundSection {
  id: number;
  name: string;
  questionCount: number;
  durationMinutes: number | null;
  marksPerQuestion: number;
  negativeMarks: number;
  questionKind: string;
  topics: Topic[];
}

interface Round {
  id: number;
  slug: string;
  name: string;
  roundType: string;
  sequence: number;
  description: string | null;
  durationMinutes: number | null;
  difficulty: string;
  elimination: boolean;
  estimatedPrepHours: number;
  negativeMarking: number;
  sectionLock: boolean;
  sections: RoundSection[];
  topics: Topic[];
  interviewTopics: Topic[];
  questionsAvailable: number;
  mockTests: { id: number; slug: string; title: string; scope: string; durationMinutes: number; totalMarks: number }[];
  progress: {
    completion: number;
    topicCompletion: number;
    bestMockScore: number | null;
    mocksAttempted: number;
    status: string;
    topicsTotal: number;
    topicsCompleted: number;
  } | null;
}

interface CompanyDetailData {
  company: {
    id: number;
    slug: string;
    name: string;
    logoText: string | null;
    brandColor: string | null;
    companyType: string;
    industry: string | null;
    description: string | null;
    difficulty: string;
    hiringFrequency: string | null;
    eligibleBranches: string[];
    eligibleYears: number[];
    minCgpa: number | null;
    ctcMinLpa: number | null;
    ctcMaxLpa: number | null;
    rolesOffered: string[];
    locations: string[];
    expectedPrepWeeks: number | null;
    studentStatus: string | null;
    isPrimaryTarget: boolean;
    eligibility: {
      status: 'eligible' | 'not_eligible' | 'unknown';
      blockers: string[];
      missingProfile: string[];
      met: string[];
    } | null;
  };
  rounds: Round[];
  insights: {
    category: string;
    title: string;
    body: string;
    provenance: string;
    source_label: string | null;
    as_of: string | null;
  }[];
  mockTests: { id: number; slug: string; title: string; scope: string; durationMinutes: number; totalMarks: number; description: string | null }[];
  readiness: {
    score: number;
    band: string;
    explanation: string;
    components: { topicMastery: number; mockPerformance: number; coverage: number };
    weakTopics: { topicId: number; name: string; mastery: number }[];
    strongTopics: { topicId: number; name: string; mastery: number }[];
    topicBreakdown: { topicId: number; name: string; category: string; mastery: number; attempted: number }[];
  } | null;
  disclaimer: string;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready: 'Ready',
  mastered: 'Mastered',
};

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'brand' | 'good'> = {
  not_started: 'neutral',
  in_progress: 'warning',
  ready: 'brand',
  mastered: 'good',
};

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState('roadmap');
  const { data, loading, error, reload } = useApi<CompanyDetailData>(slug ? `/companies/${slug}` : null);

  const track = useMutation(async (status: string) => {
    await api(`/companies/${slug}/track`, {
      method: 'PUT',
      body: { status, isPrimaryTarget: status === 'preparing' },
    });
    reload();
  });

  if (loading) return <Spinner label="Loading the roadmap…" />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { company, rounds, readiness } = data;
  // Companies whose rounds come from a hiring-process template rather than
  // researched detail carry this insight; the roadmap tab surfaces it inline.
  const templateNote = data.insights.find((insight) => insight.title.includes('hiring-process template'));
  const eligibility = company.eligibility;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo name={company.name} logoText={company.logoText} brandColor={company.brandColor} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold ink">{company.name}</h1>
              <Badge tone={company.companyType === 'product' ? 'brand' : 'neutral'}>
                {company.companyType === 'product' ? 'Product-based' : 'Service-based'}
              </Badge>
              <Badge tone={company.difficulty === 'very_hard' || company.difficulty === 'hard' ? 'serious' : 'neutral'}>
                {DIFFICULTY_LABEL[company.difficulty]}
              </Badge>
              {company.studentStatus ? <Badge tone="good" icon="✓">{company.studentStatus}</Badge> : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm ink-2">{company.description}</p>

            <dl className="mt-4 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Hiring frequency', value: company.hiringFrequency },
                {
                  label: 'Typical CTC',
                  value: company.ctcMinLpa !== null ? `₹${company.ctcMinLpa}–${company.ctcMaxLpa} LPA` : null,
                },
                { label: 'Eligible branches', value: company.eligibleBranches.join(', ') },
                { label: 'Graduation years', value: company.eligibleYears.join(', ') },
                { label: 'Minimum CGPA', value: company.minCgpa ? String(company.minCgpa) : null },
                { label: 'Roles offered', value: company.rolesOffered.join(', ') },
                { label: 'Locations', value: company.locations.join(', ') },
                { label: 'Suggested prep', value: company.expectedPrepWeeks ? `${company.expectedPrepWeeks} weeks` : null },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="ink-muted">{item.label}</dt>
                  <dd className="mt-0.5 font-medium ink">{item.value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Button onClick={() => void track.mutate('preparing')} disabled={track.pending}>
              {company.isPrimaryTarget ? 'Primary target ✓' : 'Set as my target'}
            </Button>
            <Button variant="secondary" onClick={() => void track.mutate('interested')} disabled={track.pending}>
              Mark interested
            </Button>
            <Button variant="secondary" onClick={() => void track.mutate('shortlisted')} disabled={track.pending}>
              Mark shortlisted
            </Button>
          </div>
        </div>
      </Card>

      {readiness ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Card>
            <SectionHeading level={3} title={`Your readiness for ${company.name}`} />
            <HeroScore score={readiness.score} caption={readiness.explanation} />
            <div className="mt-4 space-y-2.5 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
              <Meter value={readiness.components.topicMastery} label="Topic mastery" right={pctText(readiness.components.topicMastery)} height={6} severity={false} />
              <Meter value={readiness.components.mockPerformance} label="Mock performance" right={pctText(readiness.components.mockPerformance)} height={6} severity={false} />
              <Meter value={readiness.components.coverage} label="Syllabus coverage" right={pctText(readiness.components.coverage)} height={6} severity={false} />
            </div>
          </Card>

          {readiness.topicBreakdown.length > 0 ? (
            <MagnitudeBars
              title="Topic mastery across this company's syllabus"
              subtitle="The eight topics that most need attention. Darker means stronger."
              data={readiness.topicBreakdown.slice(0, 8).map((topic) => ({ name: topic.name, value: topic.mastery }))}
              valueLabel="Mastery"
            />
          ) : null}
        </div>
      ) : null}

      {eligibility ? (
        <Note tone={eligibility.status === 'not_eligible' ? 'warning' : 'neutral'}>
          {eligibility.status === 'eligible' ? (
            <>
              <strong>You are eligible for {company.name}.</strong> {eligibility.met.join(' · ')}.
            </>
          ) : eligibility.status === 'not_eligible' ? (
            <>
              <strong>You do not currently meet {company.name}'s criteria.</strong>{' '}
              {eligibility.blockers.map((b) => (b.endsWith('.') ? b : `${b}.`)).join(' ')} You can still prepare here — criteria change every season, and
              your placement cell has the final word.
            </>
          ) : (
            <>
              <strong>Eligibility not checked.</strong> Add your{' '}
              {eligibility.missingProfile.join(' and ')} on{' '}
              <Link to="/profile" className="underline">
                your profile
              </Link>{' '}
              and this will tell you whether you qualify.
            </>
          )}
        </Note>
      ) : null}

      <Tabs
        tabs={[
          { id: 'roadmap', label: 'Preparation roadmap', count: rounds.length },
          { id: 'mocks', label: 'Mock tests', count: data.mockTests.length },
          { id: 'intel', label: 'Company intelligence', count: data.insights.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'roadmap' ? (
        <div className="space-y-4">
          {/* A templated roadmap says so here rather than only under the
              intelligence tab, so a student reading the rounds knows straight
              away which parts are researched and which are a generic pattern. */}
          {templateNote ? (
            <Note tone="warning">
              <strong>{templateNote.title}.</strong> {templateNote.body}{' '}
              <button type="button" className="underline" onClick={() => setTab('intel')}>
                See company intelligence
              </button>
            </Note>
          ) : null}

          {/* Round progression strip */}
          <Card>
            <SectionHeading
              level={3}
              title="Selection process"
              subtitle={`${rounds.length} rounds. Each round gates the next, so earlier rounds carry more weight in your plan.`}
            />
            <ol className="flex flex-wrap items-stretch gap-2">
              {rounds.map((round, index) => (
                <li key={round.id} className="flex items-stretch gap-2">
                  <a
                    href={`#round-${round.id}`}
                    className="flex min-w-[9rem] flex-col justify-between rounded-lg border p-3 transition-opacity hover:opacity-80"
                    style={{ borderColor: 'var(--hairline)' }}
                  >
                    <div>
                      <div className="text-[11px] font-medium ink-muted">Round {index + 1}</div>
                      <div className="mt-0.5 text-sm font-medium ink">
                        {round.name.replace(/^Round \d+ — /, '')}
                      </div>
                      <div className="mt-1 text-[11px] ink-muted">{ROUND_TYPE_LABEL[round.roundType]}</div>
                    </div>
                    <div className="mt-2">
                      <Meter value={round.progress?.completion ?? 0} height={5} />
                      <div className="mt-1 text-[11px] tabular ink-2">
                        {Math.round(round.progress?.completion ?? 0)}% ready
                      </div>
                    </div>
                  </a>
                  {index < rounds.length - 1 ? (
                    <span aria-hidden="true" className="self-center text-lg ink-muted">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>

          {rounds.map((round, index) => (
            <Card key={round.id} className="scroll-mt-6">
              <div id={`round-${round.id}`} />
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="flex size-6 items-center justify-center rounded-full text-xs font-semibold"
                      style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-base font-semibold ink">{round.name}</h3>
                    <Badge tone={STATUS_TONE[round.progress?.status ?? 'not_started']}>
                      {STATUS_LABEL[round.progress?.status ?? 'not_started']}
                    </Badge>
                    {round.elimination ? <Badge tone="serious" icon="!">Eliminating</Badge> : null}
                    {round.sectionLock ? <Badge tone="warning" icon="🔒">Sections locked</Badge> : null}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm ink-2">{round.description}</p>
                </div>
                <div className="w-full sm:w-48">
                  <Meter
                    value={round.progress?.completion ?? 0}
                    label="Round readiness"
                    right={pctText(round.progress?.completion ?? 0)}
                  />
                </div>
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                {[
                  { label: 'Duration', value: round.durationMinutes ? `${round.durationMinutes} min` : '—' },
                  { label: 'Difficulty', value: DIFFICULTY_LABEL[round.difficulty] },
                  { label: 'Est. preparation', value: `${round.estimatedPrepHours} hrs` },
                  { label: 'Questions available', value: String(round.questionsAvailable) },
                  { label: 'Negative marking', value: round.negativeMarking > 0 ? `−${round.negativeMarking}` : 'None' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
                    <dt className="ink-muted">{item.label}</dt>
                    <dd className="mt-0.5 font-medium ink">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {round.sections.length > 0 ? (
                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide ink-muted">Sections</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {round.sections.map((section) => (
                      <div key={section.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium ink">{section.name}</span>
                          <span className="text-xs tabular ink-muted">
                            {section.questionCount}Q
                            {section.durationMinutes ? ` · ${section.durationMinutes}m` : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {section.topics.slice(0, 8).map((topic) => (
                            <Link
                              key={topic.id}
                              to={`/practice?topicId=${topic.id}`}
                              className="rounded px-1.5 py-0.5 text-[11px] hover:opacity-70"
                              style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                            >
                              {topic.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {round.interviewTopics.length > 0 ? (
                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide ink-muted">
                    Also prepare (interview discussion)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {round.interviewTopics.map((topic) => (
                      <Link
                        key={topic.id}
                        to={`/practice?topicId=${topic.id}`}
                        className="rounded px-2 py-1 text-xs hover:opacity-70"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                      >
                        {topic.name}
                        <span className="ml-1 tabular ink-muted">{topic.questionCount}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                <Link to={`/companies/${company.slug}/rounds/${round.slug}`}>
                  <Button size="sm" variant="secondary">
                    Open round dashboard
                  </Button>
                </Link>
                {round.mockTests.slice(0, 2).map((mock) => (
                  <Button key={mock.id} size="sm" variant="ghost" onClick={() => navigate('/mock-tests')}>
                    {mock.title} · {mock.durationMinutes}m →
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'mocks' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.mockTests.map((mock) => (
            <Card key={mock.id} className="flex flex-col">
              <Badge tone="brand">{SCOPE_LABEL[mock.scope] ?? mock.scope}</Badge>
              <h3 className="mt-2 text-sm font-semibold ink">{mock.title}</h3>
              <p className="mt-1 flex-1 text-xs ink-2">{mock.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs ink-muted">
                <span className="tabular">
                  {mock.durationMinutes} min · {mock.totalMarks} marks
                </span>
                <Link to="/mock-tests">
                  <Button size="sm">Start</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'intel' ? (
        <div className="space-y-4">
          <Note tone="warning">{data.disclaimer}</Note>

          {data.insights.length === 0 ? (
            <Card>
              <Empty title="No intelligence recorded yet" hint="Your placement cell can add verified notes from the admin console." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.insights.map((insight, index) => (
                <Card key={index}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold ink">{insight.title}</h3>
                    <Badge
                      tone={insight.provenance === 'verified' ? 'good' : 'warning'}
                      icon={insight.provenance === 'verified' ? '✓' : '◇'}
                    >
                      {PROVENANCE_LABEL[insight.provenance]}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed ink-2">{insight.body}</p>
                  {insight.source_label || insight.as_of ? (
                    <p className="mt-2 text-[11px] ink-muted">
                      {insight.source_label}
                      {insight.as_of ? ` · ${insight.as_of}` : ''}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
