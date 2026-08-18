/**
 * Coarse sector buckets for the company directory's filter.
 *
 * Companies carry a free-text `industry` label ("Automotive & Farm Equipment",
 * "Asset Management Technology") which reads well on a card but makes a useless
 * dropdown — there are nearly as many distinct labels as there are companies.
 * This maps each label onto one of a dozen buckets by keyword.
 */
export type Sector =
  | 'IT Services & Consulting'
  | 'Software Products'
  | 'Internet & E-commerce'
  | 'Semiconductors & Hardware'
  | 'Banking & Financial Services'
  | 'Analytics & Data Science'
  | 'Automotive & Mobility'
  | 'Manufacturing & Engineering'
  | 'Energy & Infrastructure'
  | 'Telecom & Networking'
  | 'Healthcare & Pharma'
  | 'Other';

/**
 * Ordered rules — the first pattern that matches wins, so the ordering is the
 * whole design. Three groups, in order:
 *
 *   1. Unambiguous domain words (consulting, semiconductor, pharma, telecom…).
 *   2. Disambiguators for labels that combine a domain with a delivery model,
 *      where the naive keyword would pick the wrong half: "Investment Platform"
 *      is finance not software, "Banking Software" is software not banking,
 *      "Software Engineering Services" is services not software.
 *   3. Broad fallbacks, ending with a catch-all for anything still unmatched
 *      that calls itself a service or a technology business.
 */
const RULES: Array<[RegExp, Sector]> = [
  // ── 1. unambiguous domains ──
  [/consulting|it services|outsourc|\bbpo\b|system integrat/i, 'IT Services & Consulting'],
  [/analytics|data science|market research|business intelligence/i, 'Analytics & Data Science'],
  [/semiconductor|\bchip\b|\beda\b|electronic design|hardware|\bstorage\b|imaging|consumer electronics/i, 'Semiconductors & Hardware'],
  [/telecom|communications|\bnetwork/i, 'Telecom & Networking'],
  [/pharma|healthcare|\bhealth\b|biotech|medical|life sciences|diagnostics/i, 'Healthcare & Pharma'],
  [/automotive|mobility|automobile|vehicle|two-wheeler|farm equipment|tyres|connected car/i, 'Automotive & Mobility'],

  // ── 2. disambiguators ──
  [/investment|wealth|mutual fund|stock brok/i, 'Banking & Financial Services'],
  [/\b(software|platform)$/i, 'Software Products'],
  [/bank|fintech|payment|insurance|financial|capital market|asset management|trading|lending|brok|\bfinance\b/i, 'Banking & Financial Services'],
  [/(software|engineering|technolog\w+|product|digital|design|professional|managed|r&d)[^,]*\bservices\b/i, 'IT Services & Consulting'],

  // ── 3. broad fallbacks ──
  [
    /e-?commerce|marketplace|food delivery|travel|hospitality|retail|classifieds|social|streaming|gaming|sports|edtech|education|logistics|supply chain/i,
    'Internet & E-commerce',
  ],
  [/software|\bsaas\b|cloud|platform|developer|collaboration|cyber ?security|database|\bcrm\b|\berp\b|enterprise/i, 'Software Products'],
  [/energy|power|\boil\b|\bgas\b|refin|renewable|infrastructure|construction|cement|steel|metals|mining/i, 'Energy & Infrastructure'],
  [
    /manufactur|engineering|aerospace|defen[cs]e|industrial|automation|chemical|paints|coatings|electrical|\bfmcg\b|consumer (goods|products)|conglomerate|textile/i,
    'Manufacturing & Engineering',
  ],
  [/services|technolog/i, 'IT Services & Consulting'],
];

/** Buckets a free-text industry label. Unknown labels fall through to 'Other'. */
export function sectorFor(industry: string | null | undefined): Sector {
  if (!industry) return 'Other';
  for (const [pattern, sector] of RULES) {
    if (pattern.test(industry)) return sector;
  }
  return 'Other';
}
