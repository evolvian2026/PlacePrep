/** Display helpers shared across pages. */

export function pctText(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function clockText(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function durationText(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(totalSeconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function dateText(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTimeText(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** SQLite stores UTC as `YYYY-MM-DD HH:MM:SS`; give JS the timezone it needs. */
export function parseServerTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  moderate: 'Moderate',
  very_hard: 'Very hard',
};

export const ROUND_TYPE_LABEL: Record<string, string> = {
  aptitude: 'Aptitude',
  coding: 'Coding',
  technical_mcq: 'Technical MCQ',
  technical_interview: 'Technical interview',
  system_design: 'System design',
  group_discussion: 'Group discussion',
  hr_interview: 'HR interview',
  managerial: 'Managerial',
  psychometric: 'Psychometric',
  other: 'Other',
};

export const CATEGORY_LABEL: Record<string, string> = {
  aptitude: 'Aptitude',
  reasoning: 'Reasoning',
  verbal: 'Verbal',
  dsa: 'Coding / DSA',
  cs_fundamentals: 'CS fundamentals',
  programming: 'Programming',
  database: 'DBMS & SQL',
  system_design: 'System design',
  behavioural: 'HR & behavioural',
  other: 'Other',
};

export const SCOPE_LABEL: Record<string, string> = {
  quick: 'Quick mock',
  sectional: 'Sectional',
  round: 'Round mock',
  company: 'Full company mock',
};

export const PROVENANCE_LABEL: Record<string, string> = {
  verified: 'Verified',
  community_reported: 'Community-reported',
  historical: 'Historical',
};

export const LANGUAGE_LABEL: Record<string, string> = {
  python: 'Python 3',
  javascript: 'JavaScript',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

export const VERDICT_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  compile_error: 'Compilation error',
  runtime_error: 'Runtime error',
  time_limit_exceeded: 'Time limit exceeded',
  partial: 'Partially correct',
  unsupported_language: 'Language unavailable',
  internal_error: 'Evaluation error',
};

/** Maps a 0–100 score onto the status vocabulary used across the UI. */
export function bandOf(score: number): 'weak' | 'average' | 'strong' | 'excellent' {
  if (score < 50) return 'weak';
  if (score < 70) return 'average';
  if (score < 85) return 'strong';
  return 'excellent';
}

export const BAND_LABEL: Record<string, string> = {
  weak: 'Weak',
  average: 'Average',
  strong: 'Strong',
  excellent: 'Excellent',
};
