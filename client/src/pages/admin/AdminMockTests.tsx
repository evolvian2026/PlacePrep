import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, SCOPE_LABEL, pctText } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorNote,
  Input,
  Modal,
  Note,
  SectionHeading,
  Select,
  Spinner,
  Table,
  Textarea,
} from '../../components/ui';

interface MockRow {
  id: number;
  slug: string;
  title: string;
  scope: string;
  duration_minutes: number;
  total_marks: number;
  difficulty: string;
  is_published: number;
  company_name: string | null;
  company_slug: string | null;
  round_name: string | null;
  section_count: number;
  question_total: number;
  attempt_count: number;
  average_score: number | null;
}

interface Topic {
  id: number;
  name: string;
  slug: string;
  category: string;
  parent_id: number | null;
  question_count: number;
}

interface SectionDraft {
  name: string;
  questionCount: number;
  durationMinutes: string;
  marksPerQuestion: string;
  negativeMarks: string;
  questionKind: string;
  topicIds: number[];
  easy: string;
  medium: string;
  hard: string;
}

const emptySection = (sequence: number): SectionDraft => ({
  name: `Section ${sequence}`,
  questionCount: 10,
  durationMinutes: '15',
  marksPerQuestion: '1',
  negativeMarks: '0',
  questionKind: 'mcq',
  topicIds: [],
  easy: '',
  medium: '',
  hard: '',
});

export default function AdminMockTests() {
  const { data, loading, error, reload } = useApi<{ tests: MockRow[] }>('/admin/mock-tests');
  const [building, setBuilding] = useState(false);

  const remove = useMutation(async (test: MockRow) => {
    await api(`/admin/mock-tests/${test.id}`, { method: 'DELETE' });
    reload();
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Mock tests"
        subtitle="Papers are assembled at attempt time from selection rules, so every student gets a different draw from the same blueprint."
        action={<Button onClick={() => setBuilding(true)}>+ Build a mock test</Button>}
      />

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <Card>
          <Table
            rows={data.tests}
            keyOf={(row) => row.id}
            columns={[
              {
                key: 'title',
                header: 'Test',
                render: (row) => (
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{row.title}</span>
                      {row.is_published === 0 ? <Badge tone="warning">Unpublished</Badge> : null}
                    </div>
                    <div className="text-[11px] ink-muted">
                      {row.company_name ?? 'General'}
                      {row.round_name ? ` · ${row.round_name}` : ''}
                    </div>
                  </div>
                ),
              },
              { key: 'scope', header: 'Scope', render: (row) => <Badge tone="brand">{SCOPE_LABEL[row.scope]}</Badge> },
              { key: 'difficulty', header: 'Difficulty', render: (row) => DIFFICULTY_LABEL[row.difficulty] },
              {
                key: 'shape',
                header: 'Shape',
                align: 'right',
                render: (row) => (
                  <span className="text-xs">
                    {row.question_total}Q / {row.section_count} sec / {row.duration_minutes}m
                  </span>
                ),
              },
              { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => String(row.attempt_count) },
              {
                key: 'avg',
                header: 'Avg score',
                align: 'right',
                render: (row) => (row.average_score !== null ? pctText(row.average_score, 1) : '—'),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete "${row.title}"? Student attempts on it are removed too.`)) {
                        void remove.mutate(row);
                      }
                    }}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      {building ? (
        <BuilderModal
          onClose={() => setBuilding(false)}
          onSaved={() => {
            setBuilding(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function BuilderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: companyData } = useApi<{ companies: { id: number; slug: string; name: string }[] }>('/admin/companies');
  const { data: topicData } = useApi<{ topics: Topic[] }>('/admin/topics');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [scope, setScope] = useState('sectional');
  const [duration, setDuration] = useState('30');
  const [difficulty, setDifficulty] = useState('moderate');
  const [negativeMarking, setNegativeMarking] = useState('0');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [sectionLock, setSectionLock] = useState(false);
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection(1)]);
  const [preview, setPreview] = useState<Record<number, { matched: number; shortfall: number }>>({});

  const updateSection = (index: number, patch: Partial<SectionDraft>) =>
    setSections((current) => current.map((section, i) => (i === index ? { ...section, ...patch } : section)));

  const ruleFor = (section: SectionDraft) => {
    const mix: Record<string, number> = {};
    if (section.easy) mix.easy = Number(section.easy);
    if (section.medium) mix.medium = Number(section.medium);
    if (section.hard) mix.hard = Number(section.hard);
    return {
      topicIds: section.topicIds,
      questionTypes: section.questionKind === 'coding' ? ['coding'] : ['mcq', 'multi_select'],
      ...(Object.keys(mix).length ? { difficultyMix: mix } : {}),
    };
  };

  const checkRule = useMutation(async (index: number) => {
    const section = sections[index];
    const response = await api<{ matched: number; shortfall: number }>('/admin/mock-tests/preview-rule', {
      method: 'POST',
      body: { rule: ruleFor(section), count: section.questionCount, companySlug: companySlug || undefined },
    });
    setPreview((current) => ({ ...current, [index]: response }));
    return response;
  });

  const save = useMutation(async () => {
    await api('/admin/mock-tests', {
      method: 'POST',
      body: {
        title,
        description: description || null,
        companySlug: companySlug || null,
        scope,
        durationMinutes: Number(duration),
        difficulty,
        negativeMarking: Number(negativeMarking),
        shuffleQuestions,
        shuffleOptions,
        sectionLock,
        fullscreenRequired,
        isPublished,
        sections: sections.map((section, index) => ({
          name: section.name,
          sequence: index + 1,
          questionCount: section.questionCount,
          durationMinutes: section.durationMinutes ? Number(section.durationMinutes) : null,
          marksPerQuestion: Number(section.marksPerQuestion),
          negativeMarks: Number(section.negativeMarks),
          questionKind: section.questionKind as 'mcq' | 'coding' | 'multi_select' | 'mixed',
          selectionRule: ruleFor(section),
        })),
      },
    });
    onSaved();
  });

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Build a mock test"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save.mutate(undefined)} disabled={save.pending || !title || sections.length === 0}>
            {save.pending ? 'Creating…' : 'Create test'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Title" value={title} onChange={setTitle} placeholder="TCS Aptitude Sectional" required />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Description" value={description} onChange={setDescription} rows={2} />
          </div>
          <Select
            label="Company"
            value={companySlug}
            onChange={setCompanySlug}
            options={[
              { value: '', label: 'General (no company)' },
              ...(companyData?.companies ?? []).map((company) => ({ value: company.slug, label: company.name })),
            ]}
          />
          <Select
            label="Scope"
            value={scope}
            onChange={setScope}
            options={['quick', 'sectional', 'round', 'company'].map((value) => ({ value, label: SCOPE_LABEL[value] }))}
          />
          <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} min={1} />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={['easy', 'moderate', 'hard', 'very_hard'].map((value) => ({ value, label: DIFFICULTY_LABEL[value] }))}
          />
          <Input label="Negative marking" type="number" value={negativeMarking} onChange={setNegativeMarking} step={0.25} />
        </div>

        <div className="flex flex-wrap gap-4 rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
          <Checkbox label="Randomise question order" checked={shuffleQuestions} onChange={setShuffleQuestions} />
          <Checkbox label="Randomise option order" checked={shuffleOptions} onChange={setShuffleOptions} />
          <Checkbox label="Lock sections" checked={sectionLock} onChange={setSectionLock} />
          <Checkbox label="Require full screen" checked={fullscreenRequired} onChange={setFullscreenRequired} />
          <Checkbox label="Publish immediately" checked={isPublished} onChange={setIsPublished} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold ink">Sections</h3>
            <Button size="sm" variant="secondary" onClick={() => setSections((current) => [...current, emptySection(current.length + 1)])}>
              + Add section
            </Button>
          </div>

          <Note>
            Each section selects questions by rule at attempt time. Use “Check availability” to confirm the bank can
            actually fill the section before you publish — a shortfall means students get a shorter paper.
          </Note>

          <div className="mt-3 space-y-3">
            {sections.map((section, index) => (
              <div key={index} className="rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold ink-muted">Section {index + 1}</span>
                  {sections.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSections((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <Input label="Name" value={section.name} onChange={(value) => updateSection(index, { name: value })} />
                  </div>
                  <Input
                    label="Questions"
                    type="number"
                    value={String(section.questionCount)}
                    onChange={(value) => updateSection(index, { questionCount: Number(value) || 1 })}
                    min={1}
                  />
                  <Input
                    label="Duration (min)"
                    type="number"
                    value={section.durationMinutes}
                    onChange={(value) => updateSection(index, { durationMinutes: value })}
                  />
                  <Select
                    label="Question kind"
                    value={section.questionKind}
                    onChange={(value) => updateSection(index, { questionKind: value })}
                    options={[
                      { value: 'mcq', label: 'MCQ' },
                      { value: 'multi_select', label: 'Multi-select' },
                      { value: 'coding', label: 'Coding' },
                      { value: 'mixed', label: 'Mixed' },
                    ]}
                  />
                  <Input
                    label="Marks / question"
                    type="number"
                    value={section.marksPerQuestion}
                    onChange={(value) => updateSection(index, { marksPerQuestion: value })}
                    step={0.5}
                  />
                  <Input
                    label="Negative marks"
                    type="number"
                    value={section.negativeMarks}
                    onChange={(value) => updateSection(index, { negativeMarks: value })}
                    step={0.25}
                  />
                  <div />
                  <Input
                    label="Easy count"
                    type="number"
                    value={section.easy}
                    onChange={(value) => updateSection(index, { easy: value })}
                    hint="Optional mix"
                  />
                  <Input
                    label="Medium count"
                    type="number"
                    value={section.medium}
                    onChange={(value) => updateSection(index, { medium: value })}
                  />
                  <Input
                    label="Hard count"
                    type="number"
                    value={section.hard}
                    onChange={(value) => updateSection(index, { hard: value })}
                  />
                </div>

                <div className="mt-3">
                  <span className="mb-1.5 block text-xs font-medium ink-2">Topics to draw from</span>
                  <div className="max-h-40 overflow-y-auto scroll-thin rounded-lg border p-2" style={{ borderColor: 'var(--hairline)' }}>
                    <div className="flex flex-wrap gap-1.5">
                      {(topicData?.topics ?? [])
                        .filter((topic) => topic.question_count > 0)
                        .map((topic) => {
                          const chosen = section.topicIds.includes(topic.id);
                          return (
                            <button
                              key={topic.id}
                              onClick={() =>
                                updateSection(index, {
                                  topicIds: chosen
                                    ? section.topicIds.filter((id) => id !== topic.id)
                                    : [...section.topicIds, topic.id],
                                })
                              }
                              className="rounded px-2 py-1 text-[11px]"
                              style={
                                chosen
                                  ? { background: 'var(--brand)', color: '#fff' }
                                  : { background: 'var(--surface-2)', color: 'var(--ink-2)' }
                              }
                            >
                              {topic.name} <span className="opacity-70">{topic.question_count}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void checkRule.mutate(index)} disabled={checkRule.pending}>
                    Check availability
                  </Button>
                  {preview[index] ? (
                    <Badge tone={preview[index].shortfall > 0 ? 'warning' : 'good'}>
                      {preview[index].matched} available
                      {preview[index].shortfall > 0 ? ` · ${preview[index].shortfall} short` : ' · fills the section'}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {save.error ? <ErrorNote message={save.error} /> : null}
      </div>
    </Modal>
  );
}
