'use client'

/**
 * All tools — the popup that holds the whole system, plus one search box.
 *
 * The navigation problem it solves: with ~14 workspaces and ~130 tools, a
 * permanent nav rail would need three levels on every page to reach everything.
 * That's chrome that grows forever and is wrong on most screens. Instead the
 * depth lives HERE, one keystroke away from anywhere (⌘K / Ctrl-K, or the grid
 * button in the spine), and pages keep the one level of nav they actually need.
 *
 * Two modes, one box:
 *   · empty query  → the full map. Recently used first, then nine shelves.
 *   · typed query  → results grouped BY SECTION. Tools resolve instantly from
 *     the local registry; live records (leads, projects, campaigns, people,
 *     files) come from /api/freehold/global-search, debounced.
 *
 * Typing a phone number searches leads by number — a broker sees only their
 * own, which is the server's rule, not this component's.
 *
 * Everything shown is role-filtered through `visibleTools`, which inherits each
 * app's real route guard. The popup can never offer a door that then 403s.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutGrid, Search, X, Loader2, ArrowRight, Clock, AlertCircle, CornerDownLeft,
} from 'lucide-react'
import { useSession } from '@/lib/freehold/use-session'
import { useT } from '@/lib/i18n/provider'
import { TOOL_GROUPS, visibleTools, toolById, toolMatches, type ToolDef } from '@/lib/freehold/tools'

/** Sections the API can return, in the order they are most useful on screen. */
const DATA_SECTIONS = ['leads', 'inventory', 'campaigns', 'landings', 'people', 'drive'] as const

interface SearchHit { id: string; title: string; sub?: string; href: string }
interface SearchSection { section: string; hits: SearchHit[]; error?: string }

const RECENTS_KEY = 'fi.nav.recents'
const RECENTS_MAX = 8
const DEBOUNCE_MS = 220

function readRecents(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

function pushRecent(id: string) {
  if (typeof window === 'undefined') return
  try {
    const next = [id, ...readRecents().filter((v) => v !== id)].slice(0, RECENTS_MAX)
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch { /* private mode — recents are a convenience, never a requirement */ }
}

/** The button that lives in the spine. Owns the popup. */
export function CommandNav() {
  const [open, setOpen] = useState(false)
  const t = useT()

  // ⌘K / Ctrl-K from anywhere; Escape closes (the panel handles that itself).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-coach="nav-all-tools"
        aria-label={t('nav.allTools')}
        title={`${t('nav.allTools')} (⌘K)`}
        className="flex h-full shrink-0 items-center gap-2 border-e border-white/[0.07] px-3 text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white sm:px-4"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden text-sm font-medium lg:inline">{t('nav.allTools')}</span>
        <kbd className="hidden rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] text-slate-500 xl:inline">⌘K</kbd>
      </button>
      {open && <CommandPanel onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * The panel on its own, for surfaces that already own a trigger (the phone
 * Apps sheet). Same registry, same scoping, same search — one implementation.
 */
export function AllToolsPanel({ onClose }: { onClose: () => void }) {
  return <CommandPanel onClose={onClose} />
}

function CommandPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const router = useRouter()
  const { user } = useSession()
  const role = user?.role

  const [q, setQ] = useState('')
  const [data, setData] = useState<SearchSection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const tools = useMemo(() => visibleTools(role), [role])
  const label = useCallback((tool: ToolDef) => t(tool.labelKey), [t])

  useEffect(() => { setRecents(readRecents()) }, [])

  // Escape to close, focus the box, lock the page behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Live records, debounced. Tool matches never wait on this.
  useEffect(() => {
    const needle = q.trim()
    if (needle.length < 2) { setData(null); setLoading(false); setFailed(null); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/freehold/global-search?q=${encodeURIComponent(needle)}`, { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          // Say what broke. An empty list here would read as "no such lead",
          // which is a different — and wrong — answer.
          const body = await res.json().catch(() => null)
          setFailed(body?.error ?? `Search failed (${res.status})`)
          setData(null)
        } else {
          const body = await res.json()
          setFailed(null)
          setData(Array.isArray(body?.sections) ? body.sections : [])
        }
      } catch (e) {
        if (!cancelled) { setFailed(e instanceof Error ? e.message : 'Search failed'); setData(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q])

  const matchedTools = useMemo(
    () => (q.trim() ? tools.filter((tool) => toolMatches(tool, q, label(tool))) : []),
    [q, tools, label],
  )

  const go = useCallback((href: string, toolId?: string) => {
    if (toolId) pushRecent(toolId)
    onClose()
    router.push(href)
  }, [onClose, router])

  // Enter takes the single best answer: a live record if one matched, else the
  // top tool. Nothing matched → Enter does nothing rather than guessing.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const firstHit = data?.find((s) => s.hits.length)?.hits[0]
    if (firstHit) return go(firstHit.href)
    if (matchedTools[0]) return go(matchedTools[0].href, matchedTools[0].id)
  }

  const searching = q.trim().length > 0
  const recentTools = recents.map(toolById).filter((x): x is ToolDef => !!x && tools.includes(x))
  const dataSections = (data ?? [])
    .slice()
    .sort((a, b) => DATA_SECTIONS.indexOf(a.section as never) - DATA_SECTIONS.indexOf(b.section as never))
  const nothingFound =
    searching && !loading && matchedTools.length === 0 && dataSections.every((s) => !s.hits.length && !s.error)

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center" role="dialog" aria-modal="true" aria-label={t('nav.allTools')}>
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label={t('common.close')} />

      <div className="relative mt-0 flex h-full w-full flex-col overflow-hidden border-line bg-surface shadow-2xl sm:mt-[6vh] sm:h-auto sm:max-h-[86vh] sm:w-[min(1080px,94vw)] sm:rounded-2xl sm:border">

        {/* Header — title + the one search box */}
        <div className="shrink-0 border-b border-line px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-[17px] font-semibold text-white">{t('nav.allTools')}</h2>
            <button onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] py-3 pe-24 ps-10 text-sm text-white placeholder:text-slate-500 focus:border-gold/40 focus:outline-none"
            />
            <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
              {q && (
                <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label={t('nav.clear')} className="rounded p-1 text-slate-500 transition hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden items-center gap-1 rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] text-slate-500 sm:flex">
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
            </div>
          </form>
          <p className="mt-2 text-[11px] text-slate-500">{t('nav.searchHint')}</p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">

          {/* ── Typed query: results grouped by section ── */}
          {searching && (
            <div className="space-y-6">
              {failed && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-red-200">{t('nav.searchFailed')}</div>
                    <div className="truncate text-xs text-red-300/80">{failed}</div>
                  </div>
                </div>
              )}

              {matchedTools.length > 0 && (
                <ResultGroup title={t('nav.section.tools')} count={matchedTools.length}>
                  {matchedTools.slice(0, 12).map((tool) => (
                    <ResultRow
                      key={tool.id}
                      title={label(tool)}
                      sub={t(`tools.group.${tool.group}`)}
                      Icon={tool.Icon}
                      onClick={() => go(tool.href, tool.id)}
                    />
                  ))}
                </ResultGroup>
              )}

              {dataSections.map((s) => (
                <ResultGroup
                  key={s.section}
                  title={t(`nav.section.${s.section}`)}
                  count={s.hits.length}
                  error={s.error}
                >
                  {s.hits.map((hit) => (
                    <ResultRow key={`${s.section}-${hit.id}`} title={hit.title} sub={hit.sub} onClick={() => go(hit.href)} />
                  ))}
                </ResultGroup>
              ))}

              {nothingFound && (
                <div className="py-12 text-center">
                  <div className="text-sm text-slate-400">{t('nav.noResults')}</div>
                  <div className="mt-1 text-xs text-slate-600">{t('nav.noResultsHint')}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Empty query: the full map ── */}
          {!searching && (
            <>
              {recentTools.length > 0 && (
                <section className="mb-7">
                  <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Clock className="h-3 w-3" /> {t('nav.recent')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {recentTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => go(tool.href, tool.id)}
                        className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3 text-center transition hover:border-gold/25 hover:bg-white/[0.05]"
                      >
                        <tool.Icon className="h-4.5 w-4.5 text-gold" />
                        <span className="line-clamp-2 text-[11px] leading-tight text-slate-300">{label(tool)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="columns-1 gap-x-8 sm:columns-2 lg:columns-3">
                {TOOL_GROUPS.map((group) => {
                  const items = tools.filter((tool) => tool.group === group.id)
                  if (!items.length) return null
                  return (
                    <section key={group.id} className="mb-7 break-inside-avoid">
                      <h3 className="mb-2.5 text-[13px] font-semibold text-white">{t(group.labelKey)}</h3>
                      <ul className="space-y-0.5">
                        {items.map((tool) => (
                          <li key={tool.id}>
                            <Link
                              href={tool.href}
                              onClick={() => { pushRecent(tool.id); onClose() }}
                              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <tool.Icon className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-gold" />
                              <span className="truncate">{label(tool)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultGroup({
  title, count, error, children,
}: { title: string; count: number; error?: string; children: React.ReactNode }) {
  if (!count && !error) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
        {count > 0 && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{count}</span>}
      </h3>
      {error ? (
        // A section that failed says so. It never pretends to be empty.
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-xs text-amber-200/90">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      ) : (
        <ul className="space-y-0.5">{children}</ul>
      )}
    </section>
  )
}

function ResultRow({
  title, sub, Icon, onClick,
}: { title: string; sub?: string; Icon?: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition hover:bg-white/[0.06]"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-gold" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-slate-200 group-hover:text-white">{title}</span>
          {sub && <span className="block truncate text-[11px] text-slate-500">{sub}</span>}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
      </button>
    </li>
  )
}
