/**
 * Converter rules, locked.
 *
 * The rule that carries all the weight: a conversion is only offered if it
 * will actually happen. The reference tool that prompted this shipped a
 * "compressor" that made files 96% larger and reported "0% compressed" — the
 * failure is never a crash, it is a file handed back with a name that lies
 * about what is inside it.
 *
 * Pure — no DOM, no canvas, no network.
 */
import {
  kindOf, targetsFor, outputName, mimeFor, caveatFor, toCsv, rowsToObjects,
  type TargetFormat,
} from '../lib/freehold/convert'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const formats = (k: Parameters<typeof targetsFor>[0], ext = '') => targetsFor(k, ext).map((t) => t.format)

console.log('\n── the file is recognised ──')
{
  check('png is an image', kindOf('hero.png') === 'image')
  check('MOV is a video', kindOf('clip.MOV') === 'video', kindOf('clip.MOV'))
  check('xlsx is a table', kindOf('leads.xlsx') === 'table')
  check('pdf is a pdf', kindOf('brochure.pdf') === 'pdf')
  check('mime rescues a missing extension', kindOf('blob', 'image/webp') === 'image',
    kindOf('blob', 'image/webp'))
  check('an unknown file is unknown, not guessed', kindOf('archive.xyz') === 'unknown',
    kindOf('archive.xyz'))
}

console.log('\n── nothing is offered that cannot be produced ──')
{
  // Every offered target must have a mime, i.e. exist in the writer.
  for (const kind of ['image', 'video', 'table', 'pdf', 'unknown'] as const) {
    for (const t of targetsFor(kind)) {
      check(`${kind} → ${t.format} has a real output type`, !!mimeFor(t.format), t.format)
    }
  }
  // The reference tool's exact sin, made impossible here.
  check('a PDF offers nothing rather than a fake conversion', formats('pdf').length === 0,
    formats('pdf').join(','))
  check('an unknown file offers nothing', formats('unknown').length === 0, formats('unknown').join(','))
}

console.log('\n── converting to what you already have is not a conversion ──')
{
  check('a PNG is not offered PNG', !formats('image', 'png').includes('png'), formats('image', 'png').join(','))
  check('but is offered JPG and WEBP',
    formats('image', 'png').includes('jpg') && formats('image', 'png').includes('webp'),
    formats('image', 'png').join(','))
  check('a .jpeg is not offered jpg', !formats('image', 'jpeg').includes('jpg'),
    formats('image', 'jpeg').join(','))
  check('an MP4 is not offered MP4', !formats('video', 'mp4').includes('mp4'), formats('video', 'mp4').join(','))
  check('but is offered GIF', formats('video', 'mp4').includes('gif'), formats('video', 'mp4').join(','))
  check('a CSV is not offered CSV', !formats('table', 'csv').includes('csv'), formats('table', 'csv').join(','))
}

console.log('\n── the name comes out the other side ──')
{
  check('base name is kept', outputName('Emaar Beachfront hero.png', 'jpg') === 'Emaar-Beachfront-hero.jpg',
    outputName('Emaar Beachfront hero.png', 'jpg'))
  check('only the last extension is replaced', outputName('report.v2.final.csv', 'xlsx') === 'report.v2.final.xlsx',
    outputName('report.v2.final.csv', 'xlsx'))
  check('a nameless file still gets a name', outputName('.png', 'webp') === 'converted.webp',
    outputName('.png', 'webp'))
  check('path separators cannot escape', !outputName('a/b/c.png', 'jpg').includes('/'),
    outputName('a/b/c.png', 'jpg'))
}

console.log('\n── a file never lies about its container ──')
{
  // The trap: a WebM-only browser asked for MP4. Renaming would produce a file
  // that claims to be MP4 and is not — which Meta and every player would reject.
  const blocked = caveatFor('mp4', 'webm')
  check('MP4 is refused on a WebM-only browser', blocked?.blocking === true, JSON.stringify(blocked))
  check('WebM is allowed there', caveatFor('webm', 'webm') === null)
  check('MP4 is allowed where MP4 records', caveatFor('mp4', 'mp4') === null)
  check('no recorder at all blocks both', caveatFor('webm', null)?.blocking === true)
  check('image and table targets carry no container caveat',
    caveatFor('png', null) === null && caveatFor('csv', null) === null)
}

console.log('\n── CSV a spreadsheet can read back ──')
{
  check('a comma is quoted, not left to split the column',
    toCsv([['Emaar, Dubai']]) === '"Emaar, Dubai"', toCsv([['Emaar, Dubai']]))
  check('quotes are doubled', toCsv([['He said "yes"']]) === '"He said ""yes"""',
    toCsv([['He said "yes"']]))
  check('newlines inside a cell are quoted', toCsv([['line1\nline2']]).startsWith('"'),
    toCsv([['line1\nline2']]))
  check('plain values are not needlessly quoted', toCsv([['Emaar', '3450000']]) === 'Emaar,3450000',
    toCsv([['Emaar', '3450000']]))
  check('rows are CRLF separated', toCsv([['a'], ['b']]) === 'a\r\nb', JSON.stringify(toCsv([['a'], ['b']])))
  check('null and undefined become empty, not "null"',
    toCsv([[null, undefined]]) === ',', JSON.stringify(toCsv([[null, undefined]])))
}

console.log('\n── no column is lost on the way to JSON ──')
{
  const objs = rowsToObjects([['name', 'area'], ['Beachfront', 'Dubai Harbour']])
  check('the header row becomes keys', objs[0]?.name === 'Beachfront' && objs[0]?.area === 'Dubai Harbour',
    JSON.stringify(objs[0]))
  // Two columns both called "price" must not collapse into one.
  const dup = rowsToObjects([['price', 'price'], [100, 200]])
  check('duplicate headers are disambiguated', Object.keys(dup[0]).length === 2, JSON.stringify(dup[0]))
  const blank = rowsToObjects([['', 'area'], ['x', 'y']])
  check('a blank header gets a usable name', Object.keys(blank[0])[0] === 'column_1',
    Object.keys(blank[0]).join(','))
  check('an empty sheet yields no rows, not a crash', rowsToObjects([]).length === 0)
  const short = rowsToObjects([['a', 'b'], ['only-one']])
  check('a short row fills rather than dropping the key', short[0]?.b === '', JSON.stringify(short[0]))
}

console.log('\n── every writable format has a mime ──')
{
  const all: TargetFormat[] = ['png', 'jpg', 'webp', 'pdf', 'mp4', 'webm', 'gif', 'csv', 'xlsx', 'json']
  const missing = all.filter((f) => !mimeFor(f))
  check('none missing', missing.length === 0, missing.join(','))
  check('jpg is image/jpeg, not image/jpg', mimeFor('jpg') === 'image/jpeg', mimeFor('jpg'))
}

if (failures > 0) {
  console.error(`\n${failures} converter rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll converter rules hold.\n')
