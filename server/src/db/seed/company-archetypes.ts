import type { InsightSeed, RoundSeed } from './companies.js';

/**
 * Hiring-process archetypes.
 *
 * The first thirteen companies in `companies.ts` carry hand-written round
 * structures compiled from widely discussed campus-placement experience. That
 * does not scale: nobody can honestly hand-research the exact round structure of
 * a hundred employers, and inventing one per company would dress guesswork up as
 * fact.
 *
 * So the wider catalogue maps each company onto an archetype — the shape a
 * hiring process of that kind usually takes. The rounds below are *templates*,
 * and every company built from one carries an insight saying so in as many
 * words, alongside the platform-wide disclaimer. A placement cell that knows the
 * real process edits the rounds in the admin console, and the template is gone.
 *
 * This keeps the promise the product makes: preparation content is genuinely
 * useful, and nothing is presented as a company's verified policy.
 */

export type ArchetypeId =
  | 'service_mass'
  | 'service_premium'
  | 'product_sde'
  | 'product_mid'
  | 'consulting_tech'
  | 'analytics_ds'
  | 'fintech_tech'
  | 'core_engineering'
  | 'semiconductor'
  | 'startup_product';

interface Archetype {
  label: string;
  /** What kind of employer this shape fits, shown to admins. */
  summary: string;
  rounds: RoundSeed[];
}

const hr = (name = 'HR Interview', sequenceLabel = 'Round 4'): RoundSeed => ({
  slug: 'hr-interview',
  name: `${sequenceLabel} — ${name}`,
  roundType: 'hr_interview',
  description:
    'Conversation on your background, motivation, flexibility and cultural fit. Usually the final filter before an offer.',
  durationMinutes: 25,
  difficulty: 'easy',
  estimatedPrepHours: 6,
  sections: [
    {
      slug: 'hr-readiness',
      name: 'HR Readiness Check',
      questionCount: 10,
      durationMinutes: 12,
      topics: ['hr-interview', 'leadership-principles'],
    },
  ],
  extraTopics: ['self-introduction', 'behavioural-questions', 'situational-questions', 'company-specific-questions'],
});

const APTITUDE_SECTIONS = {
  quant: {
    slug: 'quantitative',
    name: 'Quantitative Aptitude',
    questionCount: 18,
    durationMinutes: 22,
    topics: [
      'quantitative-aptitude',
      'number-systems',
      'percentages',
      'time-speed-distance',
      'time-and-work',
      'probability',
    ],
  },
  reasoning: {
    slug: 'reasoning',
    name: 'Logical Reasoning',
    questionCount: 16,
    durationMinutes: 20,
    topics: ['logical-reasoning', 'series-completion', 'coding-decoding', 'syllogisms', 'seating-arrangement', 'puzzles'],
  },
  verbal: {
    slug: 'verbal',
    name: 'Verbal Ability',
    questionCount: 16,
    durationMinutes: 18,
    topics: ['verbal-ability', 'reading-comprehension', 'sentence-correction', 'para-jumbles', 'vocabulary'],
  },
  dataInterpretation: {
    slug: 'data-interpretation',
    name: 'Data Interpretation',
    questionCount: 10,
    durationMinutes: 15,
    topics: ['data-interpretation', 'tables-and-charts', 'caselets'],
  },
} as const;

const CORE_CS_SECTION = {
  slug: 'technical-mcq',
  name: 'Core CS Rapid-fire',
  questionCount: 20,
  durationMinutes: 25,
  topics: ['oops', 'dbms', 'sql', 'operating-systems', 'computer-networks', 'programming-fundamentals'],
} as const;

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  // ────────────────────────────────────────────────────────────────────
  service_mass: {
    label: 'IT services — volume hiring',
    summary:
      'Standardised online assessment (aptitude and reasoning) followed by a coding section, a technical interview and an HR round. Used by large IT services recruiters hiring in the thousands.',
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description:
          'Timed aptitude, reasoning and verbal sections. Sections are commonly locked once submitted, so pace matters as much as accuracy.',
        durationMinutes: 80,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        sectionLock: true,
        sections: [
          APTITUDE_SECTIONS.quant,
          APTITUDE_SECTIONS.reasoning,
          APTITUDE_SECTIONS.verbal,
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding',
        roundType: 'coding',
        description: 'One or two programming problems solved in a browser editor, at an easy-to-medium level.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 45,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'searching', 'sorting', 'recursion', 'hashing'],
          },
        ],
        extraTopics: ['complexity-analysis', 'linked-lists'],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Core computer-science fundamentals, one language in depth, and a walk-through of your projects.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 45,
        sections: [CORE_CS_SECTION] as unknown as RoundSeed['sections'],
        extraTopics: ['normalization', 'joins', 'projects-resume'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  service_premium: {
    label: 'IT services — premium / digital track',
    summary:
      'The same funnel as volume hiring with a harder coding paper and a deeper technical interview. Used for the higher-paying engineering tracks service companies run alongside their mass intake.',
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description: 'Aptitude, reasoning and verbal sections, typically with a tighter time budget than the standard track.',
        durationMinutes: 75,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        sectionLock: true,
        sections: [
          APTITUDE_SECTIONS.quant,
          APTITUDE_SECTIONS.reasoning,
          APTITUDE_SECTIONS.verbal,
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Advanced Coding',
        roundType: 'coding',
        description: 'Harder programming problems than the standard track, with hidden test cases and tighter limits.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 55,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'trees', 'dynamic-programming', 'greedy', 'searching'],
          },
        ],
        extraTopics: ['complexity-analysis', 'graphs'],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Data structures, core CS subjects and design-flavoured discussion of your projects.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 50,
        sections: [CORE_CS_SECTION] as unknown as RoundSeed['sections'],
        extraTopics: ['system-design-basics', 'projects-resume', 'solid-principles'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  product_sde: {
    label: 'Product company — SDE loop',
    summary:
      'A timed online assessment of algorithmic problems, then two or three interviews mixing data structures, core CS and design, closing with a hiring-manager or bar-raiser conversation.',
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Two timed algorithmic problems judged on hidden test cases.',
        durationMinutes: 90,
        difficulty: 'hard',
        estimatedPrepHours: 70,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 90,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'trees', 'graphs', 'dynamic-programming', 'heaps', 'searching'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'Live data-structures problem solving with follow-ups on complexity and edge cases.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA & Complexity Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'graphs', 'dynamic-programming', 'complexity-analysis', 'heaps', 'linked-lists'],
          },
        ],
        extraTopics: ['bfs-dfs', 'binary-search', 'dp-knapsack'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Technical Interview II',
        roundType: 'technical_interview',
        description: 'Core CS fundamentals plus low-level or system design appropriate to the level.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'core-cs',
            name: 'Core CS & Design',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['operating-systems', 'dbms', 'oops', 'computer-networks', 'system-design-basics'],
          },
        ],
        extraTopics: ['concurrency', 'caching', 'api-design', 'solid-principles'],
      },
      {
        slug: 'hiring-manager',
        name: 'Round 4 — Hiring Manager',
        roundType: 'managerial',
        description:
          'Discussion of past work, trade-offs you made and how you collaborate, often with behavioural questions in STAR format.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 18,
        sections: [
          {
            slug: 'behavioural',
            name: 'Behavioural & Ownership',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['leadership-principles', 'star-method', 'behavioural-questions', 'situational-questions'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  product_mid: {
    label: 'Product company — single technical loop',
    summary:
      'An assessment mixing coding with CS-fundamentals multiple choice, one technical interview and an HR round. Common at mid-sized product and platform companies.',
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Coding problems alongside a computer-science fundamentals section.',
        durationMinutes: 75,
        difficulty: 'hard',
        estimatedPrepHours: 55,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 50,
            questionKind: 'coding',
            marksPerQuestion: 40,
            topics: ['arrays', 'strings', 'hashing', 'sorting', 'searching', 'stacks-queues'],
          },
          {
            slug: 'cs-fundamentals',
            name: 'CS Fundamentals',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['oops', 'dbms', 'operating-systems', 'computer-networks', 'programming-fundamentals'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 2 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Data structures, core fundamentals and a deep dive into your projects.',
        durationMinutes: 55,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA & Fundamentals',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'hashing', 'dynamic-programming', 'oops', 'complexity-analysis'],
          },
        ],
        extraTopics: ['projects-resume', 'sql'],
      },
      hr('HR Interview', 'Round 3'),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  consulting_tech: {
    label: 'Consulting — technology analyst',
    summary:
      'Aptitude and data interpretation, a situational or case-style stage, a technical screen and a values-led HR conversation.',
    rounds: [
      {
        slug: 'assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description: 'Quantitative, reasoning and data-interpretation sections with a tight clock.',
        durationMinutes: 75,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sectionLock: true,
        sections: [
          APTITUDE_SECTIONS.quant,
          APTITUDE_SECTIONS.reasoning,
          APTITUDE_SECTIONS.dataInterpretation,
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'technical',
        name: 'Round 2 — Technical Screen',
        roundType: 'technical_mcq',
        description: 'Technology fundamentals, SQL and pseudocode reasoning.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Technology Fundamentals',
            questionCount: 20,
            durationMinutes: 30,
            topics: ['programming-fundamentals', 'sql', 'dbms', 'oops', 'computer-networks', 'output-prediction'],
          },
        ],
      },
      {
        slug: 'case-interview',
        name: 'Round 3 — Case & Problem Solving',
        roundType: 'managerial',
        description:
          'A structured problem discussed aloud: clarify, break it down, weigh options, recommend. Communication is assessed as much as the answer.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 20,
        sections: [
          {
            slug: 'situational',
            name: 'Situational Judgement',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['situational-questions', 'hr-interview', 'group-discussion', 'leadership-principles'],
          },
        ],
        extraTopics: ['star-method', 'projects-resume'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  analytics_ds: {
    label: 'Analytics / data science',
    summary:
      'Quantitative aptitude with a statistics flavour, a SQL and case round, then a technical interview on data handling and problem framing.',
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Quantitative & Reasoning',
        roundType: 'aptitude',
        description: 'Numerical ability, probability and data interpretation under time pressure.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 35,
        sections: [
          APTITUDE_SECTIONS.quant,
          APTITUDE_SECTIONS.dataInterpretation,
          APTITUDE_SECTIONS.reasoning,
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'sql-case',
        name: 'Round 2 — SQL & Case',
        roundType: 'technical_mcq',
        description: 'Querying, aggregation and a business case framed as a data problem.',
        durationMinutes: 50,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'sql',
            name: 'SQL & Data Handling',
            questionCount: 18,
            durationMinutes: 28,
            topics: ['sql', 'joins', 'aggregations', 'subqueries', 'window-functions', 'dbms'],
          },
        ],
        extraTopics: ['probability', 'data-interpretation'],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Problem framing, data manipulation and a walk-through of any analytics work on your resume.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Data & Programming',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['sql', 'dbms', 'programming-fundamentals', 'probability', 'arrays'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  fintech_tech: {
    label: 'Bank / financial technology',
    summary:
      'An assessment combining data structures with quantitative aptitude, then technical interviews weighted towards correctness, data handling and systems thinking.',
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Coding problems alongside a quantitative section — accuracy is weighted heavily.',
        durationMinutes: 90,
        difficulty: 'hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'searching', 'dynamic-programming', 'sorting'],
          },
          {
            slug: 'quantitative',
            name: 'Quantitative Aptitude',
            questionCount: 14,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'probability', 'permutation-combination', 'data-interpretation'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'Data structures, SQL and core fundamentals, with emphasis on getting edge cases right.',
        durationMinutes: 55,
        difficulty: 'hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'dsa-sql',
            name: 'DSA & SQL',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'hashing', 'sql', 'joins', 'dbms', 'complexity-analysis'],
          },
        ],
        extraTopics: ['transactions-acid', 'window-functions'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Systems & Fundamentals',
        roundType: 'technical_interview',
        description: 'Operating systems, concurrency and design discussion appropriate to financial systems.',
        durationMinutes: 50,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'core-cs',
            name: 'Systems & Design',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['operating-systems', 'computer-networks', 'system-design-basics', 'oops', 'dbms'],
          },
        ],
        extraTopics: ['concurrency', 'caching', 'projects-resume'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  core_engineering: {
    label: 'Core engineering / manufacturing',
    summary:
      'Aptitude-led selection with a technical stage and a personal interview. Domain subjects vary by discipline and are not covered by the shared question bank — see the note on each company.',
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Aptitude Test',
        roundType: 'aptitude',
        description:
          'Quantitative, reasoning and verbal ability. Aptitude carries more weight here than in software-only processes.',
        durationMinutes: 70,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          APTITUDE_SECTIONS.quant,
          APTITUDE_SECTIONS.reasoning,
          APTITUDE_SECTIONS.verbal,
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'technical',
        name: 'Round 2 — Technical Test',
        roundType: 'technical_mcq',
        description:
          'Discipline fundamentals plus general programming and data handling. Your branch subjects are examined here.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 30,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Technical Fundamentals',
            questionCount: 18,
            durationMinutes: 28,
            topics: ['programming-fundamentals', 'output-prediction', 'dbms', 'computer-networks', 'oops'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Discussion of your final-year project, internships and branch fundamentals.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 30,
        sections: [
          {
            slug: 'technical-mcq-2',
            name: 'Fundamentals Rapid-fire',
            questionCount: 15,
            durationMinutes: 22,
            topics: ['programming-fundamentals', 'oops', 'dbms', 'quantitative-aptitude'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      hr('HR Interview', 'Round 4'),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  semiconductor: {
    label: 'Semiconductor / embedded',
    summary:
      'Aptitude plus a technical stage weighted towards C, memory and systems, then interviews on fundamentals and projects. Digital-design and device subjects are discipline-specific and not covered by the shared bank.',
    rounds: [
      {
        slug: 'assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description: 'Aptitude alongside a technical section covering C, memory and computer organisation.',
        durationMinutes: 75,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          APTITUDE_SECTIONS.quant,
          {
            slug: 'technical',
            name: 'Technical Fundamentals',
            questionCount: 20,
            durationMinutes: 30,
            topics: ['programming-fundamentals', 'pointers-memory', 'output-prediction', 'operating-systems', 'bit-manipulation'],
          },
        ] as unknown as RoundSeed['sections'],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'C fundamentals, pointers, memory layout and bit manipulation, plus your project work.',
        durationMinutes: 50,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Systems & C Rapid-fire',
            questionCount: 18,
            durationMinutes: 26,
            topics: ['programming-fundamentals', 'pointers-memory', 'bit-manipulation', 'operating-systems', 'memory-management'],
          },
        ],
        extraTopics: ['projects-resume', 'complexity-analysis'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Technical Interview II',
        roundType: 'technical_interview',
        description: 'Deeper systems discussion: concurrency, scheduling and debugging approach.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'core-cs',
            name: 'Operating Systems & Architecture',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['operating-systems', 'concurrency', 'cpu-scheduling', 'memory-management', 'computer-networks'],
          },
        ],
        extraTopics: ['deadlocks'],
      },
      hr(),
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  startup_product: {
    label: 'Startup / high-growth product',
    summary:
      'A short algorithmic screen, a hands-on build or debugging round, and a founder or hiring-manager conversation about ownership. Loops are usually fast and few.',
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Coding Screen',
        roundType: 'coding',
        description: 'A short, sharp algorithmic screen — usually two problems.',
        durationMinutes: 70,
        difficulty: 'hard',
        estimatedPrepHours: 55,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 70,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'searching', 'stacks-queues', 'dynamic-programming'],
          },
        ],
      },
      {
        slug: 'machine-coding',
        name: 'Round 2 — Machine Coding / Practical',
        roundType: 'technical_interview',
        description:
          'Build or extend something small and working within the hour: clean structure, sensible naming and handled edge cases matter more than cleverness.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'design-mcq',
            name: 'Design & Fundamentals',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['oops', 'solid-principles', 'system-design-basics', 'dbms', 'api-design'],
          },
        ],
        extraTopics: ['sql', 'projects-resume'],
      },
      {
        slug: 'founder-round',
        name: 'Round 3 — Hiring Manager / Founder',
        roundType: 'managerial',
        description:
          'Why this product, what you have built before, and how you behave when something breaks at short notice.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 12,
        sections: [
          {
            slug: 'behavioural',
            name: 'Ownership & Culture Fit',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['hr-interview', 'behavioural-questions', 'situational-questions', 'leadership-principles'],
          },
        ],
        extraTopics: ['star-method', 'company-specific-questions'],
      },
    ],
  },
};

/**
 * The provenance note attached to every company built from an archetype. It says
 * plainly that the rounds are a template, so a student never mistakes the shape
 * for a researched fact about that employer.
 */
export function archetypeNote(id: ArchetypeId, companyName: string): InsightSeed {
  const archetype = ARCHETYPES[id];
  return {
    category: 'hiring_process',
    title: 'This roadmap follows a hiring-process template',
    body:
      `The rounds shown for ${companyName} are a template for the "${archetype.label}" hiring pattern, not a researched account of this ` +
      `company's actual process. ${archetype.summary} Treat the round names, durations and marks as a realistic practice structure ` +
      `rather than fact, confirm the real process with your placement cell, and ask an administrator to replace these rounds once you ` +
      `know it. The topics themselves are the useful part: they are what this kind of role is generally tested on.`,
    provenance: 'community_reported',
    sourceLabel: 'PlacePrep hiring-process template',
  };
}
