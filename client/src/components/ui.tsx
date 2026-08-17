import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { BAND_LABEL, bandOf } from '../lib/format';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ─────────────────────────── surfaces ───────────────────────────

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cx('card', padded && 'p-5', className)}>{children}</div>;
}

export function SectionHeading({
  title,
  subtitle,
  action,
  level = 2,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Tag = (`h${level}` as unknown) as 'h2';
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <Tag
          className={cx(
            'font-semibold ink',
            level === 1 ? 'text-2xl sm:text-3xl' : level === 2 ? 'text-lg' : 'text-base',
          )}
        >
          {title}
        </Tag>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────── controls ───────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'ink border',
  ghost: 'ink-2',
  danger: 'text-white',
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  className,
  title,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
  full?: boolean;
}) {
  const style: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--brand)' }
      : variant === 'danger'
        ? { background: 'var(--critical)' }
        : variant === 'secondary'
          ? { background: 'var(--surface)', borderColor: 'var(--hairline)' }
          : {};

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-opacity',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-3.5 py-2 text-sm',
        BUTTON_STYLES[variant],
        variant === 'ghost' && 'hover:opacity-70',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:opacity-90',
        full && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  required,
  min,
  max,
  step,
  disabled,
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium ink-2">{label}</span> : null}
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60"
      />
      {hint ? <span className="mt-1 block text-xs ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  mono,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium ink-2">{label}</span> : null}
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
        className={cx('w-full rounded-lg border px-3 py-2 text-sm outline-none', mono && 'font-mono text-xs')}
      />
      {hint ? <span className="mt-1 block text-xs ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium ink-2">{label}</span> : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-xs ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded"
        style={{ accentColor: 'var(--brand)' }}
      />
      {label}
    </label>
  );
}

// ─────────────────────────── indicators ───────────────────────────

/**
 * A status chip. `tone` maps onto the reserved status palette, and every tone
 * carries a text label — colour never carries the meaning alone.
 */
export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'good' | 'warning' | 'serious' | 'critical';
  icon?: string;
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
    brand: { bg: 'var(--brand-wash)', fg: 'var(--brand-strong)' },
    good: { bg: 'color-mix(in srgb, var(--good) 14%, transparent)', fg: 'var(--good-text)' },
    warning: { bg: 'color-mix(in srgb, var(--warning) 20%, transparent)', fg: 'var(--ink)' },
    serious: { bg: 'color-mix(in srgb, var(--serious) 20%, transparent)', fg: 'var(--ink)' },
    critical: { bg: 'color-mix(in srgb, var(--critical) 14%, transparent)', fg: 'var(--critical-text)' },
  };
  const colors = palette[tone];
  return (
    <span
      style={{ background: colors.bg, color: colors.fg }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

/** Score band chip — icon + label so it never relies on hue. */
export function BandBadge({ score }: { score: number }) {
  const band = bandOf(score);
  const tone = band === 'weak' ? 'critical' : band === 'average' ? 'warning' : 'good';
  const icon = band === 'weak' ? '▼' : band === 'average' ? '◆' : '▲';
  return (
    <Badge tone={tone} icon={icon}>
      {BAND_LABEL[band]}
    </Badge>
  );
}

/**
 * Meter. The fill carries severity; the track is a lighter step of the same
 * ramp so state reads across the whole bar. Always paired with a visible value.
 */
export function Meter({
  value,
  label,
  right,
  height = 8,
  severity = true,
}: {
  value: number;
  label?: ReactNode;
  right?: ReactNode;
  height?: number;
  severity?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const band = bandOf(clamped);
  const fill = !severity
    ? 'var(--brand)'
    : band === 'weak'
      ? 'var(--critical)'
      : band === 'average'
        ? 'var(--warning)'
        : 'var(--good)';

  return (
    <div>
      {label || right ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="ink-2">{label}</span>
          <span className="tabular font-medium ink">{right}</span>
        </div>
      ) : null}
      <div
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: 'var(--seq-track)', height }}
        className="w-full overflow-hidden rounded-full"
      >
        <div
          style={{ width: `${clamped}%`, background: fill, height }}
          className="rounded-full transition-[width] duration-500"
        />
      </div>
    </div>
  );
}

/** Stat tile: label · value · optional delta and footnote. */
export function Stat({
  label,
  value,
  delta,
  deltaGoodWhenUp = true,
  footnote,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaGoodWhenUp?: boolean;
  footnote?: ReactNode;
  accent?: boolean;
}) {
  const showDelta = delta !== undefined && delta !== null && Math.abs(delta) > 0.05;
  const positive = (delta ?? 0) > 0;
  const good = positive === deltaGoodWhenUp;

  return (
    <div className="card p-4">
      <div className="text-xs font-medium ink-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className="text-2xl font-semibold leading-none"
          style={accent ? { color: 'var(--brand)' } : { color: 'var(--ink)' }}
        >
          {value}
        </span>
        {showDelta ? (
          <span
            className="text-xs font-medium"
            style={{ color: good ? 'var(--good-text)' : 'var(--critical-text)' }}
          >
            {positive ? '▲' : '▼'} {Math.abs(delta ?? 0).toFixed(1)}
          </span>
        ) : null}
      </div>
      {footnote ? <div className="mt-1.5 text-xs ink-muted">{footnote}</div> : null}
    </div>
  );
}

/** The single hero number a view leads with. */
export function HeroScore({
  score,
  caption,
  outOf = 100,
}: {
  score: number;
  caption?: ReactNode;
  outOf?: number;
}) {
  const band = bandOf(score);
  const color =
    band === 'weak' ? 'var(--critical)' : band === 'average' ? 'var(--warning)' : 'var(--good)';
  const circumference = 2 * Math.PI * 52;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`Readiness ${score} out of ${outOf}`}>
          <circle cx="64" cy="64" r="52" fill="none" stroke="var(--seq-track)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r="52"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 64 64)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold leading-none ink">{Math.round(score)}</span>
          <span className="mt-0.5 text-[11px] ink-muted">/ {outOf}</span>
        </div>
      </div>
      <div className="min-w-0">
        <BandBadge score={score} />
        {caption ? <div className="mt-2 text-sm ink-2">{caption}</div> : null}
      </div>
    </div>
  );
}

// ─────────────────────────── layout helpers ───────────────────────────

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto scroll-thin border-b"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className="relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: selected ? 'var(--brand)' : 'var(--ink-2)' }}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="ml-1.5 text-xs ink-muted tabular">{tab.count}</span> : null}
            {selected ? (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                style={{ background: 'var(--brand)' }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('card my-8 w-full', wide ? 'max-w-4xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--hairline)' }}>
          <h2 className="text-base font-semibold ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md px-2 text-lg ink-muted hover:opacity-70">
            ×
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto scroll-thin p-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: 'var(--hairline)' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm ink-muted">
      <span
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-4 text-sm"
      style={{ background: 'color-mix(in srgb, var(--critical) 10%, transparent)', color: 'var(--critical-text)' }}
      role="alert"
    >
      <span>
        <span aria-hidden="true">⚠ </span>
        {message}
      </span>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm font-medium ink">{title}</p>
      {hint ? <p className="max-w-md text-sm ink-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Simple data table with a hairline grid and tabular figures. */
export function Table<T>({
  columns,
  rows,
  keyOf,
  empty = 'Nothing to show yet.',
  onRowClick,
}: {
  columns: { key: string; header: ReactNode; render: (row: T) => ReactNode; align?: 'left' | 'right' | 'center'; width?: string }[];
  rows: T[];
  keyOf: (row: T, index: number) => string | number;
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) return <Empty title={empty} />;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--hairline)' }}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className={cx(
                  'px-3 py-2 text-xs font-medium ink-muted',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={keyOf(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx('border-b last:border-0', onRowClick && 'cursor-pointer hover:opacity-80')}
              style={{ borderColor: 'var(--hairline)' }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    'px-3 py-2.5 ink',
                    column.align === 'right' ? 'text-right tabular' : column.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Collapsible table view for a chart. The data-viz relief rule requires an
 * accessible table wherever a series colour is below 3:1 on the surface, and it
 * is useful everywhere else too.
 */
export function TableView({ children, label = 'View as table' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-medium underline decoration-dotted underline-offset-2 ink-muted hover:opacity-70"
        aria-expanded={open}
      >
        {open ? 'Hide table' : label}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: 'var(--brand-wash)', color: 'var(--brand-strong)' }}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {initials}
    </span>
  );
}

export function CompanyLogo({
  name,
  logoText,
  brandColor,
  size = 40,
}: {
  name: string;
  logoText?: string | null;
  brandColor?: string | null;
  size?: number;
}) {
  const text = (logoText ?? name.slice(0, 4)).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${brandColor ?? 'var(--brand)'} 16%, transparent)`,
        color: brandColor ?? 'var(--brand)',
        fontSize: text.length > 3 ? size * 0.26 : size * 0.32,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight"
    >
      {text}
    </span>
  );
}

/** Inline note used for provenance and data-quality disclosures. */
export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <p
      className="rounded-lg p-3 text-xs leading-relaxed"
      style={{
        background: tone === 'warning' ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'var(--surface-2)',
        color: 'var(--ink-2)',
      }}
    >
      {children}
    </p>
  );
}
