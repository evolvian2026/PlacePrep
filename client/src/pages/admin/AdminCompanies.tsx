import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { DIFFICULTY_LABEL, PROVENANCE_LABEL } from '../../lib/format';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  CompanyLogo,
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

interface CompanyRow {
  id: number;
  slug: string;
  name: string;
  logo_text: string | null;
  brand_color: string | null;
  company_type: string;
  industry: string | null;
  description: string | null;
  difficulty: string;
  hiring_frequency: string | null;
  eligible_branches: string;
  eligible_years: string;
  min_cgpa: number | null;
  ctc_min_lpa: number | null;
  ctc_max_lpa: number | null;
  roles_offered: string;
  locations: string;
  expected_prep_weeks: number | null;
  is_published: number;
  round_count: number;
  mock_count: number;
  follower_count: number;
}

interface Insight {
  id: number;
  category: string;
  title: string;
  body: string;
  provenance: string;
  source_label: string | null;
  as_of: string | null;
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  logoText: '',
  brandColor: '#2563eb',
  companyType: 'service',
  industry: '',
  description: '',
  difficulty: 'moderate',
  hiringFrequency: '',
  eligibleBranches: 'CSE, IT, ECE',
  eligibleYears: '2026, 2027',
  minCgpa: '',
  ctcMinLpa: '',
  ctcMaxLpa: '',
  rolesOffered: '',
  locations: '',
  expectedPrepWeeks: '',
  isPublished: true,
};

type FormState = typeof EMPTY_FORM;

const splitList = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);

export default function AdminCompanies() {
  const { data, loading, error, reload } = useApi<{ companies: CompanyRow[] }>('/admin/companies');
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [insightsFor, setInsightsFor] = useState<CompanyRow | null>(null);

  const save = useMutation(async () => {
    const body = {
      name: form.name,
      slug: form.slug || undefined,
      logoText: form.logoText || null,
      brandColor: form.brandColor || null,
      companyType: form.companyType as 'service' | 'product',
      industry: form.industry || null,
      description: form.description || null,
      difficulty: form.difficulty as 'easy' | 'moderate' | 'hard' | 'very_hard',
      hiringFrequency: form.hiringFrequency || null,
      eligibleBranches: splitList(form.eligibleBranches),
      eligibleYears: splitList(form.eligibleYears).map(Number).filter(Number.isFinite),
      minCgpa: form.minCgpa ? Number(form.minCgpa) : null,
      ctcMinLpa: form.ctcMinLpa ? Number(form.ctcMinLpa) : null,
      ctcMaxLpa: form.ctcMaxLpa ? Number(form.ctcMaxLpa) : null,
      rolesOffered: splitList(form.rolesOffered),
      locations: splitList(form.locations),
      expectedPrepWeeks: form.expectedPrepWeeks ? Number(form.expectedPrepWeeks) : null,
      isPublished: form.isPublished,
    };

    if (editing) await api(`/admin/companies/${editing.id}`, { method: 'PATCH', body });
    else await api('/admin/companies', { method: 'POST', body });

    setEditing(null);
    setCreating(false);
    reload();
  });

  const remove = useMutation(async (company: CompanyRow) => {
    await api(`/admin/companies/${company.id}`, { method: 'DELETE' });
    reload();
  });

  const openEdit = (company: CompanyRow) => {
    setForm({
      name: company.name,
      slug: company.slug,
      logoText: company.logo_text ?? '',
      brandColor: company.brand_color ?? '#2563eb',
      companyType: company.company_type,
      industry: company.industry ?? '',
      description: company.description ?? '',
      difficulty: company.difficulty,
      hiringFrequency: company.hiring_frequency ?? '',
      eligibleBranches: (JSON.parse(company.eligible_branches || '[]') as string[]).join(', '),
      eligibleYears: (JSON.parse(company.eligible_years || '[]') as number[]).join(', '),
      minCgpa: company.min_cgpa !== null ? String(company.min_cgpa) : '',
      ctcMinLpa: company.ctc_min_lpa !== null ? String(company.ctc_min_lpa) : '',
      ctcMaxLpa: company.ctc_max_lpa !== null ? String(company.ctc_max_lpa) : '',
      rolesOffered: (JSON.parse(company.roles_offered || '[]') as string[]).join(', '),
      locations: (JSON.parse(company.locations || '[]') as string[]).join(', '),
      expectedPrepWeeks: company.expected_prep_weeks !== null ? String(company.expected_prep_weeks) : '',
      isPublished: company.is_published === 1,
    });
    setEditing(company);
  };

  const set = (key: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Companies"
        subtitle="The company catalogue is data, not code — add or edit any employer here and it appears for students immediately."
        action={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreating(true);
            }}
          >
            + Add company
          </Button>
        }
      />

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <Card>
          <Table
            rows={data.companies}
            keyOf={(row) => row.id}
            columns={[
              {
                key: 'name',
                header: 'Company',
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo name={row.name} logoText={row.logo_text} brandColor={row.brand_color} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{row.name}</span>
                        {row.is_published === 0 ? <Badge tone="warning">Unpublished</Badge> : null}
                      </div>
                      <div className="text-[11px] ink-muted">
                        {row.slug} · {row.industry}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (row) => (
                  <Badge tone={row.company_type === 'product' ? 'brand' : 'neutral'}>
                    {row.company_type === 'product' ? 'Product' : 'Service'}
                  </Badge>
                ),
              },
              { key: 'difficulty', header: 'Difficulty', render: (row) => DIFFICULTY_LABEL[row.difficulty] },
              { key: 'rounds', header: 'Rounds', align: 'right', render: (row) => String(row.round_count) },
              { key: 'mocks', header: 'Mocks', align: 'right', render: (row) => String(row.mock_count) },
              { key: 'followers', header: 'Students', align: 'right', render: (row) => String(row.follower_count) },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setInsightsFor(row)}>
                      Intel
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${row.name}? This removes its rounds, mock tests and every student attempt against them. This cannot be undone.`,
                          )
                        ) {
                          void remove.mutate(row);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          {remove.error ? <div className="mt-3"><ErrorNote message={remove.error} /></div> : null}
        </Card>
      ) : null}

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : 'Add a company'}
        wide
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void save.mutate(undefined)} disabled={save.pending || !form.name}>
              {save.pending ? 'Saving…' : editing ? 'Save changes' : 'Create company'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={set('name')} required />
          <Input label="Slug" value={form.slug} onChange={set('slug')} hint="Leave blank to derive from the name" />
          <Input label="Logo monogram" value={form.logoText} onChange={set('logoText')} hint="Up to 4 characters" />
          <Input label="Brand colour" type="color" value={form.brandColor} onChange={set('brandColor')} />
          <Select
            label="Type"
            value={form.companyType}
            onChange={set('companyType')}
            options={[
              { value: 'service', label: 'Service-based' },
              { value: 'product', label: 'Product-based' },
            ]}
          />
          <Select
            label="Difficulty"
            value={form.difficulty}
            onChange={set('difficulty')}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'hard', label: 'Hard' },
              { value: 'very_hard', label: 'Very hard' },
            ]}
          />
          <Input label="Industry" value={form.industry} onChange={set('industry')} />
          <Input label="Hiring frequency" value={form.hiringFrequency} onChange={set('hiringFrequency')} />
          <div className="sm:col-span-2">
            <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />
          </div>
          <Input
            label="Eligible branches"
            value={form.eligibleBranches}
            onChange={set('eligibleBranches')}
            hint="Comma separated"
          />
          <Input
            label="Eligible graduation years"
            value={form.eligibleYears}
            onChange={set('eligibleYears')}
            hint="Comma separated"
          />
          <Input label="Minimum CGPA" type="number" value={form.minCgpa} onChange={set('minCgpa')} min={0} max={10} step={0.1} />
          <Input label="Suggested prep (weeks)" type="number" value={form.expectedPrepWeeks} onChange={set('expectedPrepWeeks')} />
          <Input label="CTC min (LPA)" type="number" value={form.ctcMinLpa} onChange={set('ctcMinLpa')} step={0.1} />
          <Input label="CTC max (LPA)" type="number" value={form.ctcMaxLpa} onChange={set('ctcMaxLpa')} step={0.1} />
          <Input label="Roles offered" value={form.rolesOffered} onChange={set('rolesOffered')} hint="Comma separated" />
          <Input label="Locations" value={form.locations} onChange={set('locations')} hint="Comma separated" />
          <div className="sm:col-span-2">
            <Checkbox
              label="Published (visible to students)"
              checked={form.isPublished}
              onChange={(value) => setForm((current) => ({ ...current, isPublished: value }))}
            />
          </div>
          {save.error ? (
            <div className="sm:col-span-2">
              <ErrorNote message={save.error} />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Note>
              Eligibility and CTC are indicative figures shown to students as guidance. Record anything you have
              confirmed with the employer in the company intelligence panel and mark it “verified”.
            </Note>
          </div>
        </div>
      </Modal>

      {insightsFor ? <InsightsModal company={insightsFor} onClose={() => setInsightsFor(null)} /> : null}
    </div>
  );
}

const INSIGHT_CATEGORIES = [
  'hiring_process',
  'coding_pattern',
  'technical_pattern',
  'hr_pattern',
  'frequently_tested',
  'question_types',
  'eligibility',
  'preparation_advice',
  'general',
];

function InsightsModal({ company, onClose }: { company: CompanyRow; onClose: () => void }) {
  const { data, loading, reload } = useApi<{ insights: Insight[] }>(`/admin/companies/${company.id}/insights`);
  const [category, setCategory] = useState('hiring_process');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [provenance, setProvenance] = useState('community_reported');
  const [sourceLabel, setSourceLabel] = useState('');
  const [asOf, setAsOf] = useState('');

  const add = useMutation(async () => {
    await api(`/admin/companies/${company.id}/insights`, {
      method: 'POST',
      body: { category, title, body, provenance, sourceLabel: sourceLabel || null, asOf: asOf || null },
    });
    setTitle('');
    setBody('');
    setSourceLabel('');
    reload();
  });

  const remove = useMutation(async (id: number) => {
    await api(`/admin/insights/${id}`, { method: 'DELETE' });
    reload();
  });

  return (
    <Modal open onClose={onClose} title={`${company.name} — company intelligence`} wide>
      <div className="space-y-4">
        <Note tone="warning">
          Every note carries a provenance marker that students see. Use “verified” only for information you have
          confirmed with the employer or their official careers material — everything else is community-reported or
          historical.
        </Note>

        {loading ? <Spinner /> : null}

        <div className="space-y-2">
          {(data?.insights ?? []).map((insight) => (
            <div key={insight.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium ink">{insight.title}</span>
                  <Badge tone={insight.provenance === 'verified' ? 'good' : 'warning'}>
                    {PROVENANCE_LABEL[insight.provenance]}
                  </Badge>
                  <Badge>{insight.category.replace(/_/g, ' ')}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void remove.mutate(insight.id)}>
                  Delete
                </Button>
              </div>
              <p className="text-xs ink-2">{insight.body}</p>
              {insight.source_label ? (
                <p className="mt-1 text-[11px] ink-muted">
                  {insight.source_label}
                  {insight.as_of ? ` · ${insight.as_of}` : ''}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
          <h3 className="text-sm font-semibold ink">Add a note</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category"
              value={category}
              onChange={setCategory}
              options={INSIGHT_CATEGORIES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
            />
            <Select
              label="Provenance"
              value={provenance}
              onChange={setProvenance}
              options={[
                { value: 'verified', label: 'Verified' },
                { value: 'community_reported', label: 'Community-reported' },
                { value: 'historical', label: 'Historical' },
              ]}
            />
            <div className="sm:col-span-2">
              <Input label="Title" value={title} onChange={setTitle} />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Body" value={body} onChange={setBody} rows={3} />
            </div>
            <Input label="Source label" value={sourceLabel} onChange={setSourceLabel} placeholder="e.g. Careers page, 2025 drive" />
            <Input label="As of" value={asOf} onChange={setAsOf} placeholder="e.g. 2025 campus season" />
          </div>
          {add.error ? <ErrorNote message={add.error} /> : null}
          <Button onClick={() => void add.mutate(undefined)} disabled={add.pending || !title || !body}>
            {add.pending ? 'Adding…' : 'Add note'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
