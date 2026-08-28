/**
 * Behavioural interview prompts.
 *
 * These are the questions that actually come up in campus HR and managerial
 * rounds, phrased the way an interviewer phrases them. The guidance says what
 * a good answer contains — not a model answer to copy, because an interviewer
 * can tell, and because a borrowed story falls apart on the first follow-up.
 */
export interface InterviewPromptSeed {
  slug: string;
  prompt: string;
  category: 'behavioural' | 'situational' | 'motivation' | 'teamwork' | 'failure' | 'leadership';
  guidance: string;
}

export const INTERVIEW_PROMPTS: InterviewPromptSeed[] = [
  {
    slug: 'tell-me-about-yourself',
    prompt: 'Tell me about yourself.',
    category: 'motivation',
    guidance:
      'Ninety seconds, not five minutes. Where you are studying, one or two things you have actually built or done, and why that leads to this role. Skip your schooling history — they have your resume.',
  },
  {
    slug: 'time-you-failed',
    prompt: 'Tell me about a time you failed.',
    category: 'failure',
    guidance:
      'Pick a real failure with real consequences, own your part in it without blaming teammates, and spend most of the answer on what you changed afterwards and the evidence that the change worked. A "failure" that is secretly a strength reads as evasive.',
  },
  {
    slug: 'conflict-in-a-team',
    prompt: 'Describe a disagreement you had with a teammate. How did it end?',
    category: 'teamwork',
    guidance:
      'Show that you understood their position before arguing yours. Interviewers are checking whether you can disagree without it becoming personal, and whether you can be wrong gracefully.',
  },
  {
    slug: 'hardest-technical-problem',
    prompt: 'What is the hardest technical problem you have solved?',
    category: 'behavioural',
    guidance:
      'Choose something you can still explain in detail, because the follow-up questions go deep. Say what made it hard, what you tried that did not work, and how you finally got there.',
  },
  {
    slug: 'why-this-company',
    prompt: 'Why do you want to join this company?',
    category: 'motivation',
    guidance:
      'Something specific to them — a product, a team, a technology they work on. Generic praise about "great culture" and "learning opportunities" is what everyone else says, and interviewers notice.',
  },
  {
    slug: 'leadership-without-authority',
    prompt: 'Tell me about a time you led something without being in charge.',
    category: 'leadership',
    guidance:
      'A project, a fest, a study group. What you did to get people moving when you could not simply instruct them, and what actually shipped as a result.',
  },
  {
    slug: 'tight-deadline',
    prompt: 'Describe a time you had to deliver under a deadline you could not move.',
    category: 'situational',
    guidance:
      'The interesting part is what you chose to cut and why. Show the trade-off, not heroics about staying up all night.',
  },
  {
    slug: 'strength-and-weakness',
    prompt: 'What is your greatest weakness?',
    category: 'behavioural',
    guidance:
      'Name a genuine one that does not disqualify you for the role, and be concrete about what you are doing about it. "I work too hard" wastes the question and the interviewer has heard it hundreds of times.',
  },
  {
    slug: 'feedback-you-received',
    prompt: 'What is the most useful criticism you have received?',
    category: 'behavioural',
    guidance:
      'Say what the feedback was, that it stung, and what you did differently afterwards. The answer is about whether you are coachable.',
  },
  {
    slug: 'questions-for-us',
    prompt: 'Do you have any questions for us?',
    category: 'motivation',
    guidance:
      'Always have two. Ask about the work — what the team is building, what the first six months look like, how success is measured. Do not ask about salary or leave in a campus interview.',
  },
];

/** The rubric a student reviews their own draft against. */
export const STAR_RUBRIC = [
  {
    key: 'specific',
    label: 'Specific, not generic',
    hint: 'Names a real situation with real detail, not "in a project once".',
  },
  {
    key: 'ownership',
    label: 'Your contribution is clear',
    hint: 'It is obvious what you did, as opposed to what the team did.',
  },
  {
    key: 'result',
    label: 'Ends with an outcome',
    hint: 'Says what changed, ideally with something measurable.',
  },
  {
    key: 'length',
    label: 'Right length',
    hint: 'Roughly 60 to 120 seconds spoken. Long enough to be concrete, short enough to hold attention.',
  },
] as const;
