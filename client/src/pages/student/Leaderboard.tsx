import { useState } from 'react';
import { useApi } from '../../lib/hooks';
import { pctText } from '../../lib/format';
import { Avatar, Badge, Card, Empty, ErrorNote, SectionHeading, Select, Spinner, Table, Tabs } from '../../components/ui';

interface Entry {
  rank: number;
  userId: number;
  name: string;
  college: string | null;
  xp: number;
  badges: number;
  mocksCompleted: number;
  averageScore: number;
  streak: number;
  isCurrentUser: boolean;
}

export default function Leaderboard() {
  const [scope, setScope] = useState<'all_time' | 'weekly'>('all_time');
  const [companySlug, setCompanySlug] = useState('');

  const { data: companyData } = useApi<{ companies: { slug: string; name: string }[] }>('/companies');
  const { data, loading, error, reload } = useApi<{ entries: Entry[]; me: Entry | null }>('/gamification/leaderboard', {
    scope,
    companySlug: companySlug || undefined,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Leaderboard"
        subtitle="Ranked by XP earned from practice, coding and mock tests."
      />

      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          tabs={[
            { id: 'all_time', label: 'All time' },
            { id: 'weekly', label: 'This week' },
          ]}
          active={scope}
          onChange={(id) => setScope(id as 'all_time' | 'weekly')}
        />
        <div className="w-56">
          <Select
            label="Filter by company"
            value={companySlug}
            onChange={setCompanySlug}
            options={[
              { value: '', label: 'Everyone' },
              ...(companyData?.companies ?? []).map((company) => ({ value: company.slug, label: company.name })),
            ]}
          />
        </div>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        data.entries.length === 0 ? (
          <Card>
            <Empty title="Nobody on the board yet" hint="Answer some questions to appear here." />
          </Card>
        ) : (
          <>
            {data.me ? (
              <Card>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-3xl font-semibold ink">#{data.me.rank}</span>
                  <Avatar name={data.me.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium ink">{data.me.name} — that's you</div>
                    <div className="text-xs ink-muted">
                      {data.me.xp} XP · {data.me.badges} badges · {data.me.mocksCompleted} mocks ·{' '}
                      {data.me.streak}-day streak
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <Table
                rows={data.entries}
                keyOf={(row) => row.userId}
                columns={[
                  {
                    key: 'rank',
                    header: '#',
                    width: '56px',
                    render: (row) => (
                      <span className="tabular font-semibold">
                        {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                      </span>
                    ),
                  },
                  {
                    key: 'name',
                    header: 'Student',
                    render: (row) => (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.name} size={28} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{row.name}</span>
                            {row.isCurrentUser ? <Badge tone="brand">You</Badge> : null}
                          </div>
                          {row.college ? <div className="truncate text-[11px] ink-muted">{row.college}</div> : null}
                        </div>
                      </div>
                    ),
                  },
                  { key: 'xp', header: 'XP', align: 'right', render: (row) => row.xp.toLocaleString() },
                  { key: 'mocks', header: 'Mocks', align: 'right', render: (row) => String(row.mocksCompleted) },
                  { key: 'avg', header: 'Avg score', align: 'right', render: (row) => pctText(row.averageScore, 1) },
                  { key: 'streak', header: 'Streak', align: 'right', render: (row) => `${row.streak}d` },
                  { key: 'badges', header: 'Badges', align: 'right', render: (row) => String(row.badges) },
                ]}
              />
            </Card>
          </>
        )
      ) : null}
    </div>
  );
}
