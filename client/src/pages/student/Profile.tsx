import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi, useMutation, useTheme } from '../../lib/hooks';
import { dateText } from '../../lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorNote,
  Input,
  Meter,
  SectionHeading,
  Select,
  Spinner,
  Stat,
} from '../../components/ui';

interface BadgeState {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

interface GamificationData {
  badges: BadgeState[];
  xp: number;
  level: number;
  progress: number;
  currentLevelXp: number;
  nextLevelXp: number;
  streak: { current: number; longest: number; activeToday: boolean };
  challenges: { slug: string; title: string; description: string; progress: number; goalCount: number; daysRemaining: number }[];
}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

export default function Profile() {
  const { user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data, loading, error, reload } = useApi<GamificationData>('/gamification/badges');

  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setCollege(user.college ?? '');
    setBranch(user.branch ?? '');
    setYear(user.graduationYear ? String(user.graduationYear) : '');
    setCgpa(user.cgpa !== null ? String(user.cgpa) : '');
    setPhone(user.phone ?? '');
  }, [user]);

  const saveProfile = useMutation(async () => {
    await api('/auth/me', {
      method: 'PATCH',
      body: {
        name,
        college: college || null,
        branch: branch || null,
        graduationYear: year ? Number(year) : null,
        cgpa: cgpa ? Number(cgpa) : null,
        phone: phone || null,
      },
    });
    await refresh();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  });

  const changePassword = useMutation(async () => {
    await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    setCurrentPassword('');
    setNewPassword('');
    setPasswordDone(true);
    window.setTimeout(() => setPasswordDone(false), 2500);
  });

  if (!user) return <Spinner />;

  const earned = data?.badges.filter((badge) => badge.earned) ?? [];
  const locked = data?.badges.filter((badge) => !badge.earned) ?? [];

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title="Profile" subtitle="Your details, achievements and app preferences." />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold ink">{user.name}</h2>
              <Badge tone="brand">{user.role.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm ink-muted">{user.email}</p>
            <p className="text-xs ink-muted">Joined {dateText(user.createdAt)}</p>
          </div>
          {data ? (
            <div className="w-full sm:w-56">
              <Meter
                value={data.progress}
                label={`Level ${data.level}`}
                right={`${data.currentLevelXp}/${data.nextLevelXp} XP`}
                severity={false}
              />
            </div>
          ) : null}
        </div>
      </Card>

      {data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total XP" value={data.xp.toLocaleString()} accent />
          <Stat label="Level" value={data.level} />
          <Stat label="Current streak" value={`${data.streak.current} days`} footnote={data.streak.activeToday ? 'Active today ✓' : 'Not active today'} />
          <Stat label="Badges earned" value={`${earned.length}/${data.badges.length}`} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading level={3} title="Your details" />
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile.mutate(undefined);
            }}
          >
            <Input label="Full name" value={name} onChange={setName} required />
            <Input label="College" value={college} onChange={setCollege} />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Branch"
                value={branch}
                onChange={setBranch}
                options={[
                  { value: '', label: 'Not set' },
                  ...['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'].map((value) => ({ value, label: value })),
                ]}
              />
              <Input label="Graduation year" type="number" value={year} onChange={setYear} min={2000} max={2100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="CGPA" type="number" value={cgpa} onChange={setCgpa} min={0} max={10} step={0.01} />
              <Input label="Phone" value={phone} onChange={setPhone} />
            </div>
            {saveProfile.error ? <ErrorNote message={saveProfile.error} /> : null}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saveProfile.pending}>
                {saveProfile.pending ? 'Saving…' : 'Save changes'}
              </Button>
              {saved ? <span className="text-xs" style={{ color: 'var(--good-text)' }}>Saved ✓</span> : null}
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading level={3} title="Change password" />
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void changePassword.mutate(undefined);
              }}
            >
              <Input label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} required />
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                required
                hint="At least 8 characters."
              />
              {changePassword.error ? <ErrorNote message={changePassword.error} /> : null}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="secondary" disabled={changePassword.pending}>
                  {changePassword.pending ? 'Updating…' : 'Update password'}
                </Button>
                {passwordDone ? <span className="text-xs" style={{ color: 'var(--good-text)' }}>Password changed ✓</span> : null}
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeading level={3} title="Appearance" />
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm capitalize"
                  style={
                    theme === option
                      ? { background: 'var(--brand-wash)', color: 'var(--brand-strong)', borderColor: 'var(--brand)' }
                      : { borderColor: 'var(--hairline)', color: 'var(--ink-2)' }
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data ? (
        <Card>
          <SectionHeading
            level={3}
            title="Achievements"
            subtitle={`${earned.length} of ${data.badges.length} badges earned.`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...earned, ...locked]
              .sort((a, b) => {
                if (a.earned !== b.earned) return a.earned ? -1 : 1;
                return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
              })
              .map((badge) => (
                <div
                  key={badge.slug}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  style={{
                    borderColor: badge.earned ? 'var(--brand)' : 'var(--hairline)',
                    background: badge.earned ? 'var(--brand-wash)' : 'transparent',
                    opacity: badge.earned ? 1 : 0.6,
                  }}
                >
                  <span aria-hidden="true" className="text-2xl">
                    {badge.earned ? badge.icon : '🔒'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium ink">{badge.name}</span>
                      <Badge>{badge.tier}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs ink-2">{badge.description}</p>
                    <p className="mt-1 text-[11px] ink-muted">
                      {badge.earned ? `Earned ${dateText(badge.earnedAt)}` : `+${badge.xpReward} XP when earned`}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
