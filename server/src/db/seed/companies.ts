import type { CompanyDifficulty, CompanyType, Provenance, RoundType } from '../../types.js';

/**
 * Seed catalogue of companies.
 *
 * IMPORTANT — data provenance. Nothing in this file is an official statement of
 * any company's recruitment policy. Round structures, eligibility rules and CTC
 * bands are *indicative* figures compiled from publicly discussed, community
 * reported campus-placement experiences, and they change every hiring season.
 * Each insight row therefore carries its own `provenance` marker which the UI
 * surfaces next to the text, and every field here is editable from the admin
 * panel so an institute can replace it with what it has actually verified.
 */

export interface SectionSeed {
  slug: string;
  name: string;
  questionCount: number;
  durationMinutes?: number;
  marksPerQuestion?: number;
  negativeMarks?: number;
  questionKind?: 'mcq' | 'multi_select' | 'coding' | 'subjective' | 'mixed';
  /** Topic slugs this section draws from. */
  topics: string[];
}

export interface RoundSeed {
  slug: string;
  name: string;
  roundType: RoundType;
  description: string;
  durationMinutes?: number;
  difficulty?: CompanyDifficulty;
  elimination?: boolean;
  estimatedPrepHours?: number;
  negativeMarking?: number;
  sectionLock?: boolean;
  sections: SectionSeed[];
  /** Extra roadmap topics that are not tied to a timed section (interview prep). */
  extraTopics?: string[];
}

export interface InsightSeed {
  category:
    | 'hiring_process'
    | 'coding_pattern'
    | 'technical_pattern'
    | 'hr_pattern'
    | 'frequently_tested'
    | 'question_types'
    | 'eligibility'
    | 'preparation_advice'
    | 'general';
  title: string;
  body: string;
  provenance?: Provenance;
  sourceLabel?: string;
  asOf?: string;
}

export interface CompanySeed {
  slug: string;
  name: string;
  logoText: string;
  brandColor: string;
  companyType: CompanyType;
  industry: string;
  description: string;
  difficulty: CompanyDifficulty;
  hiringFrequency: string;
  eligibleBranches: string[];
  eligibleYears: number[];
  minCgpa?: number;
  ctcMinLpa: number;
  ctcMaxLpa: number;
  rolesOffered: string[];
  locations: string[];
  expectedPrepWeeks: number;
  rounds: RoundSeed[];
  insights: InsightSeed[];
}

const CS_BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'];
const CORE_CS = ['CSE', 'IT', 'ECE'];
const YEARS = [2026, 2027, 2028];

const REPORTED = (asOf = '2024–2025 campus season'): Pick<InsightSeed, 'provenance' | 'sourceLabel' | 'asOf'> => ({
  provenance: 'community_reported',
  sourceLabel: 'Aggregated student placement reports',
  asOf,
});

/** Interview rounds shared in shape by most service-based companies. */
const hrRound = (name = 'HR Interview'): RoundSeed => ({
  slug: 'hr-interview',
  name,
  roundType: 'hr_interview',
  description:
    'Conversation on your background, motivation, relocation flexibility and cultural fit. Usually the final filter before an offer.',
  durationMinutes: 20,
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

export const COMPANIES: CompanySeed[] = [
  // ══════════════════════════════════════════════════════════════════════
  // SERVICE-BASED
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'tcs',
    name: 'TCS',
    logoText: 'TCS',
    brandColor: '#1c3f94',
    companyType: 'service',
    industry: 'IT Services & Consulting',
    description:
      'India\'s largest IT services employer. Recruits at very high volume through a standardised online assessment followed by technical and HR interviews.',
    difficulty: 'moderate',
    hiringFrequency: 'Annually, plus off-campus drives',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 3.4,
    ctcMaxLpa: 9.0,
    rolesOffered: ['Assistant System Engineer', 'Digital Cadre', 'Prime Cadre'],
    locations: ['Pune', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata'],
    expectedPrepWeeks: 6,
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Aptitude',
        roundType: 'aptitude',
        description:
          'Timed foundation section covering numerical ability, reasoning ability and verbal ability. Sections are usually locked once submitted.',
        durationMinutes: 75,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        negativeMarking: 0,
        sectionLock: true,
        sections: [
          {
            slug: 'numerical-ability',
            name: 'Numerical Ability',
            questionCount: 20,
            durationMinutes: 25,
            topics: [
              'quantitative-aptitude',
              'number-systems',
              'percentages',
              'time-speed-distance',
              'probability',
              'permutation-combination',
            ],
          },
          {
            slug: 'reasoning-ability',
            name: 'Reasoning Ability',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['logical-reasoning', 'series-completion', 'coding-decoding', 'syllogisms', 'seating-arrangement'],
          },
          {
            slug: 'verbal-ability',
            name: 'Verbal Ability',
            questionCount: 15,
            durationMinutes: 15,
            topics: ['verbal-ability', 'reading-comprehension', 'sentence-correction', 'para-jumbles'],
          },
          {
            slug: 'data-interpretation',
            name: 'Data Interpretation',
            questionCount: 10,
            durationMinutes: 15,
            topics: ['data-interpretation', 'tables-and-charts', 'caselets'],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding',
        roundType: 'coding',
        description:
          'Advanced coding section with a small number of problems solved in a browser editor. Emphasis is on correct handling of input parsing and edge cases.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 45,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'searching', 'sorting', 'recursion', 'linked-lists', 'stacks-queues'],
          },
        ],
        extraTopics: ['trees', 'dynamic-programming', 'complexity-analysis'],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description:
          'Discussion of core CS subjects, your primary programming language and your projects. Expect to write small code snippets on paper or a shared editor.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['oops', 'dbms', 'sql', 'operating-systems', 'computer-networks', 'programming-fundamentals'],
          },
        ],
        extraTopics: ['normalization', 'joins', 'process-management', 'projects-resume'],
      },
      hrRound(),
    ],
    insights: [
      {
        category: 'hiring_process',
        title: 'Typical funnel',
        body: 'Online assessment (aptitude + advanced coding) → technical interview → HR interview. Interviews are frequently clubbed into a single day, and some students report the technical and managerial discussion happening back to back.',
        ...REPORTED(),
      },
      {
        category: 'frequently_tested',
        title: 'Most reported aptitude areas',
        body: 'Number systems, percentages, time–speed–distance, probability, permutation & combination, series and syllogisms appear most often in student recollections.',
        ...REPORTED(),
      },
      {
        category: 'coding_pattern',
        title: 'Coding round shape',
        body: 'Usually one or two problems at an easy-to-medium level. Reading input in the exact required format matters as much as the algorithm — many reported failures were formatting issues rather than logic errors.',
        ...REPORTED(),
      },
      {
        category: 'technical_pattern',
        title: 'Technical interview emphasis',
        body: 'DBMS (normalization, joins), OOPS pillars, one language in depth, and a thorough walk-through of the projects on your resume.',
        ...REPORTED(),
      },
      {
        category: 'hr_pattern',
        title: 'HR themes',
        body: 'Willingness to relocate, service-agreement acceptance, reason for choosing IT services, and long-term plans are commonly reported themes.',
        ...REPORTED(),
      },
      {
        category: 'preparation_advice',
        title: 'Where to spend your time',
        body: 'Aptitude speed is the main differentiator because the section timers are tight and typically cannot be revisited. Practise with a per-section clock rather than an overall one.',
        provenance: 'community_reported',
        sourceLabel: 'PlacePrep editorial guidance',
      },
    ],
  },

  {
    slug: 'infosys',
    name: 'Infosys',
    logoText: 'INFY',
    brandColor: '#007cc3',
    companyType: 'service',
    industry: 'IT Services & Consulting',
    description:
      'Large-scale IT services recruiter. Its assessment is known for a distinctive puzzle-heavy logical reasoning section alongside mathematical ability and pseudocode.',
    difficulty: 'moderate',
    hiringFrequency: 'Annually',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 3.6,
    ctcMaxLpa: 9.5,
    rolesOffered: ['Systems Engineer', 'Digital Specialist Engineer', 'Power Programmer'],
    locations: ['Bengaluru', 'Pune', 'Hyderabad', 'Mysuru', 'Chandigarh'],
    expectedPrepWeeks: 6,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description:
          'Mathematical ability, logical reasoning (puzzle-heavy), verbal ability and pseudocode, each with its own timer.',
        durationMinutes: 100,
        difficulty: 'moderate',
        estimatedPrepHours: 45,
        sectionLock: true,
        sections: [
          {
            slug: 'mathematical-ability',
            name: 'Mathematical Ability',
            questionCount: 15,
            durationMinutes: 35,
            topics: ['quantitative-aptitude', 'number-systems', 'time-and-work', 'probability', 'mensuration'],
          },
          {
            slug: 'logical-reasoning',
            name: 'Logical Reasoning',
            questionCount: 15,
            durationMinutes: 25,
            topics: ['logical-reasoning', 'puzzles', 'seating-arrangement', 'blood-relations', 'clocks-calendars'],
          },
          {
            slug: 'verbal-ability',
            name: 'Verbal Ability',
            questionCount: 20,
            durationMinutes: 20,
            topics: ['verbal-ability', 'reading-comprehension', 'sentence-correction', 'vocabulary'],
          },
          {
            slug: 'pseudocode',
            name: 'Pseudocode',
            questionCount: 10,
            durationMinutes: 20,
            topics: ['programming-fundamentals', 'output-prediction', 'arrays', 'recursion', 'complexity-analysis'],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Hands-on Coding',
        roundType: 'coding',
        description: 'Programming problems for Digital Specialist Engineer and Power Programmer tracks.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'searching', 'dynamic-programming', 'greedy'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Core computer-science fundamentals, coding discussion and project deep-dive.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['oops', 'dbms', 'sql', 'operating-systems', 'computer-networks'],
          },
        ],
        extraTopics: ['projects-resume', 'normalization', 'joins'],
      },
      hrRound(),
    ],
    insights: [
      {
        category: 'hiring_process',
        title: 'Typical funnel',
        body: 'Online assessment → (for higher tracks) hands-on coding → technical interview → HR interview. Higher-paying tracks reportedly use a harder coding paper.',
        ...REPORTED(),
      },
      {
        category: 'question_types',
        title: 'Pseudocode section',
        body: 'A language-agnostic pseudocode block is shown and you predict its output or complexity. Practising dry-runs on paper is reported to help more than memorising syntax.',
        ...REPORTED(),
      },
      {
        category: 'frequently_tested',
        title: 'Reasoning weight',
        body: 'Puzzle-style arrangement and deduction questions carry noticeably more weight here than in most other service-based assessments.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'wipro',
    name: 'Wipro',
    logoText: 'WIPRO',
    brandColor: '#341e6f',
    companyType: 'service',
    industry: 'IT Services & Consulting',
    description:
      'IT services recruiter whose assessment notably includes a written-communication (essay) task alongside aptitude and coding.',
    difficulty: 'easy',
    hiringFrequency: 'Annually (Elite NLTH drives)',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 3.5,
    ctcMaxLpa: 8.0,
    rolesOffered: ['Project Engineer', 'Turbo Engineer'],
    locations: ['Bengaluru', 'Pune', 'Chennai', 'Hyderabad'],
    expectedPrepWeeks: 5,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description: 'Quantitative, logical and verbal sections plus a written-communication essay task.',
        durationMinutes: 80,
        difficulty: 'easy',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'quantitative',
            name: 'Quantitative Aptitude',
            questionCount: 16,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'percentages', 'ratio-proportion', 'averages-mixtures', 'profit-loss'],
          },
          {
            slug: 'logical',
            name: 'Logical Reasoning',
            questionCount: 14,
            durationMinutes: 20,
            topics: ['logical-reasoning', 'series-completion', 'coding-decoding', 'direction-sense'],
          },
          {
            slug: 'verbal',
            name: 'Verbal Ability',
            questionCount: 22,
            durationMinutes: 20,
            topics: ['verbal-ability', 'reading-comprehension', 'synonyms-antonyms', 'sentence-correction'],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding',
        roundType: 'coding',
        description: 'Two programming problems in a language of your choice.',
        durationMinutes: 60,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'sorting', 'searching', 'recursion'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Fundamentals across OOPS, DBMS and OS with resume-driven questions.',
        durationMinutes: 35,
        difficulty: 'easy',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 15,
            durationMinutes: 20,
            topics: ['oops', 'dbms', 'operating-systems', 'programming-fundamentals'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      hrRound(),
    ],
    insights: [
      {
        category: 'question_types',
        title: 'Written communication task',
        body: 'A short essay is reportedly evaluated on grammar, structure and coherence rather than the opinion expressed. Practising a 200-word structured response under 20 minutes is commonly advised.',
        ...REPORTED(),
      },
      {
        category: 'eligibility',
        title: 'Service agreement',
        body: 'Students report a service-agreement clause attached to the offer. Confirm current terms with your placement cell — the specifics change between seasons.',
        provenance: 'community_reported',
        sourceLabel: 'Student reports',
        asOf: '2024–2025',
      },
    ],
  },

  {
    slug: 'accenture',
    name: 'Accenture',
    logoText: 'ACN',
    brandColor: '#a100ff',
    companyType: 'service',
    industry: 'Consulting & Technology',
    description:
      'Global consulting and technology firm. Its assessment is known for a cognitive section, a technical section and a communication-assessment module.',
    difficulty: 'moderate',
    hiringFrequency: 'Annually',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 4.5,
    ctcMaxLpa: 11.0,
    rolesOffered: ['Associate Software Engineer', 'Advanced App Engineering Analyst'],
    locations: ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Gurugram'],
    expectedPrepWeeks: 5,
    rounds: [
      {
        slug: 'cognitive-technical',
        name: 'Round 1 — Cognitive & Technical Assessment',
        roundType: 'aptitude',
        description:
          'Cognitive ability (verbal, reasoning, numerical) followed by a technical section on fundamentals, pseudocode and networking/security basics.',
        durationMinutes: 90,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        sectionLock: true,
        sections: [
          {
            slug: 'numerical',
            name: 'Numerical Ability',
            questionCount: 15,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'percentages', 'ratio-proportion', 'time-and-work'],
          },
          {
            slug: 'reasoning',
            name: 'Abstract Reasoning',
            questionCount: 15,
            durationMinutes: 20,
            topics: ['logical-reasoning', 'series-completion', 'puzzles', 'syllogisms'],
          },
          {
            slug: 'verbal',
            name: 'Verbal Ability',
            questionCount: 15,
            durationMinutes: 15,
            topics: ['verbal-ability', 'reading-comprehension', 'para-jumbles'],
          },
          {
            slug: 'technical',
            name: 'Technical Assessment',
            questionCount: 20,
            durationMinutes: 35,
            topics: [
              'programming-fundamentals',
              'oops',
              'dbms',
              'computer-networks',
              'output-prediction',
              'operating-systems',
            ],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding Assessment',
        roundType: 'coding',
        description: 'Two coding problems for engineering tracks.',
        durationMinutes: 45,
        difficulty: 'moderate',
        estimatedPrepHours: 30,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 45,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'sorting'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Fundamentals, project discussion and applied problem solving.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 18,
            durationMinutes: 22,
            topics: ['oops', 'dbms', 'sql', 'computer-networks', 'operating-systems'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      hrRound('Round 4 — HR Interview'),
    ],
    insights: [
      {
        category: 'question_types',
        title: 'Communication assessment',
        body: 'A separate spoken/written communication module is commonly reported. It scores pronunciation, fluency and sentence construction rather than technical content.',
        ...REPORTED(),
      },
      {
        category: 'frequently_tested',
        title: 'Technical section breadth',
        body: 'Students report a wide but shallow technical section: pseudocode output, OOPS definitions, DBMS basics, networking and security terminology, and cloud vocabulary.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'cognizant',
    name: 'Cognizant',
    logoText: 'CTS',
    brandColor: '#1b74e4',
    companyType: 'service',
    industry: 'IT Services & Consulting',
    description:
      'IT services recruiter running GenC and GenC Next tracks, with the higher track using a substantially harder coding assessment.',
    difficulty: 'moderate',
    hiringFrequency: 'Annually (GenC / GenC Next)',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 4.0,
    ctcMaxLpa: 12.0,
    rolesOffered: ['Programmer Analyst (GenC)', 'GenC Next Engineer'],
    locations: ['Chennai', 'Bengaluru', 'Hyderabad', 'Pune', 'Kolkata'],
    expectedPrepWeeks: 6,
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Aptitude & Reasoning',
        roundType: 'aptitude',
        description: 'Quantitative, logical and verbal sections.',
        durationMinutes: 60,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'quantitative',
            name: 'Quantitative Aptitude',
            questionCount: 16,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'number-systems', 'time-speed-distance', 'probability'],
          },
          {
            slug: 'logical',
            name: 'Logical Reasoning',
            questionCount: 16,
            durationMinutes: 20,
            topics: ['logical-reasoning', 'puzzles', 'coding-decoding', 'syllogisms'],
          },
          {
            slug: 'verbal',
            name: 'Verbal Ability',
            questionCount: 18,
            durationMinutes: 20,
            topics: ['verbal-ability', 'reading-comprehension', 'sentence-correction'],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding',
        roundType: 'coding',
        description: 'Two problems; the GenC Next track is reported to be markedly harder.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'recursion', 'dynamic-programming', 'trees'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Core CS, SQL queries and project discussion.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['oops', 'dbms', 'sql', 'operating-systems', 'computer-networks'],
          },
        ],
        extraTopics: ['joins', 'normalization', 'projects-resume'],
      },
      hrRound(),
    ],
    insights: [
      {
        category: 'hiring_process',
        title: 'Two tracks',
        body: 'A standard track and a premium track are commonly reported, differentiated mainly by coding difficulty and compensation. Confirm which track your drive uses.',
        ...REPORTED(),
      },
      {
        category: 'frequently_tested',
        title: 'SQL emphasis',
        body: 'Writing SQL live during the technical interview — particularly joins and aggregate queries — appears frequently in student reports.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'capgemini',
    name: 'Capgemini',
    logoText: 'CG',
    brandColor: '#0070ad',
    companyType: 'service',
    industry: 'Consulting & Technology',
    description:
      'Consulting and technology services firm. Its assessment is known for a game-based/behavioural aptitude stage plus pseudocode and English comprehension.',
    difficulty: 'moderate',
    hiringFrequency: 'Annually',
    eligibleBranches: CS_BRANCHES,
    eligibleYears: YEARS,
    minCgpa: 6.0,
    ctcMinLpa: 4.0,
    ctcMaxLpa: 7.5,
    rolesOffered: ['Analyst', 'Senior Analyst (Elite track)'],
    locations: ['Mumbai', 'Pune', 'Bengaluru', 'Chennai', 'Hyderabad'],
    expectedPrepWeeks: 5,
    rounds: [
      {
        slug: 'aptitude',
        name: 'Round 1 — Cognitive Assessment',
        roundType: 'aptitude',
        description: 'Game-based reasoning, pseudocode and English comprehension.',
        durationMinutes: 75,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'reasoning',
            name: 'Logical Reasoning',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['logical-reasoning', 'series-completion', 'puzzles', 'direction-sense', 'clocks-calendars'],
          },
          {
            slug: 'pseudocode',
            name: 'Pseudocode',
            questionCount: 15,
            durationMinutes: 25,
            topics: ['programming-fundamentals', 'output-prediction', 'arrays', 'complexity-analysis', 'recursion'],
          },
          {
            slug: 'english',
            name: 'English Comprehension',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['verbal-ability', 'reading-comprehension', 'vocabulary', 'sentence-correction'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 2 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Programming fundamentals, DBMS and project discussion.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 35,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 18,
            durationMinutes: 22,
            topics: ['oops', 'dbms', 'sql', 'operating-systems', 'programming-fundamentals'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      hrRound(),
    ],
    insights: [
      {
        category: 'question_types',
        title: 'Pseudocode weight',
        body: 'Pseudocode output prediction is reported as the highest-yield section to prepare, and it is largely language-agnostic.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'deloitte',
    name: 'Deloitte',
    logoText: 'DEL',
    brandColor: '#86bc25',
    companyType: 'service',
    industry: 'Professional Services & Consulting',
    description:
      'Professional services firm hiring into technology consulting. Assessments lean towards situational judgement and structured communication alongside technical screening.',
    difficulty: 'hard',
    hiringFrequency: 'Annually',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.0,
    ctcMinLpa: 6.5,
    ctcMaxLpa: 14.0,
    rolesOffered: ['Analyst — Technology', 'Consultant'],
    locations: ['Bengaluru', 'Hyderabad', 'Gurugram', 'Mumbai'],
    expectedPrepWeeks: 7,
    rounds: [
      {
        slug: 'assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'aptitude',
        description: 'Aptitude, situational judgement and technical fundamentals.',
        durationMinutes: 80,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'quantitative',
            name: 'Quantitative Aptitude',
            questionCount: 15,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'data-interpretation', 'percentages', 'probability'],
          },
          {
            slug: 'reasoning',
            name: 'Logical Reasoning',
            questionCount: 15,
            durationMinutes: 20,
            topics: ['logical-reasoning', 'puzzles', 'syllogisms', 'seating-arrangement'],
          },
          {
            slug: 'technical',
            name: 'Technical Fundamentals',
            questionCount: 20,
            durationMinutes: 30,
            topics: ['oops', 'dbms', 'sql', 'operating-systems', 'computer-networks'],
          },
        ],
      },
      {
        slug: 'coding',
        name: 'Round 2 — Coding',
        roundType: 'coding',
        description: 'Programming assessment for technology roles.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'coding',
            name: 'Programming',
            questionCount: 2,
            durationMinutes: 60,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'trees', 'dynamic-programming'],
          },
        ],
      },
      {
        slug: 'technical-interview',
        name: 'Round 3 — Technical Interview',
        roundType: 'technical_interview',
        description: 'Deep technical discussion with case-style problem framing.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'technical-mcq',
            name: 'Core CS Rapid-fire',
            questionCount: 20,
            durationMinutes: 25,
            topics: ['dbms', 'sql', 'oops', 'system-design-basics', 'operating-systems'],
          },
        ],
        extraTopics: ['projects-resume', 'api-design'],
      },
      {
        slug: 'managerial-hr',
        name: 'Round 4 — Managerial & HR',
        roundType: 'managerial',
        description:
          'Case-style and situational discussion assessing structured thinking, client orientation and communication.',
        durationMinutes: 35,
        difficulty: 'moderate',
        estimatedPrepHours: 12,
        sections: [
          {
            slug: 'behavioural',
            name: 'Behavioural & Situational',
            questionCount: 12,
            durationMinutes: 15,
            topics: ['hr-interview', 'situational-questions', 'leadership-principles', 'group-discussion'],
          },
        ],
        extraTopics: ['star-method', 'company-specific-questions'],
      },
    ],
    insights: [
      {
        category: 'hr_pattern',
        title: 'Situational judgement weight',
        body: 'Consulting-style situational questions ("a client escalates two days before delivery — what do you do?") feature more heavily here than in pure IT-services interviews.',
        ...REPORTED(),
      },
      {
        category: 'preparation_advice',
        title: 'Structure your answers',
        body: 'Answering in an explicit framework (situation → options → trade-off → decision) is widely advised for the managerial round.',
        provenance: 'community_reported',
        sourceLabel: 'PlacePrep editorial guidance',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // PRODUCT-BASED
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'amazon',
    name: 'Amazon',
    logoText: 'AMZ',
    brandColor: '#ff9900',
    companyType: 'product',
    industry: 'E-commerce & Cloud',
    description:
      'Large product company with a heavily DSA-weighted process and a distinctive behavioural bar built around its leadership principles.',
    difficulty: 'very_hard',
    hiringFrequency: 'Multiple drives per year',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.0,
    ctcMinLpa: 19.0,
    ctcMaxLpa: 45.0,
    rolesOffered: ['SDE-1', 'SDE Intern'],
    locations: ['Bengaluru', 'Hyderabad', 'Chennai', 'Gurugram'],
    expectedPrepWeeks: 12,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description:
          'Two timed coding problems plus a work-styles/behavioural survey. Debugging and workplace-simulation modules are also commonly reported.',
        durationMinutes: 105,
        difficulty: 'hard',
        estimatedPrepHours: 70,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 70,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'hashing', 'trees', 'graphs', 'dynamic-programming', 'heaps'],
          },
          {
            slug: 'workstyles',
            name: 'Work Styles Assessment',
            questionCount: 12,
            durationMinutes: 20,
            topics: ['leadership-principles', 'star-method', 'situational-questions'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description:
          'Live DSA problem solving with follow-ups on complexity and edge cases, interleaved with leadership-principle probing.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA & Complexity Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'graphs', 'dynamic-programming', 'complexity-analysis', 'heaps'],
          },
        ],
        extraTopics: ['bfs-dfs', 'dp-knapsack', 'binary-search'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Technical Interview II',
        roundType: 'technical_interview',
        description: 'A second problem-solving round, often harder, plus core CS and low-level design discussion.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 55,
        sections: [
          {
            slug: 'core-cs',
            name: 'Core CS & Design',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['operating-systems', 'dbms', 'oops', 'system-design-basics', 'computer-networks'],
          },
        ],
        extraTopics: ['concurrency', 'caching', 'api-design'],
      },
      {
        slug: 'bar-raiser',
        name: 'Round 4 — Bar Raiser',
        roundType: 'managerial',
        description:
          'An interviewer from outside the hiring team assesses long-term potential, heavily anchored on leadership principles with STAR-format examples.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 20,
        sections: [
          {
            slug: 'behavioural',
            name: 'Leadership Principles',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['leadership-principles', 'star-method', 'behavioural-questions', 'situational-questions'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
    ],
    insights: [
      {
        category: 'hiring_process',
        title: 'Typical funnel',
        body: 'Online assessment → two to three technical interviews → a bar-raiser round. The exact count varies by role and location.',
        ...REPORTED(),
      },
      {
        category: 'coding_pattern',
        title: 'Coding emphasis',
        body: 'Arrays, strings, hashing, trees, graphs (BFS/DFS), heaps and dynamic programming dominate reported questions. Interviewers commonly ask for the optimal complexity and then push on edge cases.',
        ...REPORTED(),
      },
      {
        category: 'hr_pattern',
        title: 'Leadership principles',
        body: 'Amazon publishes its leadership principles openly, and reports consistently describe behavioural questions mapped to them. Prepare two STAR-format stories per principle with concrete metrics.',
        provenance: 'verified',
        sourceLabel: 'Amazon publicly documents its leadership principles; the interview weighting is community-reported',
        asOf: 'Ongoing',
      },
      {
        category: 'preparation_advice',
        title: 'Depth beats breadth',
        body: 'Reports suggest volume alone is not enough — being able to explain why an approach is optimal, and to code it cleanly first time, matters more than the number of problems solved.',
        provenance: 'community_reported',
        sourceLabel: 'PlacePrep editorial guidance',
      },
    ],
  },

  {
    slug: 'microsoft',
    name: 'Microsoft',
    logoText: 'MS',
    brandColor: '#0078d4',
    companyType: 'product',
    industry: 'Software & Cloud',
    description:
      'Product company with a strong emphasis on clean coding, data-structure depth and design thinking appropriate to the level.',
    difficulty: 'very_hard',
    hiringFrequency: 'Annually (plus intern drives)',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.5,
    ctcMinLpa: 20.0,
    ctcMaxLpa: 50.0,
    rolesOffered: ['Software Engineer', 'SDE Intern'],
    locations: ['Bengaluru', 'Hyderabad', 'Noida'],
    expectedPrepWeeks: 12,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Two to three coding problems on a timed platform.',
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
            topics: ['arrays', 'strings', 'trees', 'graphs', 'dynamic-programming', 'linked-lists', 'greedy'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'Data structures and algorithms with an emphasis on writing production-quality code.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'linked-lists', 'dynamic-programming', 'complexity-analysis', 'bit-manipulation'],
          },
        ],
        extraTopics: ['binary-search-trees', 'dp-strings'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Technical Interview II',
        roundType: 'technical_interview',
        description: 'Core CS fundamentals, OOP design and low-level design discussion.',
        durationMinutes: 60,
        difficulty: 'very_hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'core-cs',
            name: 'Core CS & OOP Design',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['oops', 'operating-systems', 'dbms', 'computer-networks', 'system-design-basics'],
          },
        ],
        extraTopics: ['solid-principles', 'concurrency'],
      },
      {
        slug: 'as-appropriate',
        name: 'Round 4 — Hiring Manager Round',
        roundType: 'managerial',
        description:
          'Discussion with a hiring manager covering past work, design trade-offs, collaboration and growth mindset.',
        durationMinutes: 45,
        difficulty: 'hard',
        estimatedPrepHours: 18,
        sections: [
          {
            slug: 'behavioural',
            name: 'Behavioural & Design Trade-offs',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['hr-interview', 'leadership-principles', 'system-design-basics', 'projects-resume'],
          },
        ],
        extraTopics: ['star-method'],
      },
    ],
    insights: [
      {
        category: 'coding_pattern',
        title: 'Code quality matters',
        body: 'Reports repeatedly stress readable, compiling, edge-case-safe code written without heavy prompting — not just the right idea.',
        ...REPORTED(),
      },
      {
        category: 'technical_pattern',
        title: 'Design-flavoured questions',
        body: 'Even at entry level, students report OOP design questions such as modelling a parking lot or an elevator system.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'google',
    name: 'Google',
    logoText: 'GOOG',
    brandColor: '#4285f4',
    companyType: 'product',
    industry: 'Internet & Software',
    description:
      'Product company known for algorithmically demanding interviews with a strong focus on reasoning aloud and analysing complexity precisely.',
    difficulty: 'very_hard',
    hiringFrequency: 'Rolling (STEP / SWE drives)',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 8.0,
    ctcMinLpa: 25.0,
    ctcMaxLpa: 65.0,
    rolesOffered: ['Software Engineer', 'STEP Intern'],
    locations: ['Bengaluru', 'Hyderabad', 'Pune', 'Gurugram'],
    expectedPrepWeeks: 16,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Timed algorithmic problems, typically two, with strict correctness on hidden tests.',
        durationMinutes: 90,
        difficulty: 'very_hard',
        estimatedPrepHours: 80,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 90,
            questionKind: 'coding',
            marksPerQuestion: 50,
            topics: ['arrays', 'strings', 'graphs', 'dynamic-programming', 'greedy', 'searching', 'trees'],
          },
        ],
      },
      {
        slug: 'phone-screen',
        name: 'Round 2 — Technical Phone Screen',
        roundType: 'technical_interview',
        description: 'One algorithmic problem in a shared editor with continuous verbal reasoning.',
        durationMinutes: 45,
        difficulty: 'very_hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'Algorithms Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['graphs', 'dynamic-programming', 'searching', 'complexity-analysis', 'heaps', 'greedy'],
          },
        ],
        extraTopics: ['shortest-paths', 'binary-search-on-answer'],
      },
      {
        slug: 'onsite',
        name: 'Round 3 — Onsite Loop',
        roundType: 'technical_interview',
        description:
          'Multiple back-to-back interviews mixing algorithms, system/data-structure design and general engineering discussion.',
        durationMinutes: 180,
        difficulty: 'very_hard',
        estimatedPrepHours: 70,
        sections: [
          {
            slug: 'core-cs',
            name: 'Core CS & Design',
            questionCount: 20,
            durationMinutes: 28,
            topics: ['operating-systems', 'system-design-basics', 'dbms', 'computer-networks', 'oops'],
          },
        ],
        extraTopics: ['scalability', 'caching', 'db-sharding'],
      },
      {
        slug: 'googleyness',
        name: 'Round 4 — Team & Culture Fit',
        roundType: 'hr_interview',
        description: 'Collaboration, ambiguity handling and impact-oriented discussion of your past work.',
        durationMinutes: 40,
        difficulty: 'moderate',
        estimatedPrepHours: 15,
        sections: [
          {
            slug: 'behavioural',
            name: 'Behavioural',
            questionCount: 12,
            durationMinutes: 18,
            topics: ['hr-interview', 'behavioural-questions', 'situational-questions', 'projects-resume'],
          },
        ],
        extraTopics: ['star-method'],
      },
    ],
    insights: [
      {
        category: 'coding_pattern',
        title: 'Reason out loud',
        body: 'Reports consistently note that the process of arriving at a solution — clarifying, proposing, analysing, refining — is graded alongside the final code.',
        ...REPORTED(),
      },
      {
        category: 'frequently_tested',
        title: 'Recurring areas',
        body: 'Graphs, dynamic programming, binary search on the answer, and heap/interval problems recur most in reported experiences.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'adobe',
    name: 'Adobe',
    logoText: 'ADBE',
    brandColor: '#fa0f00',
    companyType: 'product',
    industry: 'Creative Software',
    description:
      'Product company whose assessments mix strong DSA with computer-science fundamentals and, for some roles, aptitude.',
    difficulty: 'hard',
    hiringFrequency: 'Annually',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.5,
    ctcMinLpa: 18.0,
    ctcMaxLpa: 40.0,
    rolesOffered: ['Member of Technical Staff', 'Product Intern'],
    locations: ['Noida', 'Bengaluru'],
    expectedPrepWeeks: 10,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Coding problems combined with aptitude and CS-fundamentals MCQs.',
        durationMinutes: 90,
        difficulty: 'hard',
        estimatedPrepHours: 60,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 55,
            questionKind: 'coding',
            marksPerQuestion: 40,
            topics: ['arrays', 'strings', 'trees', 'dynamic-programming', 'stacks-queues'],
          },
          {
            slug: 'cs-fundamentals',
            name: 'CS Fundamentals',
            questionCount: 18,
            durationMinutes: 20,
            topics: ['oops', 'operating-systems', 'dbms', 'computer-networks', 'programming-fundamentals'],
          },
          {
            slug: 'aptitude',
            name: 'Aptitude',
            questionCount: 12,
            durationMinutes: 15,
            topics: ['quantitative-aptitude', 'logical-reasoning', 'probability'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'DSA problem solving plus discussion of internships and projects.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'trees', 'dynamic-programming', 'hashing', 'complexity-analysis'],
          },
        ],
        extraTopics: ['projects-resume'],
      },
      {
        slug: 'technical-2',
        name: 'Round 3 — Technical Interview II',
        roundType: 'technical_interview',
        description: 'Deeper fundamentals with OOP/low-level design and language internals.',
        durationMinutes: 50,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'core-cs',
            name: 'Core CS & Design',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['oops', 'operating-systems', 'system-design-basics', 'dbms'],
          },
        ],
        extraTopics: ['solid-principles', 'memory-management'],
      },
      hrRound('Round 4 — HR Interview'),
    ],
    insights: [
      {
        category: 'technical_pattern',
        title: 'Fundamentals carry weight',
        body: 'Unlike some pure-DSA loops, OS and OOP internals are reported as a substantial part of the technical rounds here.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'salesforce',
    name: 'Salesforce',
    logoText: 'SFDC',
    brandColor: '#00a1e0',
    companyType: 'product',
    industry: 'Enterprise SaaS / CRM',
    description:
      'Enterprise SaaS company. Reported loops combine DSA with database/SQL depth and design discussion suited to data-heavy products.',
    difficulty: 'hard',
    hiringFrequency: 'Annually',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.5,
    ctcMinLpa: 18.0,
    ctcMaxLpa: 38.0,
    rolesOffered: ['Associate Member of Technical Staff', 'Technical Intern'],
    locations: ['Hyderabad', 'Bengaluru'],
    expectedPrepWeeks: 10,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Coding problems plus CS-fundamentals and SQL MCQs.',
        durationMinutes: 90,
        difficulty: 'hard',
        estimatedPrepHours: 55,
        sections: [
          {
            slug: 'coding',
            name: 'Coding',
            questionCount: 2,
            durationMinutes: 55,
            questionKind: 'coding',
            marksPerQuestion: 40,
            topics: ['arrays', 'strings', 'hashing', 'trees', 'sorting'],
          },
          {
            slug: 'db-sql',
            name: 'Database & SQL',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['sql', 'dbms', 'joins', 'normalization', 'indexing', 'transactions-acid'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'DSA and SQL problem solving in a shared editor.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 45,
        sections: [
          {
            slug: 'dsa-sql',
            name: 'DSA & SQL Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'hashing', 'sql', 'joins', 'window-functions'],
          },
        ],
        extraTopics: ['subqueries', 'aggregations'],
      },
      {
        slug: 'design',
        name: 'Round 3 — Design & Fundamentals',
        roundType: 'system_design',
        description: 'Data modelling and service design discussion appropriate to the level.',
        durationMinutes: 55,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'design-mcq',
            name: 'Design & Fundamentals',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['system-design-basics', 'dbms', 'oops', 'computer-networks'],
          },
        ],
        extraTopics: ['api-design', 'caching', 'er-modelling'],
      },
      hrRound('Round 4 — HR Interview'),
    ],
    insights: [
      {
        category: 'frequently_tested',
        title: 'SQL depth',
        body: 'SQL is reported as unusually prominent — joins, aggregation, subqueries and window functions, not just basic selects.',
        ...REPORTED(),
      },
    ],
  },

  {
    slug: 'walmart',
    name: 'Walmart',
    logoText: 'WMT',
    brandColor: '#0071ce',
    companyType: 'product',
    industry: 'Retail Technology',
    description:
      'Retail-technology organisation hiring for large-scale distributed systems, with DSA-first assessments and design depth.',
    difficulty: 'hard',
    hiringFrequency: 'Annually',
    eligibleBranches: CORE_CS,
    eligibleYears: YEARS,
    minCgpa: 7.0,
    ctcMinLpa: 16.0,
    ctcMaxLpa: 36.0,
    rolesOffered: ['Software Engineer III', 'SDE Intern'],
    locations: ['Bengaluru', 'Chennai'],
    expectedPrepWeeks: 10,
    rounds: [
      {
        slug: 'online-assessment',
        name: 'Round 1 — Online Assessment',
        roundType: 'coding',
        description: 'Timed coding problems with hidden test cases.',
        durationMinutes: 90,
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
            topics: ['arrays', 'strings', 'hashing', 'graphs', 'dynamic-programming', 'heaps'],
          },
          {
            slug: 'aptitude',
            name: 'Quantitative & Reasoning',
            questionCount: 12,
            durationMinutes: 20,
            topics: ['quantitative-aptitude', 'logical-reasoning', 'data-interpretation'],
          },
        ],
      },
      {
        slug: 'technical-1',
        name: 'Round 2 — Technical Interview I',
        roundType: 'technical_interview',
        description: 'DSA problem solving with complexity trade-off discussion.',
        durationMinutes: 60,
        difficulty: 'hard',
        estimatedPrepHours: 50,
        sections: [
          {
            slug: 'dsa-mcq',
            name: 'DSA Rapid-fire',
            questionCount: 18,
            durationMinutes: 25,
            topics: ['arrays', 'graphs', 'trees', 'dynamic-programming', 'complexity-analysis'],
          },
        ],
      },
      {
        slug: 'design',
        name: 'Round 3 — Design & Fundamentals',
        roundType: 'system_design',
        description: 'Scalability, caching and data-store choices for retail-scale workloads.',
        durationMinutes: 55,
        difficulty: 'hard',
        estimatedPrepHours: 40,
        sections: [
          {
            slug: 'design-mcq',
            name: 'Design & Fundamentals',
            questionCount: 16,
            durationMinutes: 24,
            topics: ['system-design-basics', 'dbms', 'computer-networks', 'operating-systems'],
          },
        ],
        extraTopics: ['scalability', 'caching', 'db-sharding'],
      },
      hrRound('Round 4 — HR Interview'),
    ],
    insights: [
      {
        category: 'technical_pattern',
        title: 'Scale-oriented questions',
        body: 'Reported discussions frequently move from a working solution to "now make it work for a hundred million rows", so practise reasoning about scale explicitly.',
        ...REPORTED(),
      },
    ],
  },
];
