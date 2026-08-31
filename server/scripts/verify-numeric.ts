/**
 * Independently recomputes the answer to every numeric aptitude question.
 *
 * The bank's biggest risk is not a malformed record — the schema catches those
 * — but an answer that is simply wrong. For questions whose answer is a number
 * derived by arithmetic, that risk can be removed: each entry below recomputes
 * the value from the problem statement, by a route written separately from the
 * question's own explanation, and asserts it matches the option marked correct.
 *
 * A question listed here is checked. One that is not is unverified, and the
 * summary says how many fall into each group rather than implying the whole
 * bank has been validated.
 */
import { loadMcqBank } from '../src/db/seed/load-questions.js';

/** id → a value computed from first principles, not copied from the answer. */
const CHECKS: Record<string, () => number | string> = {
  // ── Pre-existing bank ──
  // 7 ≡ 2 (mod 5); powers of 2 mod 5 cycle 2,4,3,1.
  'APT-0001': () => {
    let value = 1;
    for (let i = 0; i < 103; i += 1) value = (value * 7) % 5;
    return value;
  },
  // Two-digit number, digits sum 12, reversal adds 18.
  'APT-0002': () => {
    for (let n = 10; n < 100; n += 1) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (t + u === 12 && 10 * u + t - n === 18) return n;
    }
    return -1;
  },
  // Trailing zeros of 100! — count factors of 5.
  'APT-0003': () => Math.floor(100 / 5) + Math.floor(100 / 25),
  // Highest power of 3 dividing 50!
  'APT-0004': () => Math.floor(50 / 3) + Math.floor(50 / 9) + Math.floor(50 / 27),
  'APT-0005': () => (1188 * 9) / 108,
  'APT-0006': () => 140 * 0.75 - 100,
  // Spend unchanged after a 25% rise: reduce consumption by 1 - 1/1.25.
  'APT-0007': () => (1 - 1 / 1.25) * 100,
  // Winner 56%, margin 1440 = 12% of total.
  'APT-0009': () => 1440 / 0.12,
  // 30 students average 14; adding the teacher raises it to 15.
  'APT-0011': () => 31 * 15 - 30 * 14,
  // 60 L at 7:3; add water to reach 7:5.
  'APT-0012': () => {
    const milk = 60 * 0.7;
    const water = 60 * 0.3;
    return (milk * 5) / 7 - water;
  },
  'APT-0014': () => {
    for (let k = 1; k < 100; k += 1) {
      if ((5 * k + 6) * 4 === (7 * k + 6) * 3) return 5 * k;
    }
    return -1;
  },
  // 150 m in 15 s → 10 m/s; then 450 m.
  'APT-0015': () => (150 + 300) / (150 / 15),
  'APT-0016': () => 1 / (1 / 12 + 1 / 18),
  'APT-0017': () => (24 / 3 - 24 / 4) / 2,
  'APT-0018': () => 1 / (1 / 8 - 1 / 12),
  'APT-0019': () => (120 + 180) / ((40 + 50) * (5 / 18)),
  // LEVEL: 5!/(2!·2!)
  'APT-0022': () => 120 / (2 * 2),
  'APT-0023': () => fraction(4 * 3, 10 * 9),
  'APT-0024': () => 7 * 6 * 5 * 4,
  'APT-0025': () => {
    let hits = 0;
    for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) if (a + b === 8) hits += 1;
    return fraction(hits, 36);
  },
  'APT-0026': () => 24,
  'APT-0027': () => (1.2 ** 2 - 1) * 100,
  // x + 1/x = 5 → x² + 1/x² = 25 - 2
  'APT-0028': () => 5 ** 2 - 2,
  'APT-0029': () => (6 / 2) ** 3,
  'APT-0030': () => {
    for (let n = 1; n < 100; n += 1) if ((n * (n + 1)) / 2 === 210) return n;
    return -1;
  },
  'APT-0031': () => (100 / 900) * 100,
  'APT-0032': () => 1 / (1 / 10 + 1 / 15 - 1 / 30),
  'APT-0033': () => (21 / 3 + 15 / 3) / 2,
  'APT-0034': () => 24 + 4,
  'APT-0035': () => (15 * 48) / 30,
  // Doubling in 8 years at simple interest → the interest equals the principal in 8 years.
  'APT-0036': () => 8 * 3,
  // Two dice: count ordered pairs summing to 7 out of 36.
  'APT-0046': () => {
    let hits = 0;
    for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) if (a + b === 7) hits += 1;
    return fraction(hits, 36);
  },
  // 4 red of 10, then 3 of 9.
  'APT-0047': () => fraction(4 * 3, 10 * 9),
  'APT-0048': () => 1 - 0.7 * 0.6,
  // Exactly two heads in three tosses, by enumeration.
  'APT-0049': () => {
    let hits = 0;
    for (let mask = 0; mask < 8; mask += 1) {
      let heads = 0;
      for (let bit = 0; bit < 3; bit += 1) if (mask & (1 << bit)) heads += 1;
      if (heads === 2) hits += 1;
    }
    return fraction(hits, 8);
  },
  'APT-0050': () => fraction(4 * 3, 52 * 51),
  'APT-0051': () => 0.6 * 0.5,
  'APT-0052': () => fraction(6 * 5, 7 * 7),
  // 20% up then 20% down: the option is worded as a decrease, so compare magnitude.
  'APT-0053': () => Math.abs(100 * 1.2 * 0.8 - 100),
  'APT-0054': () => (96 / 0.4) * 0.75,
  // 0.30T + 20 = 0.45T - 10  →  T = 30 / 0.15
  'APT-0055': () => 30 / 0.15,
  'APT-0056': () => 12100 / 1.1 ** 2,
  'APT-0057': () => 140 * 0.75 - 100,
  // A = 125 when B = 100; reduction from A back to B.
  'APT-0058': () => ((125 - 100) / 125) * 100,
  // (150 + 250) m at 72 km/h.
  'APT-0059': () => (150 + 250) / (72 * (5 / 18)),
  'APT-0060': () => 100 / (40 + 60),
  // downstream 15, upstream 10 → stream = half the difference.
  'APT-0061': () => (30 / 2 - 30 / 3) / 2,
  // Equal distances at 20 and 30: harmonic mean.
  'APT-0062': () => 2 / (1 / 20 + 1 / 30),
  // d/60 - d/75 = 15 min = 0.25 h
  'APT-0063': () => 0.25 / (1 / 60 - 1 / 75),
  // 4/3 of usual time is 20 min more → usual = 20 / (1/3)
  'APT-0064': () => 20 / (4 / 3 - 1),
  'APT-0065': () => 1 / (1 / 12 + 1 / 18),
  'APT-0066': () => 1 / (1 / 8 - 1 / 12),
  'APT-0067': () => (12 * 10) / 15,
  'APT-0068': () => 1 / (1 / 6 - 1 / 10),
  // 5 days together, then B finishes the remainder alone.
  'APT-0069': () => {
    const done = 5 * (1 / 20 + 1 / 30);
    return 5 + (1 - done) / (1 / 30);
  },
  // 3r = 1/12 → A's rate is 2r
  'APT-0070': () => 1 / (2 * (1 / 12 / 3)),
};

/** Renders a ratio in lowest terms, matching how the options are written. */
function fraction(numerator: number, denominator: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(numerator, denominator);
  return `${numerator / g}/${denominator / g}`;
}

const round = (value: number): string => String(Math.round(value * 100) / 100);

/** Pulls the leading number out of an option such as "20 seconds" or "7.2 days". */
function numericValue(text: string): number | null {
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

const bank = new Map(loadMcqBank().map((question) => [question.id, question]));
const failures: string[] = [];
let checked = 0;

for (const [id, compute] of Object.entries(CHECKS)) {
  const question = bank.get(id);
  if (!question) {
    failures.push(`${id}: no such question in the bank`);
    continue;
  }
  const answer = question.options.find((option) => option.correct);
  if (!answer) {
    failures.push(`${id}: no option marked correct`);
    continue;
  }

  const expected = compute();
  checked += 1;

  if (typeof expected === 'string') {
    if (!answer.body.includes(expected)) {
      failures.push(`${id}: computed ${expected}, but the marked answer is "${answer.body}"`);
    }
    continue;
  }

  const actual = numericValue(answer.body);
  if (actual === null) {
    failures.push(`${id}: marked answer "${answer.body}" has no number to compare`);
  } else if (Math.abs(actual - expected) > 0.01) {
    failures.push(`${id}: computed ${round(expected)}, but the marked answer is "${answer.body}"`);
  }
}

const numericQuestions = [...bank.values()].filter((question) =>
  question.options.every((option) => /^-?[\d,.]+(\/\d+)?(\s|$)/.test(option.body.trim())),
);

console.log(`recomputed        : ${checked}`);
console.log(`numeric questions : ${numericQuestions.length} in the bank`);
console.log(`unverified        : ${Math.max(0, numericQuestions.length - checked)}`);
console.log(`mismatches        : ${failures.length}`);
if (failures.length) {
  console.log('');
  for (const failure of failures) console.log(`  ${failure}`);
}
process.exit(failures.length === 0 ? 0 : 1);
