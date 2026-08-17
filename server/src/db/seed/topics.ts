import type { TopicCategory } from '../../types.js';

export interface TopicSeed {
  slug: string;
  name: string;
  category: TopicCategory;
  estHours?: number;
  description?: string;
  subtopics?: { slug: string; name: string; estHours?: number }[];
}

/**
 * The platform-wide topic taxonomy. Rounds reference these by slug, so adding a
 * new company never requires new topic rows unless it tests something novel.
 */
export const TOPICS: TopicSeed[] = [
  // ── Quantitative aptitude ──────────────────────────────────────────────
  {
    slug: 'quantitative-aptitude',
    name: 'Quantitative Aptitude',
    category: 'aptitude',
    estHours: 18,
    description: 'Arithmetic and algebra as tested in placement aptitude papers.',
    subtopics: [
      { slug: 'number-systems', name: 'Number Systems', estHours: 3 },
      { slug: 'percentages', name: 'Percentages', estHours: 2 },
      { slug: 'ratio-proportion', name: 'Ratio & Proportion', estHours: 2 },
      { slug: 'profit-loss', name: 'Profit & Loss', estHours: 2 },
      { slug: 'time-speed-distance', name: 'Time, Speed & Distance', estHours: 3 },
      { slug: 'time-and-work', name: 'Time & Work', estHours: 2 },
      { slug: 'averages-mixtures', name: 'Averages & Mixtures', estHours: 2 },
      { slug: 'simple-compound-interest', name: 'Simple & Compound Interest', estHours: 2 },
      { slug: 'permutation-combination', name: 'Permutation & Combination', estHours: 3 },
      { slug: 'probability', name: 'Probability', estHours: 3 },
      { slug: 'mensuration', name: 'Mensuration', estHours: 2 },
    ],
  },
  {
    slug: 'data-interpretation',
    name: 'Data Interpretation',
    category: 'aptitude',
    estHours: 6,
    description: 'Reading tables, bar charts, pie charts and caselets under time pressure.',
    subtopics: [
      { slug: 'tables-and-charts', name: 'Tables & Charts', estHours: 3 },
      { slug: 'caselets', name: 'Caselets', estHours: 3 },
    ],
  },

  // ── Logical reasoning ─────────────────────────────────────────────────
  {
    slug: 'logical-reasoning',
    name: 'Logical Reasoning',
    category: 'reasoning',
    estHours: 14,
    description: 'Pattern, arrangement and deduction questions.',
    subtopics: [
      { slug: 'series-completion', name: 'Number & Letter Series', estHours: 2 },
      { slug: 'coding-decoding', name: 'Coding–Decoding', estHours: 2 },
      { slug: 'blood-relations', name: 'Blood Relations', estHours: 2 },
      { slug: 'seating-arrangement', name: 'Seating Arrangement', estHours: 3 },
      { slug: 'syllogisms', name: 'Syllogisms', estHours: 2 },
      { slug: 'direction-sense', name: 'Direction Sense', estHours: 1 },
      { slug: 'clocks-calendars', name: 'Clocks & Calendars', estHours: 2 },
      { slug: 'puzzles', name: 'Analytical Puzzles', estHours: 3 },
    ],
  },

  // ── Verbal ability ────────────────────────────────────────────────────
  {
    slug: 'verbal-ability',
    name: 'Verbal Ability',
    category: 'verbal',
    estHours: 10,
    description: 'English usage, comprehension and vocabulary.',
    subtopics: [
      { slug: 'reading-comprehension', name: 'Reading Comprehension', estHours: 3 },
      { slug: 'sentence-correction', name: 'Sentence Correction', estHours: 2 },
      { slug: 'para-jumbles', name: 'Para Jumbles', estHours: 2 },
      { slug: 'vocabulary', name: 'Vocabulary', estHours: 2 },
      { slug: 'synonyms-antonyms', name: 'Synonyms & Antonyms', estHours: 1 },
    ],
  },

  // ── Data structures & algorithms ──────────────────────────────────────
  {
    slug: 'arrays',
    name: 'Arrays',
    category: 'dsa',
    estHours: 10,
    description: 'Traversal, prefix sums, two pointers and sliding windows.',
    subtopics: [
      { slug: 'two-pointers', name: 'Two Pointers', estHours: 3 },
      { slug: 'sliding-window', name: 'Sliding Window', estHours: 3 },
      { slug: 'prefix-sums', name: 'Prefix Sums', estHours: 2 },
    ],
  },
  {
    slug: 'strings',
    name: 'Strings',
    category: 'dsa',
    estHours: 8,
    subtopics: [
      { slug: 'string-manipulation', name: 'String Manipulation', estHours: 3 },
      { slug: 'pattern-matching', name: 'Pattern Matching', estHours: 3 },
    ],
  },
  {
    slug: 'searching',
    name: 'Searching',
    category: 'dsa',
    estHours: 6,
    subtopics: [
      { slug: 'binary-search', name: 'Binary Search', estHours: 4 },
      { slug: 'binary-search-on-answer', name: 'Binary Search on Answer', estHours: 2 },
    ],
  },
  { slug: 'sorting', name: 'Sorting', category: 'dsa', estHours: 6 },
  { slug: 'recursion', name: 'Recursion & Backtracking', category: 'dsa', estHours: 8 },
  { slug: 'hashing', name: 'Hashing', category: 'dsa', estHours: 5 },
  { slug: 'linked-lists', name: 'Linked Lists', category: 'dsa', estHours: 6 },
  { slug: 'stacks-queues', name: 'Stacks & Queues', category: 'dsa', estHours: 6 },
  {
    slug: 'trees',
    name: 'Trees',
    category: 'dsa',
    estHours: 12,
    subtopics: [
      { slug: 'binary-trees', name: 'Binary Trees', estHours: 4 },
      { slug: 'binary-search-trees', name: 'Binary Search Trees', estHours: 4 },
      { slug: 'tree-traversals', name: 'Tree Traversals', estHours: 3 },
    ],
  },
  { slug: 'heaps', name: 'Heaps & Priority Queues', category: 'dsa', estHours: 5 },
  {
    slug: 'graphs',
    name: 'Graphs',
    category: 'dsa',
    estHours: 14,
    subtopics: [
      { slug: 'bfs-dfs', name: 'BFS & DFS', estHours: 4 },
      { slug: 'shortest-paths', name: 'Shortest Paths', estHours: 4 },
      { slug: 'topological-sort', name: 'Topological Sort', estHours: 3 },
    ],
  },
  {
    slug: 'dynamic-programming',
    name: 'Dynamic Programming',
    category: 'dsa',
    estHours: 18,
    subtopics: [
      { slug: 'dp-1d', name: '1-D DP', estHours: 5 },
      { slug: 'dp-knapsack', name: 'Knapsack Patterns', estHours: 5 },
      { slug: 'dp-strings', name: 'DP on Strings', estHours: 4 },
    ],
  },
  { slug: 'greedy', name: 'Greedy Algorithms', category: 'dsa', estHours: 6 },
  { slug: 'bit-manipulation', name: 'Bit Manipulation', category: 'dsa', estHours: 4 },
  { slug: 'complexity-analysis', name: 'Time & Space Complexity', category: 'dsa', estHours: 3 },

  // ── CS fundamentals ───────────────────────────────────────────────────
  {
    slug: 'oops',
    name: 'OOPS',
    category: 'cs_fundamentals',
    estHours: 8,
    subtopics: [
      { slug: 'inheritance', name: 'Inheritance', estHours: 2 },
      { slug: 'polymorphism', name: 'Polymorphism', estHours: 2 },
      { slug: 'encapsulation-abstraction', name: 'Encapsulation & Abstraction', estHours: 2 },
      { slug: 'solid-principles', name: 'SOLID Principles', estHours: 2 },
    ],
  },
  {
    slug: 'dbms',
    name: 'DBMS',
    category: 'database',
    estHours: 12,
    subtopics: [
      { slug: 'normalization', name: 'Normalization', estHours: 3 },
      { slug: 'transactions-acid', name: 'Transactions & ACID', estHours: 3 },
      { slug: 'indexing', name: 'Indexing', estHours: 2 },
      { slug: 'er-modelling', name: 'ER Modelling', estHours: 2 },
    ],
  },
  {
    slug: 'sql',
    name: 'SQL',
    category: 'database',
    estHours: 10,
    subtopics: [
      { slug: 'joins', name: 'Joins', estHours: 3 },
      { slug: 'aggregations', name: 'Aggregations & Grouping', estHours: 2 },
      { slug: 'subqueries', name: 'Subqueries', estHours: 2 },
      { slug: 'window-functions', name: 'Window Functions', estHours: 3 },
    ],
  },
  {
    slug: 'operating-systems',
    name: 'Operating Systems',
    category: 'cs_fundamentals',
    estHours: 12,
    subtopics: [
      { slug: 'process-management', name: 'Process Management', estHours: 3 },
      { slug: 'cpu-scheduling', name: 'CPU Scheduling', estHours: 3 },
      { slug: 'memory-management', name: 'Memory Management', estHours: 3 },
      { slug: 'deadlocks', name: 'Deadlocks', estHours: 2 },
      { slug: 'concurrency', name: 'Threads & Concurrency', estHours: 3 },
    ],
  },
  {
    slug: 'computer-networks',
    name: 'Computer Networks',
    category: 'cs_fundamentals',
    estHours: 10,
    subtopics: [
      { slug: 'osi-tcpip', name: 'OSI & TCP/IP Models', estHours: 2 },
      { slug: 'tcp-udp', name: 'TCP vs UDP', estHours: 2 },
      { slug: 'http-dns', name: 'HTTP & DNS', estHours: 2 },
      { slug: 'subnetting', name: 'IP Addressing & Subnetting', estHours: 2 },
    ],
  },
  {
    slug: 'programming-fundamentals',
    name: 'Programming Fundamentals',
    category: 'programming',
    estHours: 8,
    subtopics: [
      { slug: 'pointers-memory', name: 'Pointers & Memory', estHours: 3 },
      { slug: 'output-prediction', name: 'Output Prediction', estHours: 2 },
      { slug: 'error-identification', name: 'Error Identification', estHours: 2 },
    ],
  },
  {
    slug: 'system-design-basics',
    name: 'System Design Basics',
    category: 'system_design',
    estHours: 14,
    subtopics: [
      { slug: 'scalability', name: 'Scalability & Load Balancing', estHours: 4 },
      { slug: 'caching', name: 'Caching', estHours: 3 },
      { slug: 'db-sharding', name: 'Sharding & Replication', estHours: 3 },
      { slug: 'api-design', name: 'API Design', estHours: 3 },
    ],
  },
  { slug: 'projects-resume', name: 'Projects & Resume Deep-dive', category: 'behavioural', estHours: 6 },

  // ── Behavioural / HR ──────────────────────────────────────────────────
  {
    slug: 'hr-interview',
    name: 'HR Interview',
    category: 'behavioural',
    estHours: 6,
    subtopics: [
      { slug: 'self-introduction', name: 'Self Introduction', estHours: 1 },
      { slug: 'behavioural-questions', name: 'Behavioural Questions', estHours: 2 },
      { slug: 'situational-questions', name: 'Situational Questions', estHours: 2 },
      { slug: 'company-specific-questions', name: 'Company-specific Questions', estHours: 1 },
    ],
  },
  {
    slug: 'leadership-principles',
    name: 'Leadership Principles & Culture Fit',
    category: 'behavioural',
    estHours: 5,
    subtopics: [{ slug: 'star-method', name: 'STAR Method Answers', estHours: 2 }],
  },
  { slug: 'group-discussion', name: 'Group Discussion', category: 'behavioural', estHours: 3 },
];
