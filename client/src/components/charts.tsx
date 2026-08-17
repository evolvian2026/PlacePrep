/**
 * Chart primitives.
 *
 * Built to the data-viz method (see docs/DATAVIZ.md):
 *   • form follows the data's job — magnitude uses one sequential hue, identity
 *     uses the validated categorical slots, a single headline uses a figure
 *   • categorical slots 1–3 only; those three clear the all-pairs CVD ΔE ≥ 8 and
 *     normal-vision ΔE ≥ 15 floors in both light and dark modes
 *   • bars ≤ 24px with a 4px rounded data-end and a 2px surface gap
 *   • lines 2px, markers ≥ 8px, area fills ~10% opacity
 *   • hairline solid gridlines, recessive axes, text in ink tokens only
 *   • a legend whenever there are ≥ 2 series, plus selective direct labels
 *   • every chart offers a table view — required relief for light-mode aqua at
 *     2.82:1, and good practice throughout
 */
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table, TableView, cx } from './ui';

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'] as const;

/** Ordinal steps of the single blue ramp — light mode starts at step 250. */
const ORDINAL = ['var(--seq-250)', 'var(--seq-350)', 'var(--seq-450)', 'var(--seq-550)', 'var(--seq-650)'];

/** Maps a 0–100 magnitude onto the ordinal ramp: darker = higher. */
export function rampFor(value: number): string {
  if (value < 20) return ORDINAL[0];
  if (value < 40) return ORDINAL[1];
  if (value < 60) return ORDINAL[2];
  if (value < 80) return ORDINAL[3];
  return ORDINAL[4];
}

const AXIS = { stroke: 'var(--baseline)', tick: { fill: 'var(--ink-muted)', fontSize: 11 } };

function ChartTooltip({
  active,
  payload,
  label,
  unit = '',
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
    >
      {label !== undefined ? <div className="mb-1 font-medium">{label}</div> : null}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: entry.color ?? 'var(--brand)' }}
          />
          <span className="ink-2">{entry.name}</span>
          <span className="ml-auto tabular font-medium">
            {typeof entry.value === 'number' ? Math.round(entry.value * 10) / 10 : entry.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function LegendRow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs ink-2">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  children,
  legend,
  table,
  height = 240,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  legend?: { label: string; color: string }[];
  table?: ReactNode;
  height?: number;
  action?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs ink-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {/* A legend is present whenever two or more series share the plot. */}
      {legend && legend.length > 1 ? <LegendRow items={legend} /> : null}
      <div style={{ height }}>{children}</div>
      {table ? <TableView>{table}</TableView> : null}
    </div>
  );
}

// ───────────────────────── magnitude: horizontal bars ─────────────────────────

export interface MagnitudeDatum {
  name: string;
  value: number;
  meta?: string;
}

/**
 * Horizontal bars for a ranked magnitude (topic mastery, category strength).
 * One sequential hue — colour restates the value rather than encoding identity,
 * so there is no categorical cap and no legend.
 */
export function MagnitudeBars({
  title,
  subtitle,
  data,
  unit = '%',
  height,
  valueLabel = 'Score',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: MagnitudeDatum[];
  unit?: string;
  height?: number;
  valueLabel?: string;
}) {
  const computed = height ?? Math.max(140, data.length * 34 + 24);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={computed}
      table={
        <Table
          columns={[
            { key: 'name', header: 'Item', render: (row: MagnitudeDatum) => row.name },
            { key: 'value', header: valueLabel, align: 'right', render: (row) => `${row.value}${unit}` },
          ]}
          rows={data}
          keyOf={(row) => row.name}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--hairline)" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            axisLine={false}
            tickLine={false}
            tick={AXIS.tick}
            interval={0}
          />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'var(--surface-2)' }} />
          {/* 4px rounded data-end, square at the baseline; capped thickness. */}
          <Bar dataKey="value" name={valueLabel} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={rampFor(entry.value)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              formatter={(value: number) => `${Math.round(value)}${unit}`}
              style={{ fill: 'var(--ink-2)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ───────────────────────── change over time: line ─────────────────────────

export interface TrendPoint {
  label: string;
  [key: string]: string | number;
}

/**
 * Line chart for change over time. Up to three series from the validated slots;
 * a legend is always shown for two or more, and only the final point is labelled.
 */
export function TrendLine({
  title,
  subtitle,
  data,
  series,
  unit = '%',
  height = 260,
  domain = [0, 100],
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: TrendPoint[];
  series: { key: string; label: string }[];
  unit?: string;
  height?: number;
  domain?: [number, number];
}) {
  const legend = series.map((entry, index) => ({ label: entry.label, color: SERIES[index % SERIES.length] }));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      legend={legend}
      table={
        <Table
          columns={[
            { key: 'label', header: 'Point', render: (row: TrendPoint) => String(row.label) },
            ...series.map((entry) => ({
              key: entry.key,
              header: entry.label,
              align: 'right' as const,
              render: (row: TrendPoint) => `${row[entry.key] ?? '—'}${unit}`,
            })),
          ]}
          rows={data}
          keyOf={(_row, index) => index}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 40, bottom: 4, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="label" axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} tick={AXIS.tick} />
          <YAxis domain={domain} axisLine={false} tickLine={false} tick={AXIS.tick} width={44} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }} />
          {series.map((entry, index) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={SERIES[index % SERIES.length]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              // Markers ≥ 8px with a 2px surface ring so crossings stay legible.
              dot={{ r: 4, fill: SERIES[index % SERIES.length], stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            >
              {index === 0 ? (
                <LabelList
                  dataKey={entry.key}
                  position="top"
                  offset={10}
                  formatter={(value: number, _entry?: unknown, dataIndex?: number) =>
                    dataIndex === data.length - 1 ? `${Math.round(value)}${unit}` : ''
                  }
                  style={{ fill: 'var(--ink-2)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                />
              ) : null}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ActivityArea({
  title,
  subtitle,
  data,
  height = 180,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      table={
        <Table
          columns={[
            { key: 'label', header: 'Day', render: (row: { label: string; value: number }) => row.label },
            { key: 'value', header: 'Questions', align: 'right', render: (row) => String(row.value) },
          ]}
          rows={data}
          keyOf={(row) => row.label}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
          <defs>
            <linearGradient id="pp-activity" x1="0" y1="0" x2="0" y2="1">
              {/* ~10% wash, never a saturated block. */}
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="label" axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} tick={AXIS.tick} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS.tick} width={40} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            name="Questions"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#pp-activity)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ───────────────────────── grouped comparison ─────────────────────────

/**
 * Grouped columns for two comparable measures across a few buckets
 * (e.g. solved vs available per difficulty). Two categorical slots, legend
 * present, values labelled on the caps, 2px surface gap between neighbours.
 */
export function GroupedColumns({
  title,
  subtitle,
  data,
  series,
  height = 240,
  unit = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: { label: string; [key: string]: string | number }[];
  series: { key: string; label: string }[];
  height?: number;
  unit?: string;
}) {
  const legend = series.map((entry, index) => ({ label: entry.label, color: SERIES[index % SERIES.length] }));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      legend={legend}
      table={
        <Table
          columns={[
            { key: 'label', header: 'Bucket', render: (row: { label: string }) => row.label },
            ...series.map((entry) => ({
              key: entry.key,
              header: entry.label,
              align: 'right' as const,
              render: (row: Record<string, string | number>) => `${row[entry.key] ?? 0}${unit}`,
            })),
          ]}
          rows={data}
          keyOf={(row) => row.label}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 4, left: -20 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="label" axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} tick={AXIS.tick} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS.tick} width={40} allowDecimals={false} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'var(--surface-2)' }} />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              fill={SERIES[index % SERIES.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              <LabelList
                dataKey={entry.key}
                position="top"
                offset={6}
                formatter={(value: number) => (value > 0 ? `${value}${unit}` : '')}
                style={{ fill: 'var(--ink-2)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ───────────────────────── profile shape: radar ─────────────────────────

/**
 * Radar for a readiness *shape* across 4–8 comparable axes. One series only, so
 * no legend is needed; values are in the tooltip and the table view.
 */
export function ProfileRadar({
  title,
  subtitle,
  data,
  height = 280,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: { axis: string; value: number }[];
  height?: number;
}) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      table={
        <Table
          columns={[
            { key: 'axis', header: 'Area', render: (row: { axis: string; value: number }) => row.axis },
            { key: 'value', header: 'Mastery', align: 'right', render: (row) => `${row.value}%` },
          ]}
          rows={data}
          keyOf={(row) => row.axis}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--hairline)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--ink-muted)', fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<ChartTooltip unit="%" />} />
          <Radar
            name="Mastery"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="var(--series-1)"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ───────────────────────── sparkline ─────────────────────────

/** 12-point sparkline for a stat tile. No axes, no labels — context only. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="var(--seq-250)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(width - 4 + 2).toFixed(1)}
        cy={(height - 2 - ((values[values.length - 1] - min) / span) * (height - 4)).toFixed(1)}
        r="3"
        fill="var(--series-1)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Segmented progress strip — a compact alternative to a pie for parts of a
 * whole. Each segment is direct-labelled and separated by a 2px surface gap.
 */
export function SegmentBar({
  segments,
  height = 10,
  showLabels = true,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
  showLabels?: boolean;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full" style={{ height, gap: 2, background: 'var(--surface-2)' }}>
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              title={`${segment.label}: ${segment.value}`}
              style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
              className="first:rounded-l-full last:rounded-r-full"
            />
          ) : null,
        )}
      </div>
      {showLabels ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1.5 text-xs ink-2">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: segment.color }} />
              {segment.label}
              <span className="tabular font-medium ink">{segment.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { cx };
