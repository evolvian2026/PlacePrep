export interface BadgeSeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  xpReward: number;
  /** Evaluated by the gamification service after every graded activity. */
  criteria:
    | { type: 'topic_questions'; topicSlug: string; count: number }
    | { type: 'category_questions'; category: string; count: number }
    | { type: 'questions_solved'; count: number }
    | { type: 'coding_solved'; count: number }
    | { type: 'coding_solved_difficulty'; difficulty: 'easy' | 'medium' | 'hard'; count: number }
    | { type: 'mocks_completed'; count: number }
    | { type: 'mock_score_above'; percentage: number; count: number }
    | { type: 'streak_days'; count: number }
    | { type: 'topics_mastered'; count: number }
    | { type: 'company_readiness'; companySlug: string; readiness: number };
  companySlug?: string;
}

export const BADGES: BadgeSeed[] = [
  {
    slug: 'first-steps',
    name: 'First Steps',
    description: 'Solved your first 10 practice questions.',
    icon: '🌱',
    tier: 'bronze',
    xpReward: 25,
    criteria: { type: 'questions_solved', count: 10 },
  },
  {
    slug: 'century',
    name: 'Century',
    description: 'Solved 100 questions across the platform.',
    icon: '💯',
    tier: 'silver',
    xpReward: 150,
    criteria: { type: 'questions_solved', count: 100 },
  },
  {
    slug: 'sql-master',
    name: 'SQL Master',
    description: 'Solved 100 SQL questions.',
    icon: '🗄️',
    tier: 'gold',
    xpReward: 300,
    criteria: { type: 'topic_questions', topicSlug: 'sql', count: 100 },
  },
  {
    slug: 'dbms-adept',
    name: 'DBMS Adept',
    description: 'Solved 50 DBMS questions.',
    icon: '🧩',
    tier: 'silver',
    xpReward: 150,
    criteria: { type: 'topic_questions', topicSlug: 'dbms', count: 50 },
  },
  {
    slug: 'aptitude-ace',
    name: 'Aptitude Ace',
    description: 'Solved 150 quantitative aptitude questions.',
    icon: '📐',
    tier: 'gold',
    xpReward: 250,
    criteria: { type: 'category_questions', category: 'aptitude', count: 150 },
  },
  {
    slug: 'reasoning-ranger',
    name: 'Reasoning Ranger',
    description: 'Solved 100 logical reasoning questions.',
    icon: '🧠',
    tier: 'silver',
    xpReward: 150,
    criteria: { type: 'category_questions', category: 'reasoning', count: 100 },
  },
  {
    slug: 'coding-warrior',
    name: 'Coding Warrior',
    description: 'Solved 50 coding problems.',
    icon: '⚔️',
    tier: 'gold',
    xpReward: 400,
    criteria: { type: 'coding_solved', count: 50 },
  },
  {
    slug: 'first-accept',
    name: 'First Accept',
    description: 'Got your first coding submission accepted.',
    icon: '✅',
    tier: 'bronze',
    xpReward: 50,
    criteria: { type: 'coding_solved', count: 1 },
  },
  {
    slug: 'hard-hitter',
    name: 'Hard Hitter',
    description: 'Solved 10 hard coding problems.',
    icon: '🔥',
    tier: 'platinum',
    xpReward: 500,
    criteria: { type: 'coding_solved_difficulty', difficulty: 'hard', count: 10 },
  },
  {
    slug: 'mock-champion',
    name: 'Mock Champion',
    description: 'Scored above 90% in 5 mock tests.',
    icon: '🏆',
    tier: 'platinum',
    xpReward: 500,
    criteria: { type: 'mock_score_above', percentage: 90, count: 5 },
  },
  {
    slug: 'mock-regular',
    name: 'Mock Regular',
    description: 'Completed 10 mock tests.',
    icon: '📝',
    tier: 'silver',
    xpReward: 200,
    criteria: { type: 'mocks_completed', count: 10 },
  },
  {
    slug: 'first-mock',
    name: 'Into the Arena',
    description: 'Completed your first mock test.',
    icon: '🎯',
    tier: 'bronze',
    xpReward: 50,
    criteria: { type: 'mocks_completed', count: 1 },
  },
  {
    slug: 'streak-7',
    name: 'Week Warrior',
    description: 'Practised on 7 consecutive days.',
    icon: '🔥',
    tier: 'silver',
    xpReward: 200,
    criteria: { type: 'streak_days', count: 7 },
  },
  {
    slug: 'streak-30',
    name: 'Unbroken',
    description: 'Practised on 30 consecutive days.',
    icon: '⚡',
    tier: 'platinum',
    xpReward: 750,
    criteria: { type: 'streak_days', count: 30 },
  },
  {
    slug: 'topic-collector',
    name: 'Topic Collector',
    description: 'Reached mastery on 10 topics.',
    icon: '📚',
    tier: 'gold',
    xpReward: 300,
    criteria: { type: 'topics_mastered', count: 10 },
  },
  {
    slug: 'tcs-ready',
    name: 'TCS Ready',
    description: 'Reached 80% readiness for TCS.',
    icon: '🔵',
    tier: 'gold',
    xpReward: 350,
    criteria: { type: 'company_readiness', companySlug: 'tcs', readiness: 80 },
    companySlug: 'tcs',
  },
  {
    slug: 'amazon-ready',
    name: 'Amazon Ready',
    description: 'Reached 80% readiness for Amazon.',
    icon: '🟠',
    tier: 'platinum',
    xpReward: 600,
    criteria: { type: 'company_readiness', companySlug: 'amazon', readiness: 80 },
    companySlug: 'amazon',
  },
  {
    slug: 'infosys-ready',
    name: 'Infosys Ready',
    description: 'Reached 80% readiness for Infosys.',
    icon: '🔷',
    tier: 'gold',
    xpReward: 350,
    criteria: { type: 'company_readiness', companySlug: 'infosys', readiness: 80 },
    companySlug: 'infosys',
  },
];

export interface ChallengeSeed {
  slug: string;
  title: string;
  description: string;
  goalType: 'questions' | 'coding_problems' | 'mocks' | 'topics' | 'xp';
  goalCount: number;
  xpReward: number;
  /** Offset in days from the seeding date; the challenge runs for `durationDays`. */
  startsInDays: number;
  durationDays: number;
  companySlug?: string;
}

export const CHALLENGES: ChallengeSeed[] = [
  {
    slug: 'weekly-aptitude-sprint',
    title: 'Weekly Aptitude Sprint',
    description: 'Solve 50 aptitude or reasoning questions this week.',
    goalType: 'questions',
    goalCount: 50,
    xpReward: 250,
    startsInDays: 0,
    durationDays: 7,
  },
  {
    slug: 'weekly-code-five',
    title: 'Code Five',
    description: 'Get 5 coding problems accepted this week.',
    goalType: 'coding_problems',
    goalCount: 5,
    xpReward: 300,
    startsInDays: 0,
    durationDays: 7,
  },
  {
    slug: 'weekly-mock-double',
    title: 'Double Mock',
    description: 'Complete 2 full mock tests this week.',
    goalType: 'mocks',
    goalCount: 2,
    xpReward: 200,
    startsInDays: 0,
    durationDays: 7,
  },
  {
    slug: 'core-cs-consolidation',
    title: 'Core CS Consolidation',
    description: 'Reach mastery on 3 core CS topics in the next fortnight.',
    goalType: 'topics',
    goalCount: 3,
    xpReward: 350,
    startsInDays: 0,
    durationDays: 14,
  },
];
