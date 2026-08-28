/**
 * Structural checks over the MCQ bank.
 *
 * The schema in load-questions.ts covers shape. This covers the mistakes that
 * are still valid JSON but wrong for a student: an explanation that contradicts
 * the marked answer, two identical options, a "why wrong" note attached to the
 * correct one, a topic slug that does not exist.
 *
 * What it cannot check is whether a conceptual claim is true. That limit is
 * real and worth stating plainly rather than implying the bank is verified.
 */
import { loadMcqBank } from '../src/db/seed/load-questions.js';
import { TOPICS } from '../src/db/seed/topics.js';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** So "all seven references fault" is not read as contradicting the answer 7. */
const NUMBER_WORDS: Record<number, string> = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six',
  7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve',
};

const slugs = new Set<string>();
for (const topic of TOPICS) {
  slugs.add(topic.slug);
  for (const sub of topic.subtopics ?? []) slugs.add(sub.slug);
}

const bank = loadMcqBank();
const problems: string[] = [];
const fail = (id: string, message: string) => problems.push(`${id}: ${message}`);

for (const question of bank) {
  const correct = question.options.filter((option) => option.correct);
  const wrong = question.options.filter((option) => !option.correct);

  if (!slugs.has(question.topic)) fail(question.id, `unknown topic slug "${question.topic}"`);
  if (question.subtopic && !slugs.has(question.subtopic)) {
    fail(question.id, `unknown subtopic slug "${question.subtopic}"`);
  }

  // A correct option carrying a "why this is wrong" note means the flags and
  // the prose disagree; one of them is a mistake and a student sees both.
  for (const option of correct) {
    if (option.whyWrong) fail(question.id, 'the correct option carries a whyWrong note');
  }

  const bodies = question.options.map((option) => option.body.trim().toLowerCase());
  if (new Set(bodies).size !== bodies.length) fail(question.id, 'two options have the same text');

  // Every distractor should say why it is wrong — that per-option feedback is
  // the thing that makes practice teach rather than just score.
  const missing = wrong.filter((option) => !option.whyWrong).length;
  if (missing > 0 && wrong.length > 0) {
    fail(question.id, `${missing} of ${wrong.length} distractors have no whyWrong note`);
  }

  if (question.explanation.trim().length < 30) fail(question.id, 'explanation is too short to teach anything');

  // Catches the failure we actually hit once: an explanation that concludes a
  // different answer from the one flagged correct.
  //
  // Deliberately narrow. It only runs when the answer is a plain integer, and
  // it accepts the digits or the English word, because an explanation that
  // ends "all seven references fault" is not a contradiction of the answer 7.
  // A check that cries wolf gets ignored, which is worse than not having it.
  if (correct.length === 1 && question.options.length >= 3) {
    const answer = correct[0].body.trim();
    if (/^-?\d{1,4}$/.test(answer)) {
      const value = Number(answer);
      const asWord = NUMBER_WORDS[Math.abs(value)];
      const explanation = question.explanation.toLowerCase();
      const present =
        new RegExp(`(^|[^\\d])${answer}([^\\d]|$)`).test(question.explanation) ||
        (asWord !== undefined && explanation.includes(asWord));
      const others = wrong
        .map((option) => option.body.trim())
        .filter((other) => /^-?\d{1,4}$/.test(other))
        .filter((other) => new RegExp(`(^|[^\\d])${other}([^\\d]|$)`).test(question.explanation));
      if (!present && others.length > 0) {
        fail(question.id, `explanation names ${others.join('/')} but never the marked answer "${answer}"`);
      }
    }
  }

  if (question.options.length > OPTION_LABELS.length) fail(question.id, 'more options than labels');
}

const byTopic = new Map<string, number>();
for (const question of bank) {
  const key = question.subtopic ?? question.topic;
  byTopic.set(key, (byTopic.get(key) ?? 0) + 1);
}

console.log(`questions checked : ${bank.length}`);
console.log(`distinct topics   : ${byTopic.size}`);
console.log(`problems          : ${problems.length}`);
if (problems.length) {
  console.log('');
  for (const problem of problems.slice(0, 40)) console.log(`  ${problem}`);
  if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
}
console.log(
  problems.length === 0
    ? '\nStructurally sound. Note: this cannot verify that a conceptual claim is true.'
    : '',
);
process.exit(problems.length === 0 ? 0 : 1);
