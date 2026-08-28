import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Note,
  SectionHeading,
  Spinner,
  Tabs,
} from '../../components/ui';

interface Rubric {
  key: string;
  label: string;
  hint: string;
}

interface Prompt {
  id: number;
  slug: string;
  prompt: string;
  category: string;
  guidance: string | null;
  answer: {
    situation: string;
    task: string;
    action: string;
    result: string;
    selfReview: Record<string, number>;
    updatedAt: string;
  } | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  behavioural: 'Behavioural',
  situational: 'Situational',
  motivation: 'Motivation',
  teamwork: 'Teamwork',
  failure: 'Failure',
  leadership: 'Leadership',
};

const STEPS = [
  { key: 'situation', label: 'Situation', hint: 'Where and when. One or two sentences of context.' },
  { key: 'task', label: 'Task', hint: 'What you specifically were responsible for.' },
  { key: 'action', label: 'Action', hint: 'What you did. This is the longest part — be concrete.' },
  { key: 'result', label: 'Result', hint: 'What changed, and how you know.' },
] as const;

export default function Interview() {
  const [category, setCategory] = useState('all');
  const { data, loading, error, reload } = useApi<{ rubric: Rubric[]; prompts: Prompt[] }>(
    '/practice/interview-prompts',
  );

  const prompts = (data?.prompts ?? []).filter((p) => category === 'all' || p.category === category);
  const answered = (data?.prompts ?? []).filter((p) => p.answer).length;

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Interview answers"
        subtitle="Draft your behavioural answers in STAR form, so you are not inventing them in the room."
      />

      <Note>
        Nothing here is scored. Judging a written answer properly is something a person does — your placement
        cell, a senior, a friend who will be honest. What this gives you is the structure interviewers expect
        and a checklist to review your own draft against. Write your own stories: a borrowed one falls apart
        on the first follow-up question.
      </Note>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        <>
          <p className="text-xs ink-muted">
            {answered} of {data.prompts.length} drafted
          </p>

          <Tabs
            tabs={[
              { id: 'all', label: 'All' },
              ...[...new Set(data.prompts.map((p) => p.category))].map((id) => ({
                id,
                label: CATEGORY_LABEL[id] ?? id,
              })),
            ]}
            active={category}
            onChange={setCategory}
          />

          <div className="space-y-4">
            {prompts.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} rubric={data.rubric} onSaved={reload} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PromptCard({
  prompt,
  rubric,
  onSaved,
}: {
  prompt: Prompt;
  rubric: Rubric[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ situation: '', task: '', action: '', result: '' });
  const [review, setReview] = useState<Record<string, number>>({});

  useEffect(() => {
    setDraft({
      situation: prompt.answer?.situation ?? '',
      task: prompt.answer?.task ?? '',
      action: prompt.answer?.action ?? '',
      result: prompt.answer?.result ?? '',
    });
    setReview(prompt.answer?.selfReview ?? {});
  }, [prompt.answer]);

  const save = useMutation(async () => {
    await api(`/practice/interview-prompts/${prompt.id}/answer`, {
      method: 'PUT',
      body: { ...draft, selfReview: review },
    });
    onSaved();
  });

  // A rough spoken-length read. Stated as a range because it is an estimate,
  // not a measurement — 130 words a minute is a normal speaking pace.
  const words = Object.values(draft).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.round((words / 130) * 60);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{CATEGORY_LABEL[prompt.category] ?? prompt.category}</Badge>
            {prompt.answer ? <Badge tone="good" icon="✓">Drafted</Badge> : null}
          </div>
          <h3 className="text-sm font-semibold ink">{prompt.prompt}</h3>
          {prompt.guidance ? <p className="mt-1 text-xs leading-relaxed ink-2">{prompt.guidance}</p> : null}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : prompt.answer ? 'Edit answer' : 'Draft answer'}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
          {STEPS.map((step) => (
            <label key={step.key} className="block">
              <span className="mb-1 flex items-baseline gap-2">
                <span className="text-xs font-semibold ink">{step.label}</span>
                <span className="text-[11px] ink-muted">{step.hint}</span>
              </span>
              <textarea
                className="w-full rounded-lg border p-2 text-sm"
                style={{ borderColor: 'var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                rows={step.key === 'action' ? 5 : 2}
                value={draft[step.key]}
                onChange={(event) => setDraft((d) => ({ ...d, [step.key]: event.target.value }))}
              />
            </label>
          ))}

          <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
            <p className="mb-2 text-xs font-semibold ink">Check your own draft</p>
            <div className="space-y-2">
              {rubric.map((item) => (
                <label key={item.key} className="flex items-start gap-2 text-xs ink-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={(review[item.key] ?? 0) > 0}
                    onChange={(event) =>
                      setReview((r) => ({ ...r, [item.key]: event.target.checked ? 3 : 0 }))
                    }
                  />
                  <span>
                    <span className="font-medium ink">{item.label}</span> — {item.hint}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save.mutate(undefined)} disabled={save.pending}>
              {save.pending ? 'Saving…' : 'Save draft'}
            </Button>
            <span className="text-xs ink-muted">
              {words} words · roughly {seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`} spoken
              {seconds > 150 ? ' — longer than most interviewers want' : ''}
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
