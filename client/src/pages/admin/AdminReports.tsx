import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  Note,
  SectionHeading,
  Select,
  Spinner,
  Tabs,
} from '../../components/ui';

interface Report {
  id: number;
  company: string;
  companySlug: string;
  student: string | null;
  category: string;
  title: string;
  body: string;
  satOn: string | null;
  status: string;
  reviewerNote: string | null;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  hiring_process: 'Hiring process',
  coding_pattern: 'Coding round',
  technical_pattern: 'Technical interview',
  hr_pattern: 'HR interview',
  frequently_tested: 'What was tested',
  question_types: 'Question types',
  eligibility: 'Eligibility',
  preparation_advice: 'Preparation advice',
  general: 'General',
};

export default function AdminReports() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi<{ reports: Report[] }>('/admin/company-reports', { status });

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title="Student process reports"
        subtitle="First-hand accounts from students who sat a company's selection process."
      />

      <Note>
        This is how a templated roadmap becomes a researched one. Accepting a report publishes it as a company
        insight. Leave the provenance as <strong>community reported</strong> unless you have corroborated it
        yourself — one student's account is not company policy, and labelling it "verified" is the fastest way
        to make this platform untrustworthy.
      </Note>

      <Tabs
        tabs={[
          { id: 'pending', label: 'Awaiting review' },
          { id: 'accepted', label: 'Accepted' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: 'All' },
        ]}
        active={status}
        onChange={setStatus}
      />

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        data.reports.length === 0 ? (
          <Card>
            <Empty
              title="Nothing here"
              hint={status === 'pending' ? 'No reports are waiting for review.' : 'No reports with that status.'}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {data.reports.map((report) => (
              <ReportCard key={report.id} report={report} onReviewed={reload} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function ReportCard({ report, onReviewed }: { report: Report; onReviewed: () => void }) {
  const [provenance, setProvenance] = useState('community_reported');
  const [note, setNote] = useState('');
  const [sourceLabel, setSourceLabel] = useState('Student report');

  const review = useMutation(async (decision: 'accept' | 'reject') => {
    await api(`/admin/company-reports/${report.id}/review`, {
      method: 'POST',
      body: { decision, note: note || undefined, provenance, sourceLabel: sourceLabel || undefined },
    });
    onReviewed();
  });

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold ink">{report.company}</span>
        <Badge tone="neutral">{CATEGORY_LABEL[report.category] ?? report.category}</Badge>
        {report.satOn ? <Badge>Sat {report.satOn}</Badge> : null}
        <Badge
          tone={report.status === 'accepted' ? 'good' : report.status === 'rejected' ? 'serious' : 'warning'}
        >
          {report.status}
        </Badge>
        <span className="ml-auto text-xs ink-muted">
          {report.student ?? 'Deleted account'} · {report.createdAt.slice(0, 10)}
        </span>
      </div>

      <h3 className="text-sm font-semibold ink">{report.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed ink-2">{report.body}</p>

      {report.reviewerNote ? (
        <p className="mt-2 text-xs ink-muted">Reviewer note: {report.reviewerNote}</p>
      ) : null}

      {report.status === 'pending' ? (
        <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Publish as"
              value={provenance}
              onChange={setProvenance}
              options={[
                { value: 'community_reported', label: 'Community reported' },
                { value: 'historical', label: 'Historical' },
                { value: 'verified', label: 'Verified (corroborated)' },
              ]}
            />
            <Input label="Source label" value={sourceLabel} onChange={setSourceLabel} />
            <Input label="Note (optional)" value={note} onChange={setNote} placeholder="Why accepted or rejected" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void review.mutate('accept')} disabled={review.pending}>
              Accept and publish
            </Button>
            <Button variant="secondary" onClick={() => void review.mutate('reject')} disabled={review.pending}>
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
