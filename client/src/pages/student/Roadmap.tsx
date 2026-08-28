import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  HeroScore,
  Meter,
  Input,
  Note,
  SectionHeading,
  Select,
  Spinner,
} from '../../components/ui';

interface PlanItem {
  id: number;
  dayIndex: number;
  actionType: string;
  topicId?: number;
  roundId?: number;
  mockTestId?: number;
  title: string;
  detail: string;
  estMinutes: number;
  priority: number;
  isDone: boolean;
}

interface RoadmapData {
  plan: {
    planId: number;
    horizonDays: number;
    readiness: number;
    rationale: string;
    generatedAt: string;
    items: PlanItem[];
    targetDate: string | null;
    daysToTarget: number | null;
    pace: 'comfortable' | 'tight' | 'past' | null;
  };
  readiness: {
    score: number;
    band: string;
    explanation: string;
    components: { topicMastery: number; mockPerformance: number; coverage: number };
    rounds: { roundId: number; roundName: string; completion: number; status: string }[];
  };
  priorities: {
    topicId: number;
    name: string;
    category: string;
    mastery: number;
    attempted: number;
    roundName: string;
    priority: number;
    reasons: string[];
  }[];
  enrichment: {
    topics: Record<string, { id: number; name: string; slug: string }>;
    mockTests: Record<string, { id: number; slug: string; title: string; durationMinutes: number }>;
  };
}

const ACTION_META: Record<string, { icon: string; label: string }> = {
  study_topic: { icon: '📖', label: 'Study' },
  practice_topic: { icon: '✎', label: 'Practise' },
  coding_practice: { icon: '⌘', label: 'Code' },
  sectional_mock: { icon: '⏱', label: 'Sectional mock' },
  round_mock: { icon: '⏱', label: 'Round mock' },
  company_mock: { icon: '🎯', label: 'Full mock' },
  revision: { icon: '↻', label: 'Revision' },
};

export default function Roadmap() {
  const navigate = useNavigate();
  const [companySlug, setCompanySlug] = useState('');
  const [horizon, setHorizon] = useState('7');
  const [minutes, setMinutes] = useState('120');

  const { data: dashboard } = useApi<{
    companies: { slug: string; name: string; isPrimaryTarget: boolean }[];
  }>('/dashboard');

  useEffect(() => {
    if (!companySlug && dashboard?.companies?.length) {
      const primary = dashboard.companies.find((company) => company.isPrimaryTarget) ?? dashboard.companies[0];
      setCompanySlug(primary.slug);
    }
  }, [dashboard, companySlug]);

  const { data, loading, error, reload } = useApi<RoadmapData>(companySlug ? '/roadmap' : null, {
    companySlug,
    horizonDays: horizon,
    minutesPerDay: minutes,
  });

  const [driveDate, setDriveDate] = useState('');
  // Reflect whatever the server holds when the company changes, so the field
  // shows the saved date rather than an empty box.
  useEffect(() => setDriveDate(data?.plan.targetDate ?? ''), [data?.plan.targetDate, companySlug]);

  const regenerate = useMutation(async (nextDate?: string | null) => {
    await api('/roadmap/regenerate', {
      method: 'POST',
      body: {
        companySlug,
        minutesPerDay: Number(minutes),
        // A drive date sets the horizon; the manual length only applies without one.
        ...(nextDate === undefined
          ? driveDate
            ? { targetDate: driveDate }
            : { horizonDays: Number(horizon) }
          : { targetDate: nextDate }),
      },
    });
    reload();
  });

  const toggle = useMutation(async (input: { itemId: number; done: boolean }) => {
    await api(`/roadmap/items/${input.itemId}`, { method: 'POST', body: { done: input.done } });
    reload();
  });

  if (!dashboard?.companies?.length) {
    return (
      <Card>
        <Empty
          title="No target company yet"
          hint="Pick a company first — the roadmap is generated against its specific rounds and topics."
          action={<Button onClick={() => navigate('/companies')}>Browse companies</Button>}
        />
      </Card>
    );
  }

  const days = data ? Array.from({ length: data.plan.horizonDays }, (_, index) => index + 1) : [];
  const doneCount = data?.plan.items.filter((item) => item.isDone).length ?? 0;
  const totalCount = data?.plan.items.length ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="My roadmap"
        subtitle="Generated from your latest results. It rewrites itself whenever you submit a new mock test."
        action={
          <Button onClick={() => void regenerate.mutate(undefined)} disabled={regenerate.pending}>
            {regenerate.pending ? 'Rebuilding…' : 'Regenerate plan'}
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Target company"
            value={companySlug}
            onChange={setCompanySlug}
            options={dashboard.companies.map((company) => ({ value: company.slug, label: company.name }))}
          />
          <Select
            label="Plan length"
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: '3', label: '3 days' },
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
          <Input
            label="Drive date (optional)"
            type="date"
            value={driveDate}
            onChange={setDriveDate}
          />
          <Select
            label="Time per day"
            value={minutes}
            onChange={setMinutes}
            options={[
              { value: '60', label: '1 hour' },
              { value: '120', label: '2 hours' },
              { value: '180', label: '3 hours' },
              { value: '300', label: '5 hours' },
            ]}
          />
        </div>
      </Card>

      {data?.plan.targetDate ? <DriveCountdown plan={data.plan} /> : null}

      {loading ? <Spinner label="Generating your plan…" /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
            <Card>
              <SectionHeading level={3} title="Current readiness" />
              <HeroScore score={data.readiness.score} caption={data.readiness.explanation} />
              <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                <Meter
                  value={totalCount ? (doneCount / totalCount) * 100 : 0}
                  label="Plan completed"
                  right={`${doneCount}/${totalCount}`}
                  severity={false}
                />
              </div>
            </Card>

            <Card>
              <SectionHeading level={3} title="Why this plan" subtitle="The reasoning behind the sequencing." />
              <p className="text-sm leading-relaxed ink-2">{data.plan.rationale}</p>

              <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide ink-muted">Top priorities</h4>
              <ul className="space-y-2">
                {data.priorities.slice(0, 5).map((priority) => (
                  <li key={priority.topicId} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/practice?topicId=${priority.topicId}`} className="text-sm font-medium ink hover:underline">
                        {priority.name}
                      </Link>
                      <span className="text-xs tabular ink-muted">
                        {priority.attempted === 0 ? 'Not started' : `${pctText(priority.mastery)} mastery`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] ink-muted">{priority.reasons.join(' · ')}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-3">
            <SectionHeading
              title={`${data.plan.horizonDays}-day plan`}
              subtitle="Tick items off as you finish them. The plan reprioritises after every mock test."
            />

            {days.map((day) => {
              const items = data.plan.items.filter((item) => item.dayIndex === day);
              const dayMinutes = items.reduce((sum, item) => sum + item.estMinutes, 0);
              const allDone = items.length > 0 && items.every((item) => item.isDone);

              return (
                <Card key={day} className={allDone ? 'opacity-70' : undefined}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                      >
                        {day}
                      </span>
                      <h3 className="text-sm font-semibold ink">Day {day}</h3>
                      {allDone ? <Badge tone="good" icon="✓">Done</Badge> : null}
                    </div>
                    <span className="text-xs tabular ink-muted">≈ {Math.round(dayMinutes / 60 * 10) / 10} hrs</span>
                  </div>

                  <ul className="space-y-2">
                    {items.map((item) => {
                      const meta = ACTION_META[item.actionType] ?? { icon: '•', label: item.actionType };
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                          style={{ borderColor: 'var(--hairline)' }}
                        >
                          <input
                            type="checkbox"
                            checked={item.isDone}
                            onChange={(event) => void toggle.mutate({ itemId: item.id, done: event.target.checked })}
                            className="mt-0.5 size-4 shrink-0"
                            style={{ accentColor: 'var(--brand)' }}
                            aria-label={`Mark "${item.title}" as done`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium ink" style={item.isDone ? { textDecoration: 'line-through' } : undefined}>
                                <span aria-hidden="true" className="mr-1.5">
                                  {meta.icon}
                                </span>
                                {item.title}
                              </span>
                              <Badge>{meta.label}</Badge>
                              <span className="text-xs tabular ink-muted">{item.estMinutes} min</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed ink-2">{item.detail}</p>
                          </div>
                          <div className="shrink-0">
                            {item.mockTestId ? (
                              <Button size="sm" variant="secondary" onClick={() => navigate('/mock-tests')}>
                                Open
                              </Button>
                            ) : item.topicId ? (
                              <Link to={`/practice?topicId=${item.topicId}`}>
                                <Button size="sm" variant="secondary">
                                  Open
                                </Button>
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>

          <Note>
            This plan is produced by a deterministic priority model, not a language model: each topic is scored on
            mastery gap, importance to the round, how early the round sits in the process, whether you have ever
            attempted it, and how long since you last revised it. That is why every item can tell you exactly why it
            is there.
          </Note>
        </>
      ) : null}
    </div>
  );
}


/**
 * A drive date turns the plan from "some study" into "study before Thursday",
 * so the countdown is stated plainly — including when the date has passed,
 * which the plan would otherwise silently ignore.
 */
function DriveCountdown({ plan }: { plan: RoadmapData['plan'] }) {
  const days = plan.daysToTarget ?? 0;
  const done = plan.items.filter((item) => item.isDone).length;
  const remaining = plan.items.length - done;

  if (plan.pace === 'past') {
    return (
      <Note tone="warning">
        <strong>Your drive date ({plan.targetDate}) has passed.</strong> This plan has gone back to a rolling
        schedule. Set a new date if you are preparing for a later round.
      </Note>
    );
  }

  return (
    <Note tone={plan.pace === 'tight' ? 'warning' : 'neutral'}>
      <strong>
        {days === 0 ? 'Your drive is today.' : `${days} day${days === 1 ? '' : 's'} until your drive on ${plan.targetDate}.`}
      </strong>{' '}
      {remaining} of {plan.items.length} planned tasks left
      {days > 0 ? `, about ${Math.ceil(remaining / days)} a day to finish in time` : ''}.
      {plan.pace === 'tight'
        ? ' That is less time than a full plan usually takes, so this one leads with the highest-weight topics.'
        : ''}
    </Note>
  );
}