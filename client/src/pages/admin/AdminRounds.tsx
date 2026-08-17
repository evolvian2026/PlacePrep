import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, ROUND_TYPE_LABEL } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
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

interface Round {
  id: number;
  company_id: number;
  slug: string;
  name: string;
  round_type: string;
  sequence: number;
  description: string | null;
  duration_minutes: number | null;
  difficulty: string;
  elimination: number;
  estimated_prep_hours: number;
  negative_marking: number;
  section_lock: number;
}

interface Section {
  id: number;
  round_id: number;
  slug: string;
  name: string;
  sequence: number;
  question_count: number;
  duration_minutes: number | null;
  marks_per_question: number;
  negative_marks: number;
  question_kind: string;
}

interface RoundTopic {
  round_id: number;
  topic_id: number;
  section_id: number | null;
  importance: string;
  weight: number;
  name: string;
  slug: string;
  category: string;
}

interface Topic {
  id: number;
  name: string;
  slug: string;
  category: string;
  parent_id: number | null;
  question_count: number;
}

const ROUND_TYPES = Object.keys(ROUND_TYPE_LABEL);

export default function AdminRounds() {
  const { data: companyData } = useApi<{ companies: { id: number; slug: string; name: string }[] }>('/admin/companies');
  const { data: topicData } = useApi<{ topics: Topic[] }>('/admin/topics');
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!companyId && companyData?.companies?.length) setCompanyId(String(companyData.companies[0].id));
  }, [companyData, companyId]);

  const { data, loading, error, reload } = useApi<{ rounds: Round[]; sections: Section[]; topics: RoundTopic[] }>(
    companyId ? `/admin/companies/${companyId}/rounds` : null,
  );

  const [roundModal, setRoundModal] = useState<{ mode: 'create' | 'edit'; round?: Round } | null>(null);
  const [sectionFor, setSectionFor] = useState<Round | null>(null);
  const [topicsFor, setTopicsFor] = useState<Round | null>(null);

  const removeRound = useMutation(async (round: Round) => {
    await api(`/admin/rounds/${round.id}`, { method: 'DELETE' });
    reload();
  });

  const removeSection = useMutation(async (section: Section) => {
    await api(`/admin/sections/${section.id}`, { method: 'DELETE' });
    reload();
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Rounds & roadmaps"
        subtitle="Configure each company's hiring process: the rounds, their sections and the topics each round expects."
        action={
          companyId ? (
            <Button onClick={() => setRoundModal({ mode: 'create' })}>+ Add round</Button>
          ) : null
        }
      />

      <Card>
        <div className="max-w-sm">
          <Select
            label="Company"
            value={companyId}
            onChange={setCompanyId}
            options={(companyData?.companies ?? []).map((company) => ({
              value: String(company.id),
              label: company.name,
            }))}
          />
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        data.rounds.length === 0 ? (
          <Card>
            <Empty
              title="No rounds configured"
              hint="Add the first round of this company's hiring process."
              action={<Button onClick={() => setRoundModal({ mode: 'create' })}>+ Add round</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {data.rounds.map((round) => {
              const sections = data.sections.filter((section) => section.round_id === round.id);
              const topics = data.topics.filter((topic) => topic.round_id === round.id);

              return (
                <Card key={round.id}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex size-6 items-center justify-center rounded-full text-xs font-semibold"
                          style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                        >
                          {round.sequence}
                        </span>
                        <h3 className="text-sm font-semibold ink">{round.name}</h3>
                        <Badge tone="brand">{ROUND_TYPE_LABEL[round.round_type]}</Badge>
                        <Badge>{DIFFICULTY_LABEL[round.difficulty]}</Badge>
                        {round.elimination === 1 ? <Badge tone="serious">Eliminating</Badge> : null}
                        {round.section_lock === 1 ? <Badge tone="warning">Section lock</Badge> : null}
                      </div>
                      <p className="mt-1.5 max-w-3xl text-xs ink-2">{round.description}</p>
                      <p className="mt-1 text-[11px] tabular ink-muted">
                        {round.duration_minutes ?? '—'} min · {round.estimated_prep_hours}h prep ·{' '}
                        {round.negative_marking > 0 ? `−${round.negative_marking} per wrong` : 'no negative marking'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setTopicsFor(round)}>
                        Topics ({topics.length})
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setSectionFor(round)}>
                        + Section
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRoundModal({ mode: 'edit', round })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Delete "${round.name}" and its sections?`)) void removeRound.mutate(round);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {sections.length > 0 ? (
                    <Table
                      rows={sections}
                      keyOf={(row) => row.id}
                      columns={[
                        { key: 'name', header: 'Section', render: (row) => row.name },
                        { key: 'kind', header: 'Type', render: (row) => row.question_kind },
                        { key: 'count', header: 'Questions', align: 'right', render: (row) => String(row.question_count) },
                        {
                          key: 'duration',
                          header: 'Duration',
                          align: 'right',
                          render: (row) => (row.duration_minutes ? `${row.duration_minutes} min` : 'shared'),
                        },
                        { key: 'marks', header: 'Marks/Q', align: 'right', render: (row) => String(row.marks_per_question) },
                        { key: 'neg', header: 'Negative', align: 'right', render: (row) => String(row.negative_marks) },
                        {
                          key: 'topics',
                          header: 'Topics',
                          align: 'right',
                          render: (row) => String(topics.filter((topic) => topic.section_id === row.id).length),
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
                                if (window.confirm(`Delete section "${row.name}"?`)) void removeSection.mutate(row);
                              }}
                            >
                              Delete
                            </Button>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <p className="text-xs ink-muted">No sections yet — add one to make this round testable.</p>
                  )}

                  {topics.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                      {topics.map((topic) => (
                        <span
                          key={topic.topic_id}
                          className="rounded px-2 py-0.5 text-[11px]"
                          style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                        >
                          {topic.name}
                          {topic.importance !== 'core' ? <span className="ink-muted"> ({topic.importance})</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {roundModal ? (
        <RoundModal
          companyId={Number(companyId)}
          round={roundModal.round}
          nextSequence={(data?.rounds.length ?? 0) + 1}
          onClose={() => setRoundModal(null)}
          onSaved={() => {
            setRoundModal(null);
            reload();
          }}
        />
      ) : null}

      {sectionFor ? (
        <SectionModal
          round={sectionFor}
          nextSequence={(data?.sections.filter((section) => section.round_id === sectionFor.id).length ?? 0) + 1}
          onClose={() => setSectionFor(null)}
          onSaved={() => {
            setSectionFor(null);
            reload();
          }}
        />
      ) : null}

      {topicsFor && topicData ? (
        <TopicsModal
          round={topicsFor}
          allTopics={topicData.topics}
          sections={data?.sections.filter((section) => section.round_id === topicsFor.id) ?? []}
          current={data?.topics.filter((topic) => topic.round_id === topicsFor.id) ?? []}
          onClose={() => setTopicsFor(null)}
          onSaved={() => {
            setTopicsFor(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function RoundModal({
  companyId,
  round,
  nextSequence,
  onClose,
  onSaved,
}: {
  companyId: number;
  round?: Round;
  nextSequence: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(round?.name ?? '');
  const [roundType, setRoundType] = useState(round?.round_type ?? 'aptitude');
  const [sequence, setSequence] = useState(String(round?.sequence ?? nextSequence));
  const [description, setDescription] = useState(round?.description ?? '');
  const [duration, setDuration] = useState(round?.duration_minutes ? String(round.duration_minutes) : '60');
  const [difficulty, setDifficulty] = useState(round?.difficulty ?? 'moderate');
  const [prepHours, setPrepHours] = useState(String(round?.estimated_prep_hours ?? 20));
  const [negative, setNegative] = useState(String(round?.negative_marking ?? 0));
  const [elimination, setElimination] = useState(round ? round.elimination === 1 : true);
  const [sectionLock, setSectionLock] = useState(round ? round.section_lock === 1 : false);

  const save = useMutation(async () => {
    const body = {
      name,
      roundType,
      sequence: Number(sequence),
      description: description || null,
      durationMinutes: duration ? Number(duration) : null,
      difficulty,
      estimatedPrepHours: Number(prepHours),
      negativeMarking: Number(negative),
      elimination,
      sectionLock,
    };
    if (round) await api(`/admin/rounds/${round.id}`, { method: 'PATCH', body });
    else await api(`/admin/companies/${companyId}/rounds`, { method: 'POST', body });
    onSaved();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={round ? `Edit ${round.name}` : 'Add a round'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save.mutate(undefined)} disabled={save.pending || !name}>
            {save.pending ? 'Saving…' : 'Save round'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Round name" value={name} onChange={setName} placeholder="Round 1 — Aptitude" required />
        </div>
        <Select
          label="Round type"
          value={roundType}
          onChange={setRoundType}
          options={ROUND_TYPES.map((value) => ({ value, label: ROUND_TYPE_LABEL[value] }))}
        />
        <Input label="Sequence" type="number" value={sequence} onChange={setSequence} min={1} max={20} />
        <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} />
        <Select
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={['easy', 'moderate', 'hard', 'very_hard'].map((value) => ({
            value,
            label: DIFFICULTY_LABEL[value],
          }))}
        />
        <Input label="Estimated prep (hours)" type="number" value={prepHours} onChange={setPrepHours} />
        <Input label="Negative marking" type="number" value={negative} onChange={setNegative} step={0.25} />
        <div className="sm:col-span-2">
          <Textarea label="Description" value={description} onChange={setDescription} rows={3} />
        </div>
        <Checkbox label="Eliminating round" checked={elimination} onChange={setElimination} />
        <Checkbox label="Lock sections once submitted" checked={sectionLock} onChange={setSectionLock} />
        {save.error ? (
          <div className="sm:col-span-2">
            <ErrorNote message={save.error} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function SectionModal({
  round,
  nextSequence,
  onClose,
  onSaved,
}: {
  round: Round;
  nextSequence: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [sequence, setSequence] = useState(String(nextSequence));
  const [questionCount, setQuestionCount] = useState('20');
  const [duration, setDuration] = useState('25');
  const [marks, setMarks] = useState('1');
  const [negative, setNegative] = useState(String(round.negative_marking));
  const [kind, setKind] = useState('mcq');

  const save = useMutation(async () => {
    await api(`/admin/rounds/${round.id}/sections`, {
      method: 'POST',
      body: {
        name,
        sequence: Number(sequence),
        questionCount: Number(questionCount),
        durationMinutes: duration ? Number(duration) : null,
        marksPerQuestion: Number(marks),
        negativeMarks: Number(negative),
        questionKind: kind,
      },
    });
    onSaved();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add a section to ${round.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save.mutate(undefined)} disabled={save.pending || !name}>
            {save.pending ? 'Saving…' : 'Add section'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Section name" value={name} onChange={setName} placeholder="Numerical Ability" required />
        </div>
        <Input label="Sequence" type="number" value={sequence} onChange={setSequence} min={1} />
        <Select
          label="Question kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'mcq', label: 'MCQ' },
            { value: 'multi_select', label: 'Multi-select' },
            { value: 'coding', label: 'Coding' },
            { value: 'subjective', label: 'Subjective' },
            { value: 'mixed', label: 'Mixed' },
          ]}
        />
        <Input label="Question count" type="number" value={questionCount} onChange={setQuestionCount} min={1} />
        <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} hint="Blank shares the round timer" />
        <Input label="Marks per question" type="number" value={marks} onChange={setMarks} step={0.5} />
        <Input label="Negative marks" type="number" value={negative} onChange={setNegative} step={0.25} />
        {save.error ? (
          <div className="sm:col-span-2">
            <ErrorNote message={save.error} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function TopicsModal({
  round,
  allTopics,
  sections,
  current,
  onClose,
  onSaved,
}: {
  round: Round;
  allTopics: Topic[];
  sections: Section[];
  current: RoundTopic[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Map<number, { sectionId: number | null; importance: string }>>(
    () => new Map(current.map((topic) => [topic.topic_id, { sectionId: topic.section_id, importance: topic.importance }])),
  );
  const [search, setSearch] = useState('');

  const save = useMutation(async () => {
    await api(`/admin/rounds/${round.id}/topics`, {
      method: 'PUT',
      body: {
        topics: [...selected.entries()].map(([topicId, value]) => ({
          topicId,
          sectionId: value.sectionId,
          importance: value.importance,
        })),
      },
    });
    onSaved();
  });

  const filtered = allTopics.filter(
    (topic) => !search || topic.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Roadmap topics for ${round.name}`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save.mutate(undefined)} disabled={save.pending}>
            {save.pending ? 'Saving…' : `Save ${selected.size} topic(s)`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Note>
          These topics are what students see as the round's syllabus, and they are what readiness is measured against.
          Attach a topic to a section when it is tested in that timed section; leave it unattached for interview
          discussion topics.
        </Note>

        <Input label="Filter topics" value={search} onChange={setSearch} placeholder="Search by name" />

        <div className="max-h-96 space-y-1 overflow-y-auto scroll-thin">
          {filtered.map((topic) => {
            const entry = selected.get(topic.id);
            return (
              <div
                key={topic.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2"
                style={{ borderColor: entry ? 'var(--brand)' : 'var(--hairline)' }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(entry)}
                  onChange={(event) => {
                    setSelected((current2) => {
                      const next = new Map(current2);
                      if (event.target.checked) next.set(topic.id, { sectionId: null, importance: 'core' });
                      else next.delete(topic.id);
                      return next;
                    });
                  }}
                  className="size-4"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span className="min-w-0 flex-1 text-sm ink">
                  {topic.parent_id ? <span className="ink-muted">— </span> : null}
                  {topic.name}
                  <span className="ml-1.5 text-[11px] ink-muted">
                    {CATEGORY_LABEL[topic.category]} · {topic.question_count}Q
                  </span>
                </span>

                {entry ? (
                  <>
                    <select
                      value={entry.sectionId === null ? '' : String(entry.sectionId)}
                      onChange={(event) =>
                        setSelected((current2) => {
                          const next = new Map(current2);
                          next.set(topic.id, {
                            ...entry,
                            sectionId: event.target.value ? Number(event.target.value) : null,
                          });
                          return next;
                        })
                      }
                      className="rounded border px-1.5 py-1 text-xs"
                      style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
                    >
                      <option value="">Interview / unsectioned</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={entry.importance}
                      onChange={(event) =>
                        setSelected((current2) => {
                          const next = new Map(current2);
                          next.set(topic.id, { ...entry, importance: event.target.value });
                          return next;
                        })
                      }
                      className="rounded border px-1.5 py-1 text-xs"
                      style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
                    >
                      <option value="core">Core</option>
                      <option value="recommended">Recommended</option>
                      <option value="optional">Optional</option>
                    </select>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {save.error ? <ErrorNote message={save.error} /> : null}
      </div>
    </Modal>
  );
}
