/**
 * The ONE horizontal-nav tab treatment (underline, gold when active).
 * Use on <Link>/<button> in app sub-nav rows; filters use SegmentPill instead.
 */
export function tabLinkClass(active: boolean, className = '') {
  return [
    'inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
    active ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
    className,
  ].join(' ')
}
