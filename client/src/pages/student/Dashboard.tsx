import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { CATEGORY_LABEL, dateTimeText, pctText } from '../../lib/format';
import {
  Badge,
  BandBadge,
  Button,
  Card,
  CompanyLogo,
  Empty,
  ErrorNote,
  HeroScore,
  Meter,
  SectionHeading,
  Spinner,
  Stat,
  Table,
} from '../../components/ui';
import { MagnitudeBars, ProfileRadar, Sparkline } from '../../components/charts';

interface RoundReadiness {
  roundId: number;
  roundName: string;
  roundType: string;
  completion: number;
  topicCompletion: number;
  bestMockScore: number | null;
  mocksAttempted: number;
  status: string;
  topicsTotal: number;
  topicsCompleted: number;
}

interface DashboardData {
  user: { name: string };
  readiness: { overall: number; band: string; perCompany: { slug: string; name: string; readiness: number }[] };
  targetCompany: {
    id: number;
    slug: string;
    name: string;
    logoText: string | null;
    brandColor: string | null;
    companyType: string;
    difficulty: string;
    status: string;
    readiness: number;
    explanation: string | null;
    rounds: RoundReadiness[];
    categoryBreakdown: { category: string; label: string; mastery: number; topics: number }[];
  } | null;
  companies: {
    id: number;
    slug: string;
    name: string;
    logoText: string | null;
    brandColor: string | null;
    status: string;
    isPrimaryTarget: boolean;
    readiness: number;
  }[];
  stats: {
    questionsSolved: number;
    questionsAttempted: number;
    accuracy: number;
    topicsCompleted: number;
    topicsTouched: number;
    mocksAttempted: number;
    averageScore: number;
    bestScore: number;
    mockAccuracy: number;
  };
  weakTopics: { topicId: number; name: string; mastery: number; attempted: number }[];
  strongTopics: { topicId: number; name: string; mastery: number; attempted: number }[];
  recentAttempts: {
    id: number;
    title: string;
    company_name: string | null;
    percentage: number;
    accuracy: number;
    status: string;
    submitted_at: string | null;
  }[];
  nextAction: { title: string; detail: string; actionType: string; topicId?: number; mockTestId?: number } | null;
  coding: {
    solved: number;
    attempted: number;
    acceptanceRate: number;
    byDifficulty: { difficulty: string; solved: number; total: number }[];
  };
  gamification: {
    xp: number;
    level: number;
    progress: number;
    nextLevelXp: number;
    currentLevelXp: number;
    streak: { current: number; longest: number; last30: { day: string; questions: number }[] };
    badges: { slug: string; name: string; icon: string; tier: string }[];
    badgeCount: number;
    challenges: { slug: string; title: string; description: string; progress: number; goalCount: number; daysRemaining: number }[];
  };
}

const ROUND_STATUS_TONE: Record<string, 'neutral' | 'warning' | 'brand' | 'good'> = {
  not_started: 'neutral',
  in_progress: 'warning',
  ready: 'brand',
  mastered: 'good',
};

const ROUND_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready: 'Ready',
  mastered: 'Mastered',
};

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard');
  const navigate = useNavigate();

  if (loading) return <Spinner label="Building your dashboard…" />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const { targetCompany, stats, gamification, coding } = data;
  const firstName = data.user.name.split(' ')[0];
  const activity = gamification.streak.last30.slice(-12).map((day) => day.questions);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={`Hello, ${firstName}`}
        subtitle={
          targetCompany
            ? `You are preparing for ${targetCompany.name}. Everything below is measured against its hiring process.`
            : 'Pick a target company to unlock a roadmap, mock tests and a personalised plan.'
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/companies')}>
              Browse companies
            </Button>
            <Button onClick={() => navigate('/mock-tests')}>Take a mock test</Button>
          </div>
        }
      />

      {!targetCompany ? (
        <Card>
          <Empty
            title="No target company yet"
            hint="Choose a company and mark it as “Preparing”. PlacePrep will then build a round-by-round roadmap and start tracking your readiness."
            action={<Button onClick={() => navigate('/companies')}>Choose a company</Button>}
          />
        </Card>
      ) : (
        <>
          {/* ── Readiness hero + next action ── */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Card>
              <div className="mb-4 flex items-center gap-3">
                <CompanyLogo
                  name={targetCompany.name}
                  logoText={targetCompany.logoText}
                  brandColor={targetCompany.brandColor}
                  size={44}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/companies/${targetCompany.slug}`} className="truncate font-semibold ink hover:underline">
                      {targetCompany.name}
                    </Link>
                    <Badge tone="brand">{targetCompany.companyType === 'product' ? 'Product' : 'Service'}</Badge>
                  </div>
                  <div className="text-xs ink-muted">Placement readiness</div>
                </div>
              </div>

              <HeroScore
                score={targetCompany.readiness}
                caption={targetCompany.explanation ?? undefined}
              />

              <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                <div className="mb-2 text-xs font-medium ink-2">Overall placement readiness</div>
                <Meter value={data.readiness.overall} right={pctText(data.readiness.overall)} />
                <p className="mt-2 text-xs ink-muted">
                  Blends your primary target with the other companies you follow.
                </p>
              </div>
            </Card>

            <div className="space-y-4">
              {data.nextAction ? (
                <Card>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone="brand" icon="➔">
                      Recommended next step
                    </Badge>
                  </div>
                  <h2 className="text-base font-semibold ink">{data.nextAction.title}</h2>
                  <p className="mt-1.5 text-sm ink-2">{data.nextAction.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const action = data.nextAction!;
                        if (action.mockTestId) navigate('/mock-tests');
                        else if (action.topicId) navigate(`/practice?topicId=${action.topicId}`);
                        else navigate('/roadmap');
                      }}
                    >
                      Start now
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/roadmap')}>
                      See full plan
                    </Button>
                  </div>
                </Card>
              ) : null}

              {/* ── Round progression (roadmap timeline, compact) ── */}
              <Card>
                <SectionHeading
                  level={3}
                  title="Round progression"
                  action={
                    <Link
                      to={`/companies/${targetCompany.slug}`}
                      className="text-xs underline decoration-dotted underline-offset-2 ink-muted"
                    >
                      Open roadmap
                    </Link>
                  }
                />
                <ol className="space-y-3">
                  {targetCompany.rounds.map((round, index) => (
                    <li key={round.roundId}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm ink">
                          {round.roundName.replace(/^Round \d+ — /, '')}
                        </span>
                        <Badge tone={ROUND_STATUS_TONE[round.status]}>{ROUND_STATUS_LABEL[round.status]}</Badge>
                        <span className="tabular w-10 text-right text-xs font-medium ink">
                          {Math.round(round.completion)}%
                        </span>
                      </div>
                      <Meter value={round.completion} height={6} />
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>

          {/* ── Headline stats ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Mock tests" value={stats.mocksAttempted} footnote="Attempted" />
            <Stat label="Average score" value={pctText(stats.averageScore, 1)} footnote="Across all mocks" />
            <Stat label="Best score" value={pctText(stats.bestScore, 1)} accent footnote="Personal best" />
            <Stat label="Accuracy" value={pctText(stats.accuracy, 1)} footnote={`${stats.questionsAttempted} attempted`} />
            <Stat label="Questions solved" value={stats.questionsSolved} footnote={`${stats.topicsTouched} topics touched`} />
            <Stat
              label="Topics completed"
              value={stats.topicsCompleted}
              footnote={
                <span className="flex items-center gap-2">
                  <span>{gamification.streak.current}-day streak</span>
                  {activity.length > 1 ? <Sparkline values={activity} width={56} height={20} /> : null}
                </span>
              }
            />
          </div>

          {/* ── Subject strength ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {targetCompany.categoryBreakdown.length > 0 ? (
              <MagnitudeBars
                title={`Subject strength for ${targetCompany.name}`}
                subtitle="Average topic mastery per subject area. Darker means stronger."
                data={targetCompany.categoryBreakdown.map((entry) => ({
                  name: CATEGORY_LABEL[entry.category] ?? entry.label,
                  value: entry.mastery,
                }))}
                valueLabel="Mastery"
              />
            ) : null}

            {targetCompany.categoryBreakdown.length >= 3 ? (
              <ProfileRadar
                title="Readiness shape"
                subtitle="Where your preparation is even, and where it dips."
                data={targetCompany.categoryBreakdown.slice(0, 8).map((entry) => ({
                  axis: (CATEGORY_LABEL[entry.category] ?? entry.label).replace(' & ', ' &\n'),
                  value: entry.mastery,
                }))}
              />
            ) : null}
          </div>

          {/* ── Weak / strong / coding ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <SectionHeading level={3} title="Weak topics" subtitle="Lowest mastery on this company's syllabus." />
              {data.weakTopics.length === 0 ? (
                <Empty title="Nothing weak yet" hint="Attempt a mock test to find your gaps." />
              ) : (
                <ul className="space-y-2.5">
                  {data.weakTopics.slice(0, 6).map((topic) => (
                    <li key={topic.topicId}>
                      <Meter
                        value={topic.mastery}
                        label={
                          <Link to={`/practice?topicId=${topic.topicId}`} className="hover:underline">
                            {topic.name}
                          </Link>
                        }
                        right={topic.attempted === 0 ? 'Not started' : pctText(topic.mastery)}
                        height={6}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionHeading level={3} title="Strong topics" subtitle="Keep these warm with short revision sets." />
              {data.strongTopics.length === 0 ? (
                <Empty title="No strong topics yet" hint="Mastery builds after about a dozen questions per topic." />
              ) : (
                <ul className="space-y-2.5">
                  {data.strongTopics.slice(0, 6).map((topic) => (
                    <li key={topic.topicId}>
                      <Meter value={topic.mastery} label={topic.name} right={pctText(topic.mastery)} height={6} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionHeading
                level={3}
                title="Coding progress"
                action={
                  <Link to="/coding" className="text-xs underline decoration-dotted underline-offset-2 ink-muted">
                    Open editor
                  </Link>
                }
              />
              <div className="mb-4 flex items-baseline gap-4">
                <div>
                  <div className="text-2xl font-semibold ink">{coding.solved}</div>
                  <div className="text-xs ink-muted">Problems solved</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold ink">{pctText(coding.acceptanceRate, 0)}</div>
                  <div className="text-xs ink-muted">Acceptance rate</div>
                </div>
              </div>
              {/* Solved vs available per difficulty. Each bar is its own
                  magnitude, so a zero simply reads as an empty track rather
                  than needing a placeholder value. */}
              <ul className="space-y-2.5">
                {coding.byDifficulty.map((entry) => (
                  <li key={entry.difficulty}>
                    <Meter
                      value={entry.total > 0 ? (entry.solved / entry.total) * 100 : 0}
                      label={<span className="capitalize">{entry.difficulty}</span>}
                      right={`${entry.solved}/${entry.total}`}
                      height={6}
                      severity={false}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* ── Recent results + gamification ── */}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <SectionHeading
                level={3}
                title="Recent test results"
                action={
                  <Link to="/performance" className="text-xs underline decoration-dotted underline-offset-2 ink-muted">
                    All performance
                  </Link>
                }
              />
              <Table
                rows={data.recentAttempts}
                keyOf={(row) => row.id}
                empty="No mock tests attempted yet."
                onRowClick={(row) => navigate(`/results/${row.id}`)}
                columns={[
                  {
                    key: 'title',
                    header: 'Test',
                    render: (row) => (
                      <span className="block max-w-[16rem] truncate">
                        {row.title}
                        {row.company_name ? <span className="ink-muted"> · {row.company_name}</span> : null}
                      </span>
                    ),
                  },
                  { key: 'score', header: 'Score', align: 'right', render: (row) => pctText(row.percentage, 1) },
                  { key: 'acc', header: 'Accuracy', align: 'right', render: (row) => pctText(row.accuracy, 1) },
                  { key: 'band', header: '', render: (row) => <BandBadge score={row.percentage} /> },
                  {
                    key: 'when',
                    header: 'When',
                    align: 'right',
                    render: (row) => <span className="text-xs ink-muted">{dateTimeText(row.submitted_at)}</span>,
                  },
                ]}
              />
            </Card>

            <div className="space-y-4">
              <Card>
                <SectionHeading level={3} title="Progress & rewards" />
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="ink-2">
                    Level <span className="font-semibold ink">{gamification.level}</span>
                  </span>
                  <span className="tabular text-xs ink-muted">
                    {gamification.currentLevelXp} / {gamification.nextLevelXp} XP
                  </span>
                </div>
                <Meter value={gamification.progress} height={8} severity={false} />

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'XP', value: gamification.xp },
                    { label: 'Streak', value: `${gamification.streak.current}d` },
                    { label: 'Badges', value: gamification.badgeCount },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-base font-semibold ink">{item.value}</div>
                      <div className="text-[11px] ink-muted">{item.label}</div>
                    </div>
                  ))}
                </div>

                {gamification.badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {gamification.badges.map((badge) => (
                      <span
                        key={badge.slug}
                        title={badge.name}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                      >
                        <span aria-hidden="true">{badge.icon}</span>
                        {badge.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>

              {gamification.challenges.length > 0 ? (
                <Card>
                  <SectionHeading level={3} title="Weekly challenges" />
                  <ul className="space-y-3">
                    {gamification.challenges.map((challenge) => (
                      <li key={challenge.slug}>
                        <Meter
                          value={Math.min(100, (challenge.progress / challenge.goalCount) * 100)}
                          label={challenge.title}
                          right={`${Math.min(challenge.progress, challenge.goalCount)}/${challenge.goalCount}`}
                          height={6}
                          severity={false}
                        />
                        <p className="mt-1 text-[11px] ink-muted">
                          {challenge.description} · {challenge.daysRemaining}d left
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          </div>

          {/* ── Other companies ── */}
          {data.companies.length > 1 ? (
            <Card>
              <SectionHeading level={3} title="Companies you are following" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.companies.map((company) => (
                  <Link
                    key={company.id}
                    to={`/companies/${company.slug}`}
                    className="rounded-lg border p-3 transition-opacity hover:opacity-80"
                    style={{ borderColor: 'var(--hairline)' }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <CompanyLogo
                        name={company.name}
                        logoText={company.logoText}
                        brandColor={company.brandColor}
                        size={28}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium ink">{company.name}</span>
                      {company.isPrimaryTarget ? <Badge tone="brand">Target</Badge> : null}
                    </div>
                    <Meter value={company.readiness} right={pctText(company.readiness)} height={6} />
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
