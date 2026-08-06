/**
 * A close button that cannot lose a live problem.
 *
 * "Later" only earns its name if it genuinely brings the thing back. If it
 * quietly destroys like an X does, it is worse than the X — the X at least
 * tells the truth about what it does.
 *
 * And the learning has to be a MEASUREMENT, not a nudge wearing one. Exit is
 * shown first, which is the order asked for and is deliberately not tuned in
 * Later's favour: putting the preferred option first decides the outcome and
 * then presents it as the person's own preference.
 *
 * Pure — no DOM, no storage. Runs in `pnpm guards`.
 */
import { settledChoice, LEARN_AFTER } from '../components/freehold/dismiss-control'
import { readFileSync } from 'node:fs'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── both verbs stay up until a real preference exists ──')
{
  check('nothing is decided on the first close',
    settledChoice({ exit: 1, later: 0 }) === null, String(settledChoice({ exit: 1, later: 0 })))
  check('…nor one short of the threshold',
    settledChoice({ exit: 3, later: 1 }) === null, String(settledChoice({ exit: 3, later: 1 })))
  check('a fresh browser starts with both', settledChoice({ exit: 0, later: 0 }) === null)
  check('the threshold is the documented one', LEARN_AFTER === 5, String(LEARN_AFTER))
}

console.log('\n── the verb someone actually uses takes the slot ──')
{
  check('a consistent closer keeps the X',
    settledChoice({ exit: 5, later: 0 }) === 'exit')
  check('a consistent deferrer gets the clock',
    settledChoice({ exit: 0, later: 5 }) === 'later')
  check('a clear majority wins even when mixed',
    settledChoice({ exit: 4, later: 1 }) === 'exit' && settledChoice({ exit: 1, later: 4 }) === 'later')
  check('the decision holds as more closes accumulate',
    settledChoice({ exit: 40, later: 3 }) === 'exit')
}

console.log('\n── a tie keeps the thing rather than destroying it ──')
{
  // The only asymmetry in the whole control, and it is deliberate: when the
  // evidence does not decide, take the option that loses nothing.
  check('an even split goes to Later', settledChoice({ exit: 3, later: 3 }) === 'later')
  check('…at the threshold too', settledChoice({ exit: 2, later: 3 }) === 'later')
  check('exit needs a strict majority, never a tie',
    settledChoice({ exit: 10, later: 10 }) === 'later')
}

console.log('\n── Later must genuinely come back ──')
{
  // If both handlers did the same thing, the second verb would be a lie. The
  // difference has to be visible in the source: Later carries a duration.
  const PULSE = readFileSync('components/freehold/machine-pulse.tsx', 'utf8')
  check('Later is wired with a return time',
    /onLater=\{[^}]*TOMORROW_MS/.test(PULSE), 'onLater has no duration — it is just Exit')
  check('…and Exit is not', !/onExit=\{[^}]*TOMORROW_MS/.test(PULSE))
  check('a put-away note is keyed to WHAT was shown, not to a date alone',
    /alarmSignature\(/.test(PULSE), 'dismissal is not tied to the content')
  check('…so new or changed items reappear on their own',
    /s\.signature !== signature/.test(PULSE), 'signature is never compared back')

  const CTRL = readFileSync('components/freehold/dismiss-control.tsx', 'utf8')
  check('storage failure leaves the control working rather than throwing',
    /catch \{ \/\* private mode/.test(CTRL) || /catch \{ return \{ exit: 0, later: 0 \} \}/.test(CTRL))
  check('both verbs are labelled for screen readers, not icon-only',
    (CTRL.match(/aria-label=\{t\('ui\.dismiss\./g) ?? []).length >= 3,
    String((CTRL.match(/aria-label=\{t\('ui\.dismiss\./g) ?? []).length))
}

console.log('\n── the settled control is no bigger than a plain close ──')
{
  // The whole point of learning a preference is to give the space back.
  const CTRL = readFileSync('components/freehold/dismiss-control.tsx', 'utf8')
  const size = /h-6 w-6/.test(CTRL)
  check('a single verb renders at one icon-button size', size, 'button size not fixed')
  check('the pair is the only case that renders two buttons',
    (CTRL.match(/<X className/g) ?? []).length === 2 && (CTRL.match(/<Clock className/g) ?? []).length === 2,
    'unexpected number of icon renders')
}

console.log('\n── on time, one time ──')
{
  // A note that sits on the page every visit stops being a note. Read the same
  // sentence three mornings running and it has taught the reader that nothing
  // here is worth reading — which also costs the NEXT thing its attention.
  const PULSE = readFileSync('components/freehold/machine-pulse.tsx', 'utf8')
  check('the note is said once per session, not on every render',
    /alreadySaid\(/.test(PULSE) && /markSaid\(/.test(PULSE), 'nothing stops it repeating')
  check('…scoped to the session, so tomorrow it may speak again',
    /sessionStorage/.test(PULSE), 'a permanent silence would swallow real news')
  check('…and it is marked said only after it has rendered',
    /Runs after the note has actually rendered/.test(PULSE),
    'marking on the render decision silences it unread')
  check('no canned openers — a suggestion repeated every visit is wallpaper',
    !/lm\.pulse\.opener/.test(PULSE), 'openers are back')

  // Said once, then it waits — it does not disappear, and it does not nag.
  check('after speaking it leaves something on the side to click',
    /noteHidden &&/.test(PULSE) && /setReopened\(true\)/.test(PULSE),
    'the note vanishes with no way back')
  check('…and reopening shows the same note, not a second one',
    /!reopened/.test(PULSE), 'reopen does not feed back into the hidden check')
  check('the waiting state is inline, never a third floating launcher',
    !/fixed (bottom|top|end|start)-/.test(PULSE),
    'a floating button would collide with the two already on screen')

  // If it takes half a minute to parse, the moment is gone before it lands.
  const DICT = readFileSync('lib/i18n/dictionaries/lm_core.ts', 'utf8')
  const note = /'lm\.pulse\.note': '([^']*)'/.exec(DICT)?.[1] ?? ''
  check('the note is one short line, not a paragraph',
    note.length > 0 && note.length <= 70, `${note.length} chars: ${note}`)
  check('…and says plainly that nothing was changed',
    /changed nothing|nothing has changed/i.test(note), note)
}

if (failures > 0) {
  console.error(`\n${failures} dismiss rule(s) broken.`)
  process.exit(1)
}
console.log('\nClosing something cannot lose it.\n')
