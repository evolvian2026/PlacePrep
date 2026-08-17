import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, ROUND_TYPE_LABEL, pctText } from '../../lib/format';
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
  Tabs,
  Textarea,
} from '../../components/ui';

interface AdminQuestion {
  id: number;
  publicId: string;
  questionType: string;
  body: string;
  difficulty: string;
  topic: string | null;
  topicId: number | null;
  subtopic: string | null;
  marks: number;
  negativeMarks: number;
  expectedSeconds: number;
  frequentlyAsked: boolean;
  status: string;
  explanation: string | null;
  options: { label: string; body: string; isCorrect: boolean; whyWrong: string | null }[];
  usage: { attempts: number; correct: number; accuracy: number; skipped: number };
}

interface Topic {
  id: number;
  name: string;
  slug: string;
  category: string;
  parent_id: number | null;
  question_count: number;
}

interface ImportReport {
  report: { inserted: number; skipped: number; errors: { row: number; message: string }[] };
  dryRun: boolean;
  totalRows: number;
}

export default function AdminQuestions() {
  const [tab, setTab] = useState('bank');
  const [search, setSearch] = useState('');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('any');
  const [questionType, setQuestionType] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: topicData } = useApi<{ topics: Topic[] }>('/admin/topics');
  const { data, loading, error, reload } = useApi<{ questions: AdminQuestion[]; total: number }>('/admin/questions', {
    search: search || undefined,
    topicId: topicId || undefined,
    difficulty: difficulty || undefined,
    status,
    questionType: questionType || undefined,
    limit: 25,
    offset,
  });

  const remove = useMutation(async (question: AdminQuestion) => {
    const result = await api<{ archived: boolean; reason?: string }>(`/admin/questions/${question.id}`, {
      method: 'DELETE',
    });
    if (result.archived && result.reason) window.alert(result.reason);
    reload();
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Question bank"
        subtitle="One central bank. Questions are reusable across companies, rounds and mock tests via tags."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            + Add question
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'bank', label: 'Browse & edit', count: data?.total },
          { id: 'import', label: 'Bulk import' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bank' ? (
        <>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input label="Search" value={search} onChange={(value) => { setSearch(value); setOffset(0); }} placeholder="Text or QID" />
              <Select
                label="Topic"
                value={topicId}
                onChange={(value) => { setTopicId(value); setOffset(0); }}
                options={[
                  { value: '', label: 'All topics' },
                  ...(topicData?.topics ?? []).map((topic) => ({
                    value: String(topic.id),
                    label: `${topic.parent_id ? '— ' : ''}${topic.name} (${topic.question_count})`,
                  })),
                ]}
              />
              <Select
                label="Difficulty"
                value={difficulty}
                onChange={(value) => { setDifficulty(value); setOffset(0); }}
                options={[
                  { value: '', label: 'Any' },
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
              <Select
                label="Type"
                value={questionType}
                onChange={(value) => { setQuestionType(value); setOffset(0); }}
                options={[
                  { value: '', label: 'All types' },
                  { value: 'mcq', label: 'MCQ' },
                  { value: 'multi_select', label: 'Multi-select' },
                  { value: 'coding', label: 'Coding' },
                ]}
              />
              <Select
                label="Status"
                value={status}
                onChange={(value) => { setStatus(value); setOffset(0); }}
                options={[
                  { value: 'any', label: 'All statuses' },
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </div>
          </Card>

          {loading ? <Spinner /> : null}
          {error ? <ErrorNote message={error} onRetry={reload} /> : null}

          {data ? (
            <Card>
              <Table
                rows={data.questions}
                keyOf={(row) => row.id}
                columns={[
                  {
                    key: 'question',
                    header: 'Question',
                    render: (row) => (
                      <div className="max-w-xl">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono ink-muted">{row.publicId}</span>
                          {row.status !== 'published' ? <Badge tone="warning">{row.status}</Badge> : null}
                          {row.frequentlyAsked ? <Badge tone="brand" icon="★">FA</Badge> : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm ink">{row.body}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'topic',
                    header: 'Topic',
                    render: (row) => (
                      <span className="text-xs">
                        {row.topic ?? '—'}
                        {row.subtopic ? <span className="ink-muted"> / {row.subtopic}</span> : null}
                      </span>
                    ),
                  },
                  { key: 'type', header: 'Type', render: (row) => <Badge>{row.questionType}</Badge> },
                  { key: 'difficulty', header: 'Difficulty', render: (row) => DIFFICULTY_LABEL[row.difficulty] },
                  {
                    key: 'usage',
                    header: 'Live accuracy',
                    align: 'right',
                    render: (row) =>
                      row.usage.attempts > 0 ? (
                        <span>
                          {pctText(row.usage.accuracy, 0)}
                          <span className="ink-muted"> ({row.usage.attempts})</span>
                        </span>
                      ) : (
                        <span className="ink-muted">—</span>
                      ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row) => (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setEditing(row); }}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete or archive ${row.publicId}?`)) void remove.mutate(row);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />

              <div className="mt-4 flex items-center justify-between text-xs ink-muted">
                <span>
                  Showing {offset + 1}–{Math.min(offset + 25, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>
                    Previous
                  </Button>
                  <Button size="sm" variant="secondary" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'import' ? <ImportPanel onDone={reload} /> : null}

      {(creating || editing) && topicData ? (
        <QuestionModal
          question={editing}
          topics={topicData.topics}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function QuestionModal({
  question,
  topics,
  onClose,
  onSaved,
}: {
  question: AdminQuestion | null;
  topics: Topic[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(question?.body ?? '');
  const [topicId, setTopicId] = useState(question?.topicId ? String(question.topicId) : String(topics[0]?.id ?? ''));
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 'medium');
  const [questionType, setQuestionType] = useState(question?.questionType ?? 'mcq');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [expectedSeconds, setExpectedSeconds] = useState(String(question?.expectedSeconds ?? 60));
  const [marks, setMarks] = useState(String(question?.marks ?? 1));
  const [negativeMarks, setNegativeMarks] = useState(String(question?.negativeMarks ?? 0));
  const [frequentlyAsked, setFrequentlyAsked] = useState(question?.frequentlyAsked ?? false);
  const [status, setStatus] = useState(question?.status ?? 'published');
  const [options, setOptions] = useState(
    question?.options.length
      ? question.options.map((option) => ({ body: option.body, isCorrect: option.isCorrect, whyWrong: option.whyWrong ?? '' }))
      : OPTION_LABELS.map(() => ({ body: '', isCorrect: false, whyWrong: '' })),
  );
  const [companySlugs, setCompanySlugs] = useState('');
  const [roundTypes, setRoundTypes] = useState('');

  const { data: companyData } = useApi<{ companies: { slug: string; name: string }[] }>('/companies');

  const save = useMutation(async () => {
    const payload = {
      questionType,
      body,
      topicId: Number(topicId),
      difficulty,
      marks: Number(marks),
      negativeMarks: Number(negativeMarks),
      expectedSeconds: Number(expectedSeconds),
      explanation: explanation || undefined,
      frequentlyAsked,
      status,
      options: options
        .filter((option) => option.body.trim())
        .map((option) => ({ body: option.body, isCorrect: option.isCorrect, whyWrong: option.whyWrong || null })),
      companySlugs: companySlugs ? companySlugs.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      roundTypes: roundTypes ? roundTypes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    };

    if (question) await api(`/admin/questions/${question.id}`, { method: 'PATCH', body: payload });
    else await api('/admin/questions', { method: 'POST', body: payload });
    onSaved();
  });

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={question ? `Edit ${question.publicId}` : 'Add a question'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save.mutate(undefined)} disabled={save.pending || !body}>
            {save.pending ? 'Saving…' : 'Save question'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea label="Question" value={body} onChange={setBody} rows={4} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Topic"
            value={topicId}
            onChange={setTopicId}
            options={topics.map((topic) => ({
              value: String(topic.id),
              label: `${topic.parent_id ? '— ' : ''}${topic.name}`,
            }))}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={['easy', 'medium', 'hard'].map((value) => ({ value, label: DIFFICULTY_LABEL[value] }))}
          />
          <Select
            label="Type"
            value={questionType}
            onChange={setQuestionType}
            options={[
              { value: 'mcq', label: 'Single answer (MCQ)' },
              { value: 'multi_select', label: 'Multiple answers' },
            ]}
          />
          <Input label="Marks" type="number" value={marks} onChange={setMarks} step={0.5} />
          <Input label="Negative marks" type="number" value={negativeMarks} onChange={setNegativeMarks} step={0.25} />
          <Input label="Expected time (s)" type="number" value={expectedSeconds} onChange={setExpectedSeconds} />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium ink-2">Options</span>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="rounded-lg border p-2.5" style={{ borderColor: option.isCorrect ? 'var(--good)' : 'var(--hairline)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold ink-muted">{OPTION_LABELS[index]}</span>
                  <input
                    value={option.body}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, body: event.target.value } : entry)),
                      )
                    }
                    placeholder={`Option ${OPTION_LABELS[index]}`}
                    className="flex-1 rounded border px-2 py-1.5 text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
                  />
                  <label className="flex items-center gap-1 text-xs ink-2">
                    <input
                      type={questionType === 'mcq' ? 'radio' : 'checkbox'}
                      name="correct-option"
                      checked={option.isCorrect}
                      onChange={() =>
                        setOptions((current) =>
                          current.map((entry, i) =>
                            questionType === 'mcq'
                              ? { ...entry, isCorrect: i === index }
                              : i === index
                                ? { ...entry, isCorrect: !entry.isCorrect }
                                : entry,
                          ),
                        )
                      }
                      style={{ accentColor: 'var(--good)' }}
                    />
                    Correct
                  </label>
                </div>
                {!option.isCorrect && option.body ? (
                  <input
                    value={option.whyWrong}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, whyWrong: event.target.value } : entry)),
                      )
                    }
                    placeholder="Why is this option wrong? (shown to students who pick it)"
                    className="mt-2 w-full rounded border px-2 py-1.5 text-xs"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <Textarea label="Explanation" value={explanation} onChange={setExplanation} rows={3} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Company tags"
            value={companySlugs}
            onChange={setCompanySlugs}
            hint={`Comma-separated slugs. Blank = available to all. e.g. ${(companyData?.companies ?? []).slice(0, 3).map((c) => c.slug).join(', ')}`}
          />
          <Input
            label="Round-type tags"
            value={roundTypes}
            onChange={setRoundTypes}
            hint={`Comma-separated. e.g. ${Object.keys(ROUND_TYPE_LABEL).slice(0, 3).join(', ')}`}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <Checkbox label="Frequently asked" checked={frequentlyAsked} onChange={setFrequentlyAsked} />
          <Select
            label=""
            value={status}
            onChange={setStatus}
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        {save.error ? <ErrorNote message={save.error} /> : null}
      </div>
    </Modal>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ImportReport | null>(null);

  const run = useMutation(async (dryRun: boolean) => {
    const response = await api<ImportReport>('/admin/questions/import', {
      method: 'POST',
      body: { format: 'csv', content: csv, dryRun },
    });
    setResult(response);
    if (!dryRun) onDone();
    return response;
  });

  const template = useMutation(async () => {
    const text = await api<string>('/admin/questions/import-template', { raw: true });
    setCsv(text);
    return text;
  });

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          level={3}
          title="Bulk import"
          subtitle="Paste CSV exported from Excel or Google Sheets. Each row is validated on its own, so one bad row does not abort the batch."
          action={
            <Button variant="secondary" size="sm" onClick={() => void template.mutate(undefined)}>
              Load template
            </Button>
          }
        />

        <Note>
          Required columns: <code>body</code>, <code>topicSlug</code>, <code>difficulty</code>, <code>optionA</code>,{' '}
          <code>optionB</code>, <code>correct</code>. Optional: <code>publicId</code>, <code>subtopicSlug</code>,{' '}
          <code>questionType</code>, <code>optionC</code>, <code>optionD</code>, <code>explanation</code>,{' '}
          <code>conceptNote</code>, <code>marks</code>, <code>negativeMarks</code>, <code>expectedSeconds</code>,{' '}
          <code>companySlugs</code>, <code>roundTypes</code>, <code>frequentlyAsked</code>. Rows whose{' '}
          <code>publicId</code> already exists are skipped rather than duplicated.
        </Note>

        <div className="mt-3">
          <Textarea
            label="CSV content"
            value={csv}
            onChange={setCsv}
            rows={12}
            mono
            placeholder="body,topicSlug,difficulty,optionA,optionB,optionC,optionD,correct,explanation"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void run.mutate(true)} disabled={run.pending || !csv.trim()}>
            {run.pending ? 'Validating…' : 'Validate (dry run)'}
          </Button>
          <Button onClick={() => void run.mutate(false)} disabled={run.pending || !csv.trim()}>
            Import for real
          </Button>
        </div>

        {run.error ? <div className="mt-3"><ErrorNote message={run.error} /></div> : null}
      </Card>

      {result ? (
        <Card>
          <SectionHeading
            level={3}
            title={result.dryRun ? 'Dry-run result (nothing saved)' : 'Import complete'}
            subtitle={`${result.totalRows} row(s) processed.`}
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-semibold ink">{result.report.inserted}</div>
              <div className="text-xs ink-muted">{result.dryRun ? 'Would import' : 'Imported'}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-semibold ink">{result.report.skipped}</div>
              <div className="text-xs ink-muted">Skipped (duplicate QID)</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-semibold ink">{result.report.errors.length}</div>
              <div className="text-xs ink-muted">Rows with errors</div>
            </div>
          </div>

          {result.report.errors.length > 0 ? (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide ink-muted">Row errors</h4>
              <ul className="max-h-64 space-y-1 overflow-y-auto scroll-thin text-xs">
                {result.report.errors.map((issue, index) => (
                  <li key={index} className="rounded p-2" style={{ background: 'color-mix(in srgb, var(--critical) 8%, transparent)', color: 'var(--critical-text)' }}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
