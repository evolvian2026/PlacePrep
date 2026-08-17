import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useApi, useMutation } from '../lib/hooks';
import { Button, Card, ErrorNote, Input, Note, Select, Spinner } from '../components/ui';

interface Meta {
  platformName: string;
  counts: { companies: number; questions: number; mocks: number; topics: number };
  disclaimer: string;
}

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const location = useLocation();
  const { data: meta } = useApi<Meta>('/meta');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('student@placeprep.dev');
  const [password, setPassword] = useState('Passw0rd!');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('2026');

  const submit = useMutation(async () => {
    if (mode === 'login') await login(email, password);
    else
      await register({
        name,
        email,
        password,
        college: college || undefined,
        branch: branch || undefined,
        graduationYear: Number(year) || undefined,
      });
  });

  if (loading) return <Spinner label="Checking your session…" />;
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Pitch ── */}
        <div className="hidden flex-col justify-center lg:flex">
          <div className="mb-5 flex items-center gap-2.5">
            <span
              className="flex size-10 items-center justify-center rounded-xl text-base font-bold text-white"
              style={{ background: 'var(--brand)' }}
              aria-hidden="true"
            >
              PP
            </span>
            <span className="text-xl font-semibold ink">PlacePrep</span>
          </div>

          <h1 className="text-3xl font-semibold leading-tight ink">
            Prepare for the company you actually want.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed ink-2">
            Pick a target company and get its full hiring process, a round-by-round roadmap, topic practice,
            realistic mock tests, and a preparation plan that rewrites itself as your scores change.
          </p>

          <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-medium">
            {['Prepare', 'Practice', 'Mock test', 'Analyse', 'Improve'].map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span
                  className="rounded-md px-2.5 py-1"
                  style={{ background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
                >
                  {step}
                </span>
                {index < 4 ? (
                  <span aria-hidden="true" className="ink-muted">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          {meta ? (
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t pt-5" style={{ borderColor: 'var(--hairline)' }}>
              {[
                { label: 'Companies', value: meta.counts.companies },
                { label: 'Questions', value: meta.counts.questions },
                { label: 'Mock tests', value: meta.counts.mocks },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="text-xl font-semibold ink">{stat.value}</dd>
                  <dt className="text-xs ink-muted">{stat.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/* ── Form ── */}
        <Card className="self-center">
          <div className="mb-4 flex gap-1 rounded-lg p-1" style={{ background: 'var(--surface-2)' }}>
            {(['login', 'register'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                style={
                  mode === option
                    ? { background: 'var(--surface)', color: 'var(--ink)' }
                    : { color: 'var(--ink-2)' }
                }
              >
                {option === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit.mutate(undefined);
            }}
          >
            {mode === 'register' ? (
              <Input label="Full name" value={name} onChange={setName} required placeholder="Aarav Sharma" />
            ) : null}

            <Input label="Email" type="email" value={email} onChange={setEmail} required placeholder="you@college.edu" />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            />

            {mode === 'register' ? (
              <>
                <Input label="College" value={college} onChange={setCollege} placeholder="Your institute" />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Branch"
                    value={branch}
                    onChange={setBranch}
                    options={['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                  <Select
                    label="Graduating in"
                    value={year}
                    onChange={setYear}
                    options={['2026', '2027', '2028', '2029'].map((value) => ({ value, label: value }))}
                  />
                </div>
              </>
            ) : null}

            {submit.error ? <ErrorNote message={submit.error} /> : null}

            <Button type="submit" full size="lg" disabled={submit.pending}>
              {submit.pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {mode === 'login' ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium ink-2">Demo accounts (password Passw0rd!)</p>
              <div className="grid gap-1.5">
                {[
                  { email: 'student@placeprep.dev', role: 'Student' },
                  { email: 'admin@placeprep.dev', role: 'Super admin' },
                  { email: 'faculty@placeprep.dev', role: 'Faculty' },
                ].map((account) => (
                  <button
                    key={account.email}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('Passw0rd!');
                    }}
                    className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs hover:opacity-70"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <span className="ink">{account.email}</span>
                    <span className="ink-muted">{account.role}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {meta?.disclaimer ? (
            <div className="mt-4">
              <Note>{meta.disclaimer}</Note>
            </div>
          ) : null}

          <p className="mt-3 text-center text-xs ink-muted">
            <Link to="/" className="underline decoration-dotted underline-offset-2">
              Continue as a returning user
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
