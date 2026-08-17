# Data visualisation

Every chart in PlacePrep is built to one method, so the dashboards read as a
single system rather than a pile of libraries. This file records the decisions
so future charts stay consistent.

## Palette

Chart colours come from a validated palette, checked with a colour-blindness and
contrast validator against **the actual surfaces this app renders on**
(`#ffffff` light, `#151a23` dark) rather than a generic white/black.

| Slot | Light | Dark | Used for |
|---|---|---|---|
| Series 1 | `#2a78d6` | `#3987e5` | First categorical series |
| Series 2 | `#eb6834` | `#d95926` | Second categorical series |
| Series 3 | `#1baf7a` | `#199e70` | Third categorical series |

Validator results for these three slots, all-pairs:

| Check | Light | Dark |
|---|---|---|
| Lightness band | pass | pass |
| Chroma floor | pass | pass |
| CVD separation (ΔE ≥ 8) | 9.2 | 9.4 |
| Normal-vision floor (ΔE ≥ 15) | 24.0 | 20.9 |
| Contrast vs surface (≥ 3:1) | series 3 at 2.82 — **relief applied** | pass |

Light-mode series 3 sits just under 3:1, which obliges *relief*: every chart
ships direct value labels and a collapsible table view. Both are implemented in
`ChartFrame`/`TableView`, so the relief is structural rather than per-chart
discipline.

**Magnitude charts do not use the categorical slots at all.** Topic mastery,
subject strength and cohort weakness are magnitudes, so they use a single blue
ramp where darker means higher (`rampFor`). Colour restates the value instead of
encoding identity, which sidesteps the categorical series cap entirely and is the
correct form for the data.

## Form selection

| Data's job | Form | Component |
|---|---|---|
| Ranked magnitude | Horizontal bars, one hue | `MagnitudeBars` |
| Change over time | Line, ≤ 3 series | `TrendLine` |
| Volume over time | Area, 10% wash | `ActivityArea` |
| Two comparable measures across buckets | Grouped columns | `GroupedColumns` |
| Profile shape across comparable axes | Radar, single series | `ProfileRadar` |
| Parts of a whole | Segmented strip | `SegmentBar` |
| A single headline number | Figure, not a chart | `HeroScore`, `Stat` |
| Context inside a stat tile | Sparkline | `Sparkline` |

## Mark specs

- Bars capped at 18–24px with a 4px rounded data-end, square at the baseline
- Lines 2px with round joins; markers r=4 with a 2px surface ring
- Area fills ~10–18% opacity, never a saturated block
- Gridlines hairline, solid, one step off the surface; axes recessive
- A 2px surface gap separates touching marks

## Rules the components enforce

- **A legend whenever two or more series share a plot**, so identity never rests
  on colour matching alone. A single-series chart gets no legend box — the title
  already names what is plotted.
- **Labels are selective.** Endpoint on lines, tip on bars, cap on columns. Never
  a number on every point.
- **Text never wears the data colour.** Values, labels and axis text use ink
  tokens; a coloured mark beside the text carries identity.
- **No dual axes, ever.** Two measures of different scale get two charts.
- **Status colours are reserved** (good / warning / serious / critical) and always
  ship with an icon and a text label — `BandBadge` renders ▲/◆/▼ plus the word,
  so a weak score is never communicated by red alone.
- **Every chart offers a table view**, which doubles as the screen-reader path.

## Dark mode

Dark is a selected palette, not an inverted one: the steps were chosen for the
dark surface and validated against it. Tokens are declared three times — bare
`:root` for light, `prefers-color-scheme: dark` guarded with
`:root:not([data-theme='light'])` for OS preference, and `:root[data-theme='dark']`
for the explicit toggle — so the in-app control wins in both directions.
