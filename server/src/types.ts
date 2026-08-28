/** Shared domain vocabulary. Kept in one place so the client can mirror it. */

export type Role = 'student' | 'faculty' | 'admin' | 'super_admin';
export type CompanyType = 'service' | 'product';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type CompanyDifficulty = 'easy' | 'moderate' | 'hard' | 'very_hard';
export type Provenance = 'verified' | 'community_reported' | 'historical';
export type QuestionType = 'mcq' | 'multi_select' | 'numeric' | 'coding' | 'subjective';
export type TestScope = 'quick' | 'sectional' | 'round' | 'company';
export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';
export type StudentCompanyStatus = 'interested' | 'preparing' | 'completed' | 'shortlisted';
export type RoundType =
  | 'aptitude'
  | 'coding'
  | 'technical_mcq'
  | 'technical_interview'
  | 'system_design'
  | 'group_discussion'
  | 'hr_interview'
  | 'managerial'
  | 'psychometric'
  | 'other';
export type TopicCategory =
  | 'aptitude'
  | 'reasoning'
  | 'verbal'
  | 'dsa'
  | 'cs_fundamentals'
  | 'programming'
  | 'database'
  | 'system_design'
  | 'behavioural'
  | 'other';
export type Language = 'c' | 'cpp' | 'java' | 'python' | 'javascript';
export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'compile_error'
  | 'runtime_error'
  | 'time_limit_exceeded'
  | 'partial'
  | 'unsupported_language'
  | 'internal_error';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

/** A question as assembled into a live paper — never carries the answer key. */
export interface PaperQuestion {
  questionId: number;
  publicId: string;
  questionType: QuestionType;
  body: string;
  difficulty: Difficulty;
  topic: string | null;
  topicId: number | null;
  subtopic: string | null;
  marks: number;
  negativeMarks: number;
  expectedSeconds: number;
  /** Option labels in the order this student sees them. */
  options: { label: string; body: string }[];
  coding?: {
    problemId: number;
    title: string;
    inputFormat: string | null;
    outputFormat: string | null;
    constraints: string | null;
    timeLimitMs: number;
    memoryLimitMb: number;
    allowedLanguages: Language[];
    starterCode: Record<string, string>;
    samples: { input: string; expected: string; explanation: string | null }[];
  };
}

export interface PaperSection {
  key: string;
  name: string;
  sequence: number;
  durationMinutes: number | null;
  marksPerQuestion: number;
  negativeMarks: number;
  questionKind: string;
  questions: PaperQuestion[];
}

export interface Paper {
  sections: PaperSection[];
  shuffleOptions: boolean;
  sectionLock: boolean;
  generatedAt: string;
  /**
   * How many of this paper's questions the student has answered before.
   * Reported rather than hidden: once a topic's pool is exhausted a repeat is
   * unavoidable, and a score built on recalled questions should say so.
   */
  seenBefore?: number;
}

/** Selection rule stored on a mock-test section and used by the question engine. */
export interface SelectionRule {
  topicIds?: number[];
  topicSlugs?: string[];
  categories?: TopicCategory[];
  roundType?: RoundType;
  questionTypes?: QuestionType[];
  /** Distribution of difficulties; values are question counts. */
  difficultyMix?: Partial<Record<Difficulty, number>>;
  /** Restrict to questions tagged for the test's company. */
  companyOnly?: boolean;
  frequentlyAsked?: boolean;
  excludeQuestionIds?: number[];
}
