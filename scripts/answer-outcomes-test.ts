/**
 * WHICH DOOR BRINGS THE BUYER — AND WHICH COMPARISONS ARE REFUSED.
 *
 * The rollup in `lib/freehold/answer-outcomes.ts` folds stored form answers
 * into one card per segmenting question and hands each answer to
 * `weighAudiences` as if it were an audience. These assertions defend the
 * three refusals that make the card honest:
 *
 *   · a free-text question is never ranked — folding it would rank sentences;
 *   · an answer one person gave is a person, not a segment;
 *   · a door whose leads nobody called reads `unanswered`, never `worse`.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  rollupAnswerLeads, parseStoredAnswers,
  SHARED_MIN, MIN_SEGMENTS, MAX_SEGMENT_OPTIONS,
  type AnsweredLead,
} from '../lib/freehold/answer-outcomes'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const SEG = 'وش أهم شي تدور عليه؟'
const lead = (answer: string, status: string | null, responseMinutes: number | null = 5): AnsweredLead => ({
  answers: [{ key: 'q1', question: SEG, answer }],
  status,
  responseMinutes,
})
const many = (n: number, make: (i: number) => AnsweredLead): AnsweredLead[] =>
  Array.from({ length: n }, (_, i) => make(i))

console.log('\n── stored jsonb is never trusted ──')
{
  check('null is no answers', parseStoredAnswers(null).length === 0)
  check('a JSON string parses', parseStoredAnswers('[{"key":"k","question":"q","answer":"a"}]').length === 1)
  check('broken JSON is no answers, not a crash', parseStoredAnswers('{oops').length === 0)
  check('rows missing words are dropped',
    parseStoredAnswers([{ key: 'k', question: 'q', answer: '' }, { key: 'k', question: '', answer: 'a' }]).length === 0)
}

console.log('\n── what is refused a ranking ──')
{
  // Free text: every person their own sentence — nothing shared, no card.
  const free = many(6, (i) => lead(`my own words ${i}`, 'qualified'))
  check('a question whose every answer is unique produces no card',
    rollupAnswerLeads(free).length === 0)

  // One door with traffic is not a segmentation.
  const oneDoor = [...many(4, () => lead('door A', 'new')), lead('door B', 'new')]
  check(`one shared answer is below MIN_SEGMENTS (${MIN_SEGMENTS}) — no card`,
    rollupAnswerLeads(oneDoor).length === 0)

  // Free text that happens to repeat, in bulk, is still free text.
  const noisy: AnsweredLead[] = []
  for (let d = 0; d < MAX_SEGMENT_OPTIONS + 1; d++) noisy.push(...many(SHARED_MIN, () => lead(`variant ${d}`, 'new')))
  check(`more than MAX_SEGMENT_OPTIONS (${MAX_SEGMENT_OPTIONS}) shared answers — no card`,
    rollupAnswerLeads(noisy).length === 0)

  check('an empty account is an empty list', rollupAnswerLeads([]).length === 0)
}

console.log('\n── a person is not a segment ──')
{
  const rows = rollupAnswerLeads([
    ...many(5, () => lead('دخل ثابت', 'qualified')),
    ...many(5, () => lead('خطة سداد', 'new')),
    lead('إجابة كتبها شخص واحد', 'closed'),
  ])
  check('the two doors with traffic make a card', rows.length === 1)
  const card = rows[0]
  check('the one-person answer is not a row',
    !card.answers.some((a) => a.answer === 'إجابة كتبها شخص واحد'),
    card.answers.map((a) => a.answer).join(', '))
  check('…but its person is counted in the question total',
    card.leads === 11, String(card.leads))
}

console.log('\n── the verdict is the audience-weight verdict ──')
{
  // A field of 40 with clean separation: door A qualifies 80%, door B 5%.
  const rows = rollupAnswerLeads([
    ...many(20, (i) => lead('door A', i < 16 ? 'qualified' : 'new')),
    ...many(20, (i) => lead('door B', i < 1 ? 'qualified' : 'new')),
  ])
  const a = rows[0].answers.find((x) => x.answer === 'door A')!
  const b = rows[0].answers.find((x) => x.answer === 'door B')!
  check('the door the buyers walk through reads better', a.verdict === 'better', a.verdict)
  check('the door they do not reads worse', b.verdict === 'worse', b.verdict)
  check('the comparison names its rung', a.rung === 'qualified', a.rung)
  check('best outcomes sort first', rows[0].answers[0].answer === 'door A')

  // Same shape, but door B's leads waited far longer than door A's: the rota
  // is asked first, and the answer is about the desk, not the door.
  const waited = rollupAnswerLeads([
    ...many(20, (i) => lead('door A', i < 16 ? 'qualified' : 'new', 5)),
    ...many(20, (i) => lead('door B', i < 1 ? 'qualified' : 'new', 600)),
  ])
  const bw = waited[0].answers.find((x) => x.answer === 'door B')!
  check('a door whose leads waited reads unanswered, never worse', bw.verdict === 'unanswered', bw.verdict)

  // Two doors, four people: nothing separates on a sample that small.
  const thin = rollupAnswerLeads([
    ...many(SHARED_MIN, () => lead('door A', 'qualified')),
    ...many(SHARED_MIN, () => lead('door B', 'new')),
  ])
  const thinVerdicts = thin[0].answers.map((x) => x.verdict)
  check('a thin sample claims nothing',
    thinVerdicts.every((v) => v !== 'better' && v !== 'worse'), thinVerdicts.join(', '))
}

console.log('\n── one question across two forms ──')
{
  // The successor form (forms are immutable — duplication is the only edit)
  // carries the same question text under a different Meta key. One record.
  const rows = rollupAnswerLeads([
    ...many(3, () => ({ answers: [{ key: 'q1', question: SEG, answer: 'دخل ثابت' }], status: 'qualified', responseMinutes: 5 })),
    ...many(3, () => ({ answers: [{ key: 'q9_new_form', question: SEG, answer: 'خطة سداد' }], status: 'new', responseMinutes: 5 })),
  ])
  check('the same question text folds into one card', rows.length === 1 && rows[0].leads === 6,
    `${rows.length} cards, ${rows[0]?.leads} leads`)
}

console.log('\n── the card is wired, not just written ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/lead-machine/forms/page.tsx'), 'utf8')
  check('the forms page reads answerOutcomes', /answerOutcomes\(\)/.test(page))
  check('…and renders the verdicts in words', /lm\.forms\.answers\.better/.test(page) && /lm\.forms\.answers\.unanswered/.test(page))
}

if (failures > 0) {
  console.error(`\n${failures} answer-outcomes guard(s) broken.`)
  process.exit(1)
}
console.log('\nEvery door is measured, no door is cut, and a slow desk is never blamed on the buyer.\n')
