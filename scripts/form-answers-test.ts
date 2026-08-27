/**
 * EVERY ANSWER SURVIVES, IN WORDS — AND THE SEGMENT FORM HOLDS ITS SHAPE.
 *
 * buyer-eligibility.ts rescued one question. Everything else an operator's
 * form collected — the segment choice, the budget band, the line written by
 * hand — still died at the sync, so a five-question segmentation instrument
 * delivered name, phone, email. These assertions defend:
 *
 *   · resolution: a broker reads words, never `opt_2`;
 *   · the contact exclusion: the answers card must not repeat the phone book;
 *   · the segmented template's structure, whose slot ORDER is load-bearing.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { resolveFormAnswers, answersForCard, type FormQuestionDef } from '../lib/freehold/form-answers'
import {
  FORM_TEMPLATES, buildSegmentPreset, buildInOwnWordsPreset, buildPreset,
} from '../lib/meta/form-templates'
import { p_forms } from '../lib/i18n/dictionaries/p_forms'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const f = (name: string, v: string) => ({ name, values: [v] })
const Q: FormQuestionDef[] = [
  { key: 'buyer_segment', label: 'وش أهم شي تدور عليه؟', options: [
    { value: 'opt_1', label: 'دخل ثابت يُصرف بشيكات من يوم التعاقد' },
    { value: 'opt_2', label: 'خطة سداد تناسب دخلي الشهري' },
  ] },
  { key: 'budget_range', label: 'Budget', options: [{ value: 'under_750k', label: 'Under AED 750K' }] },
  { key: 'in_own_words', label: 'بكلمتك — وش بالضبط تدور عليه؟' },
]

console.log('\n── words, never slugs ──')
{
  const a = resolveFormAnswers([f('buyer_segment', 'opt_2')], Q)
  check('an Arabic form\'s opt_N resolves to the option label the person saw',
    a.length === 1 && a[0].answer === 'خطة سداد تناسب دخلي الشهري', JSON.stringify(a))
  check('…under the question label, not the key', a[0].question === 'وش أهم شي تدور عليه؟')
  check('an English slug resolves the same way',
    resolveFormAnswers([f('budget_range', 'under_750k')], Q)[0].answer === 'Under AED 750K')
  check('a value Meta returned as the LABEL still resolves',
    resolveFormAnswers([f('buyer_segment', 'خطة سداد تناسب دخلي الشهري')], Q)[0].answer === 'خطة سداد تناسب دخلي الشهري')
  check('free text passes through verbatim',
    resolveFormAnswers([f('in_own_words', 'أبي شقة غرفتين قريبة من شغلي')], Q)[0].answer === 'أبي شقة غرفتين قريبة من شغلي')
}

console.log('\n── degrades to raw, never to nothing ──')
{
  const a = resolveFormAnswers([f('buyer_segment', 'opt_2')], [])
  check('with no form definition the answer still stores — raw value, and a house key gets its NAME',
    a.length === 1 && a[0].answer === 'opt_2' && a[0].question === 'Buyer type', JSON.stringify(a))
  check('a foreign custom key still prettifies rather than dropping',
    resolveFormAnswers([f('my_weird_question', 'x')], [])[0].question === 'my weird question')
  check('an unknown option value keeps the raw value',
    resolveFormAnswers([f('buyer_segment', 'opt_9')], Q)[0].answer === 'opt_9')
  check('an empty answer is a skipped question, not a stored blank',
    resolveFormAnswers([f('buyer_segment', '  ')], Q).length === 0)
  check('null everywhere is an empty list',
    resolveFormAnswers(null, null).length === 0)
}

console.log('\n── the phone book stays out ──')
{
  const mixed = resolveFormAnswers([
    f('full_name', 'Ahmed'), f('phone_number', '05x'), f('email', 'a@b.c'),
    f('Phone number (WhatsApp)', '05x'), f('work-email', 'w@b.c'),
    f('buyer_segment', 'opt_1'),
  ], Q)
  check('every contact shape is excluded, the answer survives',
    mixed.length === 1 && mixed[0].key === 'buyer_segment', JSON.stringify(mixed))
  check('the eligibility answer is stored but skipped on the generic card',
    answersForCard([{ key: 'ownership_eligibility', question: 'q', answer: 'a' },
                    { key: 'buyer_segment', question: 'q', answer: 'a' }]).length === 1)
}

console.log('\n── the segmented template holds its shape ──')
{
  const t = (k: string) => p_forms.en[k] ?? k
  const seg = buildSegmentPreset(t as never)
  check('five options, each a segment', seg.options.length === 5, seg.options.join(' | '))
  check('slot 1 is the campaign\'s own core promise — careless taps get the default pitch',
    seg.options[0] === p_forms.en['pforms.segment.yield'], seg.options[0])
  check('the golden-visa option prices itself, so it cannot mis-sell a cheaper unit',
    /2M\+|2 مليون|2 млн/.test(p_forms.en['pforms.segment.goldenVisa']))
  for (const locale of ['en', 'ar', 'ru'] as const) {
    check(`${locale}: the golden-visa option carries its own price floor`,
      /2M\+|2 مليون|2 млн/.test(p_forms[locale]['pforms.segment.goldenVisa']),
      p_forms[locale]['pforms.segment.goldenVisa'])
  }
  check('no option is the universal-appeal one that measures agreeableness',
    !seg.options.some((o) => /آمن|safe|надеж/i.test(o)), seg.options.join(' | '))

  // THE NAME AND THE QUESTION ARE DIFFERENT STRINGS. The picker chip inside
  // the system says what the preset IS ("Buyer type — 5 segments"); the label
  // the person answers is the sentence. One key serving both put a full
  // question on a chip, which names nothing.
  check('the picker name is a name, not the question sentence',
    p_forms.en['pforms.preset.segment'] !== p_forms.en['pforms.segment.q'] &&
    !p_forms.en['pforms.preset.segment'].includes('?'))
  check('…and the person-facing label is the question key',
    seg.label === p_forms.en['pforms.segment.q'], seg.label)

  const words = buildInOwnWordsPreset(t as never)
  check('the hand-written line is open text', words.kind === 'text' && words.options.length === 0)
  check('…its picker name and question are split the same way',
    p_forms.en['pforms.preset.ownWords'] !== p_forms.en['pforms.ownWords.q'] &&
    words.label === p_forms.en['pforms.ownWords.q'])
  check('the template name says what it does, in every language',
    (['en', 'ar', 'ru'] as const).every((l) =>
      (p_forms[l]['pforms.tpl.segmented'] ?? '').length > 0 &&
      !/segmented buyer|مشترٍ مصنَّف|Сегментированный покупатель/i.test(p_forms[l]['pforms.tpl.segmented'])))
  check('…under a stable key the CRM can recognise', words.key === 'in_own_words')

  const tpl = FORM_TEMPLATES.find((x) => x.key === 'segmented')!
  check('the template exists', Boolean(tpl))
  check('higher intent is non-negotiable on a filter form', tpl.higherIntent === true)
  check('profession rides as a prefill (JOB_TITLE), costing one tap',
    tpl.contact.includes('JOB_TITLE'))
  check('name, phone, email are all asked',
    ['FULL_NAME', 'PHONE', 'EMAIL'].every((c) => tpl.contact.includes(c as never)))
  check('question order: segment → own words → budget → timeline',
    tpl.presets.join(',') === 'segment,ownWords,budget,timeline', tpl.presets.join(','))
  check('buildPreset dispatches both new keys',
    buildPreset('segment', {}, t as never).key === 'buyer_segment' &&
    buildPreset('ownWords', {}, t as never).key === 'in_own_words')
}

console.log('\n── the sync keeps it, resolved, and backfills ──')
{
  const sync = readFileSync(join(process.cwd(), 'lib/freehold/meta-lead-sync.ts'), { encoding: 'utf8' })
  check('the column exists', /meta_answers jsonb/.test(sync))
  check('answers are resolved against the form\'s own questions, read best-effort',
    /getLeadForm\(formId\)[\s\S]{0,200}\.catch\(\(\) => \[\]\)/.test(sync))
  check('the insert stores resolved answers', /resolveFormAnswers\(lead\.field_data, formQuestions\)/.test(sync))
  check('the sweep backfills, COALESCE so words are never overwritten by a later blank',
    /SET meta_answers = COALESCE\(meta_answers, \$2::jsonb\)/.test(sync))

  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/crm/leads/[id]/page.tsx'), { encoding: 'utf8' })
  check('the broker card renders through answersForCard, so eligibility is never shown twice',
    /answersForCard\(/.test(page))
  check('…with the source note', /crm\.formAnswersNote/.test(page))
}

if (failures > 0) {
  console.error(`\n${failures} form-answers guard(s) broken.`)
  process.exit(1)
}
console.log('\nEvery answer reaches the broker, in the words the person chose.\n')
