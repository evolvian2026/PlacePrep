import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { dateTimeText } from '../../lib/format';
import { Button, Card, ErrorNote, Note, SectionHeading, Spinner, Textarea } from '../../components/ui';

interface Setting {
  key: string;
  value: string;
  parsed: unknown;
  updatedAt: string;
}

const DESCRIPTIONS: Record<string, string> = {
  'platform.name': 'Shown in the sidebar and on the sign-in page.',
  'platform.tagline': 'Short strapline under the platform name.',
  'readiness.weights':
    'How the readiness score is composed. Values are normalised, so they need not sum to 1 — {"topicMastery":0.45,"mockPerformance":0.4,"coverage":0.15}.',
  'readiness.thresholds': 'Score boundaries for the weak / average / strong bands shown throughout the UI.',
  'practice.defaultBatchSize': 'How many questions a practice page loads at a time.',
  'gamification.xp': 'XP awarded per correct answer, accepted coding submission, completed mock and mastered topic.',
  'roadmap.defaultHorizonDays': 'Default length of a generated study plan when the student does not choose one.',
  'content.disclaimer':
    'Shown on every company intelligence page. Keep this accurate — it is what tells students the round data is indicative rather than official.',
};

export default function AdminSettings() {
  const { data, loading, error, reload } = useApi<{ settings: Setting[] }>('/admin/settings');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setDrafts(Object.fromEntries(data.settings.map((setting) => [setting.key, setting.value])));
  }, [data]);

  const save = useMutation(async () => {
    const entries = Object.entries(drafts)
      .filter(([key, value]) => data?.settings.find((setting) => setting.key === key)?.value !== value)
      .map(([key, value]) => ({ key, value }));
    if (entries.length === 0) return null;
    await api('/admin/settings', { method: 'PUT', body: { entries } });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
    reload();
    return entries;
  });

  const dirty = data
    ? Object.entries(drafts).some(
        ([key, value]) => data.settings.find((setting) => setting.key === key)?.value !== value,
      )
    : false;

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Settings"
        subtitle="Platform-wide configuration. JSON values are validated when the platform reads them, and bad values fall back to defaults rather than breaking scoring."
        action={
          <div className="flex items-center gap-3">
            {saved ? <span className="text-xs" style={{ color: 'var(--good-text)' }}>Saved ✓</span> : null}
            <Button onClick={() => void save.mutate(undefined)} disabled={!dirty || save.pending}>
              {save.pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {save.error ? <ErrorNote message={save.error} /> : null}

      {data ? (
        <div className="space-y-4">
          {data.settings.map((setting) => {
            const isJson = typeof setting.parsed === 'object' && setting.parsed !== null;
            return (
              <Card key={setting.key}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <code className="text-sm font-semibold ink">{setting.key}</code>
                  <span className="text-[11px] ink-muted">Updated {dateTimeText(setting.updatedAt)}</span>
                </div>
                {DESCRIPTIONS[setting.key] ? (
                  <p className="mb-2 text-xs ink-2">{DESCRIPTIONS[setting.key]}</p>
                ) : null}
                <Textarea
                  value={drafts[setting.key] ?? ''}
                  onChange={(value) => setDrafts((current) => ({ ...current, [setting.key]: value }))}
                  rows={isJson ? 3 : setting.value.length > 120 ? 4 : 2}
                  mono={isJson}
                />
              </Card>
            );
          })}

          <Note>
            Changing <code>readiness.weights</code> or <code>readiness.thresholds</code> rescales every readiness
            number on the platform the next time it is computed. Historical attempt reports keep the scores they were
            generated with.
          </Note>
        </div>
      ) : null}
    </div>
  );
}
