/**
 * Undo/redo rules, locked.
 *
 * Every rule here is a way undo fails *silently* — it does not throw, it just
 * quietly returns the wrong thing, and the person stops trusting ⌘Z and starts
 * saving copies of files instead. The stack is pure, so all of it is testable
 * without an editor.
 */
import {
  createHistory, present, push, undo, redo, reset, canUndo, canRedo, depth,
  historyIntent, HISTORY_LIMIT,
} from '../lib/freehold/history'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

interface Doc { texts: { id: string; text: string }[]; zoom: number }
const doc = (zoom: number, ...texts: string[]): Doc =>
  ({ zoom, texts: texts.map((t, i) => ({ id: `t${i}`, text: t })) })

console.log('\n── stepping back and forward ──')
{
  let h = createHistory(doc(1))
  h = push(h, doc(1, 'Emaar'))
  h = push(h, doc(1, 'Emaar', 'Beachfront'))
  check('two edits give two steps back', depth(h).back === 2, JSON.stringify(depth(h)))

  h = undo(h)
  check('undo returns the previous state', present(h).texts.length === 1, JSON.stringify(present(h).texts))
  h = undo(h)
  check('undo again returns the original', present(h).texts.length === 0, JSON.stringify(present(h).texts))
  check('and there is nothing further back', !canUndo(h))

  h = redo(h)
  check('redo moves forward again', present(h).texts.length === 1, JSON.stringify(present(h).texts))
  h = redo(h)
  check('redo reaches the newest state', present(h).texts.length === 2)
  check('and there is nothing further forward', !canRedo(h))
}

console.log('\n── the end of the road is a no-op, not a crash ──')
{
  const h = createHistory(doc(1))
  check('undo at the start returns the same history', undo(h) === h)
  check('redo at the end returns the same history', redo(h) === h)
  check('present still works on a fresh history', present(h).zoom === 1)
  check('a fresh history cannot go either way', !canUndo(h) && !canRedo(h))
}

console.log('\n── editing after undo abandons the redo branch ──')
{
  // Otherwise "redo" reinstates work from a timeline the user walked away from.
  let h = createHistory(doc(1))
  h = push(h, doc(1, 'first'))
  h = push(h, doc(1, 'first', 'second'))
  h = undo(h)                       // back to just "first"
  check('redo is available before the new edit', canRedo(h))
  h = push(h, doc(1, 'first', 'different'))
  check('the abandoned future is gone', !canRedo(h), JSON.stringify(depth(h)))
  check('the new edit is what is present', present(h).texts[1].text === 'different',
    JSON.stringify(present(h).texts))
  h = undo(h)
  check('and undo still reaches the state it branched from', present(h).texts.length === 1)
}

console.log('\n── history cannot be corrupted by later edits ──')
{
  // THE bug this module exists to prevent: storing a reference to the live
  // array means the next mutation rewrites the past, and undo returns the
  // present — which looks like undo simply not working.
  const live = doc(1, 'original')
  let h = createHistory(live)
  h = push(h, doc(1, 'original', 'second'))
  // Mutate the object that was handed to createHistory.
  live.texts[0].text = 'MUTATED'
  live.zoom = 99
  h = undo(h)
  check('the snapshot kept the original text', present(h).texts[0].text === 'original',
    present(h).texts[0].text)
  check('the snapshot kept the original zoom', present(h).zoom === 1, String(present(h).zoom))

  // And the reverse: mutating what comes OUT must not corrupt the stack.
  const got = present(h)
  got.texts[0].text = 'ALSO MUTATED'
  const again = present(undo(redo(h)))
  check('reading the state twice gives the same answer', again.texts[0].text !== undefined)
}

console.log('\n── an unchanged state is not a step ──')
{
  // Dragging a slider fires constantly; identical snapshots must not bury the
  // real edit under two hundred no-ops.
  let h = createHistory(doc(1))
  h = push(h, doc(1, 'a'))
  const before = h
  h = push(h, doc(1, 'a'))
  check('an identical push changes nothing', h === before, JSON.stringify(depth(h)))
  check('and the step count is unchanged', depth(h).back === 1, JSON.stringify(depth(h)))
  h = push(h, doc(2, 'a'))
  check('a real change still records', depth(h).back === 2, JSON.stringify(depth(h)))
}

console.log('\n── the cap drops the oldest, never the newest ──')
{
  let h = createHistory(doc(0), 5)
  for (let i = 1; i <= 20; i++) h = push(h, doc(i))
  check('the stack respects the limit', h.past.length <= 5, String(h.past.length))
  check('the newest edit survives', present(h).zoom === 20, String(present(h).zoom))
  // Walk all the way back — it must reach the oldest KEPT state, not crash.
  while (canUndo(h)) h = undo(h)
  check('the oldest kept state is reachable', present(h).zoom === 16, String(present(h).zoom))
  check('the default limit is a sane number', HISTORY_LIMIT >= 20, String(HISTORY_LIMIT))
}

console.log('\n── reset starts a new document, not a new branch ──')
{
  let h = createHistory(doc(1))
  h = push(h, doc(2))
  h = reset(h, doc(9))
  check('nothing is behind a reset history', !canUndo(h), JSON.stringify(depth(h)))
  check('nothing is ahead of it', !canRedo(h))
  check('and the new baseline is present', present(h).zoom === 9, String(present(h).zoom))
}

console.log('\n── the keys, and what must not trigger them ──')
{
  check('⌘Z is undo', historyIntent({ key: 'z', metaKey: true }) === 'undo')
  check('Ctrl+Z is undo', historyIntent({ key: 'z', ctrlKey: true }) === 'undo')
  check('⌘⇧Z is redo', historyIntent({ key: 'z', metaKey: true, shiftKey: true }) === 'redo')
  check('Ctrl+Y is redo too', historyIntent({ key: 'y', ctrlKey: true }) === 'redo')
  check('capital Z still works', historyIntent({ key: 'Z', metaKey: true }) === 'undo')
  check('a bare Z types a letter', historyIntent({ key: 'z' }) === null)
  check('⌘S is left alone', historyIntent({ key: 's', metaKey: true }) === null)
  // The one that eats someone's caption if it is missed.
  check('⌘Z inside a text field undoes the TYPING, not the canvas',
    historyIntent({ key: 'z', metaKey: true, target: { tagName: 'INPUT' } }) === null)
  check('same inside a textarea',
    historyIntent({ key: 'z', metaKey: true, target: { tagName: 'TEXTAREA' } }) === null)
  check('same inside a contenteditable',
    historyIntent({ key: 'z', metaKey: true, target: { isContentEditable: true } }) === null)
}

if (failures > 0) {
  console.error(`\n${failures} history rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll history rules hold.\n')
