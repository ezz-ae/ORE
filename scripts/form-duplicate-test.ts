/**
 * Duplicating a lead form, locked.
 *
 * "Duplicate" crashed with "Cannot read properties of undefined (reading
 * 'filter')" the moment the copied form contained a custom question. The
 * quick-duplicate popup carried only a question's type and label, then handed
 * that half-object to customToMetaQuestion() through an `as never` cast — so
 * the function read `q.options.filter(...)` off a value that was never there
 * and the whole popup died. A cast is not a guarantee; it only silences the
 * compiler that would have said so.
 *
 * Two things are locked here:
 *   1. A question with no options and no kind is a free-text question, not a
 *      crash.
 *   2. A multiple-choice question keeps its choices AND its key through the
 *      copy. Losing the choices turns a "What is your budget?" dropdown into
 *      an empty text box; losing the key breaks the CRM column the original
 *      question already fills.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { customToMetaQuestion, mapFormToBuilder, questionsForMeta } from '../lib/meta/form-templates'
import type { MetaFormQuestion, MetaLeadForm } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── a half-built question is free text, never a crash ──')
{
  // Exactly what the duplicate popup hands over: a label and nothing else.
  const q = customToMetaQuestion({ label: 'When are you buying?' }, 0)
  check('no options, no kind → a question comes back', !!q && q.type === 'CUSTOM', JSON.stringify(q))
  check('…as free text', q.options === undefined, JSON.stringify(q))
  check('…with a key derived from the label', q.key === 'custom_when_are_you_buying', String(q.key))

  check('an empty options list is free text too',
    customToMetaQuestion({ label: 'Notes', options: [] }, 0).options === undefined)
  check('options that are all blank are free text too',
    customToMetaQuestion({ label: 'Notes', options: ['', '  '] }, 0).options === undefined)
  check('an unnamed question still gets a usable key',
    customToMetaQuestion({ label: '' }, 3).key === 'custom_opt_4',
    String(customToMetaQuestion({ label: '' }, 3).key))
}

console.log('\n── a multiple-choice question survives the copy whole ──')
{
  const q = customToMetaQuestion(
    { label: 'Your budget?', key: 'budget_range', options: ['Under 1M', '1M – 3M', 'Over 3M'] },
    0,
  )
  check('it stays a choice question', (q.options ?? []).length === 3, JSON.stringify(q.options))
  check('…the choices read exactly as the original',
    (q.options ?? []).map((o) => o.label).join('|') === 'Under 1M|1M – 3M|Over 3M',
    JSON.stringify(q.options))
  check('…every choice has its own value', new Set((q.options ?? []).map((o) => o.value)).size === 3)
  check('…and the source key is kept, not regenerated', q.key === 'budget_range', String(q.key))

  // Two choices that slug to the same value must not collide into one answer.
  const dup = customToMetaQuestion({ label: 'Area', options: ['Dubai Marina', 'dubai marina'] }, 0)
  check('two choices that read alike still get distinct values',
    new Set((dup.options ?? []).map((o) => o.value)).size === 2,
    JSON.stringify(dup.options))
}

console.log('\n── reading a real Meta form back is never assumed-complete ──')
{
  // Meta's older field set returns questions without options; the basic read
  // set returns no thank-you page or intro at all. None of it may throw.
  const bare = { id: '1', name: 'Old form', questions: [{ type: 'CUSTOM', key: 'k', label: 'Q' }] }
  const imp = mapFormToBuilder(bare as unknown as MetaLeadForm)
  check('a custom question with no options maps to an editable text question',
    imp.customs.length === 1 && imp.customs[0].kind === 'text' && Array.isArray(imp.customs[0].options),
    JSON.stringify(imp.customs))
  check('…and it can be sent straight back to Meta',
    customToMetaQuestion(imp.customs[0], 0).type === 'CUSTOM')

  const empty = mapFormToBuilder({ id: '2', name: 'Nothing' } as unknown as MetaLeadForm)
  check('a form with no questions at all falls back to name/email/phone',
    empty.contact.length === 3, JSON.stringify(empty.contact))
  check('…and reports the missing pieces rather than inventing them',
    empty.intro === null && empty.thankYou === null && empty.higherIntent === null)
}

console.log('\n── Meta writes its own wording for name / email / phone ──')
{
  // Reading a form back gives EVERY question a label, prefill ones included.
  // Sending that shape back is what Meta rejects with
  // "Parameter label cannot be specified for non-custom questions" (1892063) —
  // and it rejects the WHOLE form, so one stray label loses the duplicate.
  const readBack: MetaFormQuestion[] = [
    { type: 'FULL_NAME', label: 'Full name' } as MetaFormQuestion,
    { type: 'PHONE', label: 'Phone number', key: 'phone' } as MetaFormQuestion,
    { type: 'CUSTOM', key: 'budget_range', label: 'Your budget?', options: [{ value: 'a', label: 'Under 1M' }] },
  ]
  const out = questionsForMeta(readBack)
  check('a prefill question is sent as its type alone',
    Object.keys(out[0]).length === 1 && out[0].type === 'FULL_NAME', JSON.stringify(out[0]))
  check('…no label, no key, on any of them',
    out.slice(0, 2).every((q) => q.label === undefined && q.key === undefined), JSON.stringify(out))
  check('the custom question keeps its label, key and options',
    out[2].label === 'Your budget?' && out[2].key === 'budget_range' && (out[2].options ?? []).length === 1,
    JSON.stringify(out[2]))
  check('nothing is dropped from the form', out.length === 3)
}

if (failures > 0) {
  console.error(`\n${failures} form-duplication rule(s) broken.`)
  process.exit(1)
}
console.log('\nDuplicating a form copies the form.\n')
