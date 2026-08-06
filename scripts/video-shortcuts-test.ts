/**
 * Editor key rules, locked.
 *
 * The rule that matters most is the one that is easy to lose in a refactor and
 * catastrophic when it goes: a shortcut must never fire while someone is
 * typing. The caption field lives on the same screen as these keys, so a
 * regression here means typing "Marina living" silently destroys the trim.
 *
 * Pure — `resolveVideoKey` takes a plain object, so no DOM is needed.
 */
import {
  resolveVideoKey, isTypingTarget, HANDLED_KEYS, FRAME_STEP, SECOND_STEP,
  type VideoIntent,
} from '../lib/freehold/video-shortcuts'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const press = (key: string, extra: Record<string, unknown> = {}) =>
  resolveVideoKey({ key, ...extra })
const kindOf = (i: VideoIntent | null) => i?.kind ?? 'null'

console.log('\n── typing always wins ──')
{
  // The whole reason this module is separate from the component.
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    check(`no shortcut fires inside <${tag.toLowerCase()}>`,
      press('i', { target: { tagName: tag } }) === null, tag)
  }
  check('nor inside a contenteditable',
    press('o', { target: { isContentEditable: true } }) === null)
  check('typing "I" in a caption stays a letter',
    press('I', { target: { tagName: 'INPUT' } }) === null)
  check('but the same key works on the page body',
    kindOf(press('i', { target: { tagName: 'DIV' } })) === 'setIn')
  check('a null target is not treated as typing', !isTypingTarget(null))
}

console.log('\n── the standard mapping ──')
{
  check('Space plays / pauses', kindOf(press(' ')) === 'playPause')
  check('K pauses', kindOf(press('k')) === 'pause')
  check('I sets the in-point', kindOf(press('i')) === 'setIn')
  check('O sets the out-point', kindOf(press('o')) === 'setOut')
  check('E grabs the frame', kindOf(press('e')) === 'captureFrame')
  check('Home returns to the in-point', kindOf(press('Home')) === 'toIn')
  check('case does not matter', kindOf(press('O')) === 'setOut')
}

console.log('\n── scrubbing distances ──')
{
  const l = press('l'); const j = press('j')
  check('L steps forward a second', l?.kind === 'seekBy' && l.seconds === SECOND_STEP, JSON.stringify(l))
  check('J steps back a second', j?.kind === 'seekBy' && j.seconds === -SECOND_STEP, JSON.stringify(j))
  const right = press('ArrowRight'); const left = press('ArrowLeft')
  check('→ nudges one frame', right?.kind === 'seekBy' && right.seconds === FRAME_STEP, JSON.stringify(right))
  check('← nudges one frame back', left?.kind === 'seekBy' && left.seconds === -FRAME_STEP, JSON.stringify(left))
  const shiftRight = press('ArrowRight', { shiftKey: true })
  check('Shift+→ moves a whole second', shiftRight?.kind === 'seekBy' && shiftRight.seconds === SECOND_STEP,
    JSON.stringify(shiftRight))
  check('a frame step is smaller than a second step', FRAME_STEP < SECOND_STEP)
}

console.log('\n── never shadow a command the user already owns ──')
{
  check('⌘S stays Save', press('s', { metaKey: true }) === null)
  check('⌘I is not an in-point', press('i', { metaKey: true }) === null)
  check('Ctrl+O stays Open', press('o', { ctrlKey: true }) === null)
  check('⌘← stays the browser’s', press('ArrowLeft', { metaKey: true }) === null)
  check('Alt combinations are left alone', press('l', { altKey: true }) === null)
  // Shift is the one modifier that means something HERE, so it must still work.
  check('Shift is not treated as a foreign modifier',
    press('ArrowLeft', { shiftKey: true }) !== null)
}

console.log('\n── unclaimed keys are left to the page ──')
{
  for (const k of ['a', 'Tab', 'Enter', 'Escape', '/', 'ArrowUp', 'ArrowDown']) {
    check(`"${k}" is not intercepted`, press(k) === null, k)
  }
}

console.log('\n── the preventDefault set matches what is handled ──')
{
  // A key we act on but do not swallow scrolls the page under the player;
  // a key we swallow but never act on breaks the page for no reason.
  const claimed = [' ', 'k', 'K', 'i', 'I', 'o', 'O', 'j', 'J', 'l', 'L', 'e', 'E', 'Home', 'ArrowLeft', 'ArrowRight']
  const missing = claimed.filter((k) => press(k) !== null && !HANDLED_KEYS.has(k))
  check('every acted-on key is in HANDLED_KEYS', missing.length === 0, missing.join(','))
  const extra = [...HANDLED_KEYS].filter((k) => press(k) === null)
  check('no key is swallowed without an action', extra.length === 0, extra.join(','))
  check('Space is swallowed — otherwise it scrolls the page', HANDLED_KEYS.has(' '))
}

if (failures > 0) {
  console.error(`\n${failures} shortcut rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll shortcut rules hold.\n')
