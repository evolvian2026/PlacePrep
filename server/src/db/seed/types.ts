import type { Difficulty, Language, RoundType } from '../../types.js';

export interface OptionSeed {
  body: string;
  correct?: boolean;
  /** Shown to a student who picked this option and got it wrong. */
  whyWrong?: string;
}

export interface McqSeed {
  id: string;
  body: string;
  /** Topic slug from the taxonomy. */
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  expectedSeconds?: number;
  options: OptionSeed[];
  explanation: string;
  concept?: string;
  hint?: string;
  /** Round types this question is a good fit for. */
  roundTypes?: RoundType[];
  /** Company slugs; omit to make the question available to every company. */
  companies?: string[];
  frequentlyAsked?: boolean;
  multiSelect?: boolean;
}

export interface CodingSeed {
  id: string;
  title: string;
  body: string;
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  expectedSeconds?: number;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  allowedLanguages?: Language[];
  starterCode?: Partial<Record<Language, string>>;
  samples: { input: string; expected: string; explanation?: string }[];
  hidden: { input: string; expected: string }[];
  /**
   * Reference solution in Python. Also used by `npm run verify:questions`,
   * which executes it against every sample and hidden case.
   */
  referencePython: string;
  editorial: string;
  concept?: string;
  hint?: string;
  companies?: string[];
  frequentlyAsked?: boolean;
}
