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

console.log('\n── the agent can start a conversation, and it is never startling ──')
{
  const NAV = readFileSync('components/freehold/spaces-nav.tsx', 'utf8')
  const NB = readFileSync('app/freehold-intelligence/notebook/page.tsx', 'utf8')

  // A window that opens by itself reads as something going wrong, even when
  // the news is good. Closed stays closed; the menu entry lights instead.
  check('nothing navigates or opens the chat on the reader\'s behalf',
    !/router\.push\([^)]*notebook/.test(NAV) && !/window\.open/.test(NAV),
    'the chat is being opened for them')
  check('the flash plays twice, then stops',
    /ease-in-out 2;/.test(NAV), 'the animation loops or never ends')
  check('…and the light STAYS after it, because a flash is missable',
    /flashNow \? 'agent-flash' : 'opacity-70'/.test(NAV), 'the signal disappears with the motion')
  check('the same news never flashes twice',
    /shouldFlash\(/.test(NAV) && /markFlashed\(/.test(NAV))
  check('motion is dropped for anyone who asked for less of it',
    /prefers-reduced-motion/.test(NAV) && /prefers-reduced-motion/.test(NB))

  // If the chat IS open the message belongs in the thread, looking unlike a
  // reply — because it is the one message nobody asked for.
  check('an agent-started message is marked as such',
    /opened\?: boolean/.test(NB), 'nothing distinguishes it from a reply')
  check('…and the signal clears once it has landed, so it never replays',
    /clearAgentWaiting\(\)/.test(NB))
  check('…and it arrives once, with no looping motion',
    /agentArrive 0\.35s ease-out 1;/.test(NB), 'the arrival animation repeats')
}

console.log('\n── the signal has a writer, a reader and an eraser ──')
{
  // Every one of these three has to exist or the light is decoration: a
  // signal nothing raises never appears, one nothing reads never shows, and
  // one nothing clears never goes away.
  const PULSE = readFileSync('components/freehold/machine-pulse.tsx', 'utf8')
  const NAV = readFileSync('components/freehold/spaces-nav.tsx', 'utf8')
  const NB = readFileSync('app/freehold-intelligence/notebook/page.tsx', 'utf8')
  check('something raises it', /raiseAgentWaiting\(\{/.test(PULSE), 'the signal has no writer')
  check('something shows it', /agentWaiting\(\)/.test(NAV), 'the signal has no reader')
  check('something clears it', /clearAgentWaiting\(\)/.test(NB) && /clearAgentWaiting\(\)/.test(PULSE),
    'the signal can never be put out')
  check('closing the note counts as reading it',
    /onExit=\{[^}]*clearAgentWaiting/.test(PULSE), 'the light survives being dismissed')
}

console.log('\n── colour is spent once, so it weighs ──')
{
  const NAV = readFileSync('components/freehold/spaces-nav.tsx', 'utf8')
  const NB = readFileSync('app/freehold-intelligence/notebook/page.tsx', 'utf8')
  // Green carries exactly one meaning in this product: your agent started
  // this. Spend it on a border AND an icon AND a label in the same component
  // and it has stopped meaning anything in particular.
  check('the lit menu entry spends green on one mark only',
    (NAV.match(/emerald/g) ?? []).length === 1,
    `${(NAV.match(/emerald/g) ?? []).length} uses`)
  check('the agent-started bubble spends it on its surface only',
    (NB.match(/emerald/g) ?? []).length === 2,
    `${(NB.match(/emerald/g) ?? []).length} uses`)
  check('the thinking state borrows no accent at all',
    /animate-spin text-slate-500/.test(NB), 'the pending spinner is still tinted')
}

console.log('\n── it says what it is doing, not that it is thinking ──')
{
  const NB = readFileSync('app/freehold-intelligence/notebook/page.tsx', 'utf8')
  check('the working line is built from the sources actually sent',
    /checkedSources\.crm_leads\) named\.push/.test(NB), 'the message is still generic')
  check('…and says so plainly when it was given nothing',
    /nb\.working\.nothing/.test(NB))
  // Naming steps the request cannot observe would be choreography, not progress.
  check('no invented step sequence — this endpoint answers in one call',
    !/setTimeout\([^)]*setWorkingOn/.test(NB), 'fake progress stages are being played')
}

if (failures > 0) {
  console.error(`\n${failures} dismiss rule(s) broken.`)
  process.exit(1)
}
console.log('\nClosing something cannot lose it.\n')
