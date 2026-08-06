'use client'

/**
 * Ads Machine — home. Lists the real machines (honest empty state) and hosts
 * the inline "new machine" flow: name + project multi-select (live inventory,
 * same source as the campaign wizard's picker) + hard daily cap → POST create
 * (a 400 shows the planner's honest reason verbatim) → the persisted plan
 * preview straight from the machine's GET → "Start machine" (real-budget
 * confirm) or leave it in planning.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, ArrowUpRight, Bot, Check, ChevronDown, FileText, Lightbulb,
  Loader2, Plus, Search, Sparkles, X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { MachinePlanPreview } from '@/components/freehold/machine-plan-preview'
import type { AdsMachine, MachineStatus } from '@/lib/freehold/ads-machine'
import type { MachinePlan, TrialSource } from '@/lib/freehold/ads-machine-planner'

// Meta's minimum viable daily trial budget (mirrors META_MIN_TRIAL_BUDGET_AED
// in lib/freehold/ads-machine-planner — a server module this client page must
// not import for its value).
const META_MIN_TRIAL_AED = 50

const STATUS_PILL: Record<MachineStatus, { dot: string; cls: string; labelKey: string }> = {
  planning: { dot: 'bg-sky-400', cls: 'border-sky-400/20 bg-sky-400/10 text-sky-300', labelKey: 'lm.machine.status.planning' },
  running: { dot: 'bg-emerald-400', cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300', labelKey: 'lm.machine.status.running' },
  paused: { dot: 'bg-amber-400', cls: 'border-amber-400/20 bg-amber-400/10 text-amber-300', labelKey: 'lm.machine.status.paused' },
  stopped: { dot: 'bg-red-400', cls: 'border-red-400/20 bg-red-400/10 text-red-300', labelKey: 'lm.machine.status.stopped' },
}


interface PickListing {
  slug: string
  name: string
  area: string
  developer: string
}

/** Searchable multi-select over the live inventory: selected projects render
 * as removable chips; the dropdown stays open so several can be added. */
function ProjectMultiPicker({
  listings, loading, selected, onToggle, onRemove,
}: {
  listings: PickListing[]
  loading: boolean
  selected: string[]
  onToggle: (slug: string) => void
  onRemove: (slug: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return listings
    return listings.filter((l) =>
      l.name.toLowerCase().includes(needle) ||
      l.developer.toLowerCase().includes(needle) ||
      l.area.toLowerCase().includes(needle),
    )
  }, [listings, q])

  const bySlug = useMemo(() => new Map(listings.map((l) => [l.slug, l])), [listings])

  return (
    <div className="relative" ref={rootRef}>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((slug) => {
            const l = bySlug.get(slug)
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 py-1 pe-1.5 ps-3 text-xs font-medium text-gold"
              >
                <Check className="h-3 w-3" />
                {l ? l.name : slug}
                <button
                  type="button"
                  onClick={() => onRemove(slug)}
                  aria-label={t('lm.machine.form.cancel')}
                  className="rounded-full p-0.5 text-gold/60 transition hover:bg-gold/20 hover:text-gold"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-start text-sm outline-none transition focus:border-gold/40"
      >
        <span className={selected.length ? 'text-white' : 'text-white/40'}>
          {loading
            ? t('common.loading')
            : selected.length
              ? t('lm.machine.form.selected', { n: String(selected.length) })
              : t('lm.machine.form.pickProjects')}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('lm.machine.form.search')}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            {q && (
              <button type="button" onClick={() => setQ('')}>
                <X className="h-3.5 w-3.5 text-slate-500 hover:text-white" />
              </button>
            )}
          </div>
          <div className="max-h-[min(50vh,300px)] overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {loading ? t('common.loading') : t('lm.machine.form.noResults')}
              </div>
            ) : (
              filtered.map((l) => {
                const isSel = selected.includes(l.slug)
                return (
                  <button
                    key={l.slug}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => onToggle(l.slug)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-start ${isSel ? 'bg-gold/10' : 'hover:bg-surface-2'}`}
                  >
                    {isSel
                      ? <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                      : <span className="h-3.5 w-3.5 shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{l.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {[l.developer, l.area].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdsMachinePage() {
  const t = useT()
  const router = useRouter()

  const [machines, setMachines] = useState<AdsMachine[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // New-machine flow.
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [slugs, setSlugs] = useState<string[]>([])
  const [cap, setCap] = useState('')
  const [creating, setCreating] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [created, setCreated] = useState<AdsMachine | null>(null)
  const [confirmStart, setConfirmStart] = useState(false)
  const [starting, setStarting] = useState(false)

  // Live inventory for the picker — same source as the campaign wizard.
  const [listings, setListings] = useState<PickListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)

  const loadMachines = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/machine', { cache: 'no-store' })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setLoadError(d?.error || t('lm.machine.loadFailed')); return }
      setMachines(Array.isArray(d?.machines) ? d.machines : [])
      setLoadError(null)
    } catch {
      setLoadError(t('lm.machine.loadFailed'))
    }
  }, [t])

  useEffect(() => { loadMachines() }, [loadMachines])

  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const props: PickListing[] = (d?.properties || [])
          .map((p: Record<string, unknown>) => ({
            slug: String(p.slug || ''),
            name: String(p.name || ''),
            area: String(p.area || ''),
            developer: String(p.developer || ''),
          }))
          .filter((l: PickListing) => l.slug && l.name)
        setListings(props)
      })
      .catch(() => {})
      .finally(() => setListingsLoading(false))
  }, [])

  async function createNow() {
    if (creating) return
    setCreating(true)
    setApiError(null)
    try {
      const res = await fetch('/api/freehold/ads/machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectSlugs: slugs, dailyCapAed: Number(cap) }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        // The planner's honest reason, verbatim.
        setApiError(d?.reason || d?.error || t('lm.machine.ctrl.failed'))
        return
      }
      // Plan preview from the machine's GET (the persisted plan, not client state).
      const detail = await fetch(`/api/freehold/ads/machine/${d.machine.id}`, { cache: 'no-store' })
      const dd = await detail.json().catch(() => null)
      setCreated(detail.ok && dd?.machine ? dd.machine : d.machine)
      loadMachines()
    } catch {
      setApiError(t('lm.machine.ctrl.failed'))
    } finally {
      setCreating(false)
    }
  }

  async function startNow() {
    if (!created || starting) return
    setStarting(true)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setApiError(d?.error || t('lm.machine.ctrl.failed'))
        setConfirmStart(false)
        return
      }
      router.push(`/freehold-intelligence/lead-machine/ads-machine/${created.id}`)
    } catch {
      setApiError(t('lm.machine.ctrl.failed'))
      setConfirmStart(false)
    } finally {
      setStarting(false)
    }
  }

  function resetFlow() {
    setShowNew(false)
    setName('')
    setSlugs([])
    setCap('')
    setApiError(null)
    setCreated(null)
    setConfirmStart(false)
  }

  const canCreate = !!name.trim() && slugs.length > 0 && Number(cap) > 0
  const inputCls = 'w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-gold/40'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <Bot className="h-3.5 w-3.5" /> {t('lm.machine.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">{t('lm.machine.title')}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">{t('lm.machine.subtitle')}</p>
        </section>

        {!showNew && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright sm:mt-10"
          >
            <Plus className="h-4 w-4" /> {t('lm.machine.new')}
          </button>
        )}
      </div>

      {loadError && (
        <div className="mt-8 flex items-start gap-3 rounded-[18px] border border-line bg-surface-2 p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-sm text-slate-300">{loadError}</p>
        </div>
      )}

      {/* ── New machine: form → plan preview ── */}
      {showNew && (
        <section className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          {!created ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t('lm.machine.form.name')}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setApiError(null) }}
                    placeholder={t('lm.machine.form.namePlaceholder')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t('lm.machine.form.cap')}
                  </label>
                  <input
                    value={cap}
                    onChange={(e) => { setCap(e.target.value.replace(/[^\d]/g, '')); setApiError(null) }}
                    inputMode="numeric"
                    placeholder="300"
                    className={inputCls}
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {t('lm.machine.form.capHint', { min: String(META_MIN_TRIAL_AED) })}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t('lm.machine.form.projects')}
                </label>
                <ProjectMultiPicker
                  listings={listings}
                  loading={listingsLoading}
                  selected={slugs}
                  onToggle={(slug) => { setSlugs((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]); setApiError(null) }}
                  onRemove={(slug) => setSlugs((prev) => prev.filter((s) => s !== slug))}
                />
              </div>

              {apiError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
                  <p className="text-sm text-slate-300">{apiError}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={createNow}
                  disabled={!canCreate || creating}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {creating ? t('lm.machine.form.building') : t('lm.machine.form.next')}
                </button>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white"
                >
                  {t('lm.machine.form.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{created.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{t('lm.machine.plan.title')} · {t('lm.machine.plan.note')}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${(STATUS_PILL[created.status] ?? STATUS_PILL.planning).cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${(STATUS_PILL[created.status] ?? STATUS_PILL.planning).dot}`} />
                  {t((STATUS_PILL[created.status] ?? STATUS_PILL.planning).labelKey)}
                </span>
              </div>

              <div className="mt-4">
                {created.plan && <MachinePlanPreview plan={created.plan} />}
              </div>

              {apiError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
                  <p className="text-sm text-slate-300">{apiError}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmStart(true)}
                  disabled={starting}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
                >
                  {starting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {starting ? t('lm.machine.plan.starting') : t('lm.machine.plan.start')}
                </button>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white"
                >
                  {t('lm.machine.plan.leave')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Start confirm: real spend, stated plainly ── */}
      {confirmStart && created && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-app p-6 shadow-2xl">
            <div className="text-base font-semibold text-white">{t('lm.machine.plan.confirmTitle')}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {t('lm.machine.plan.confirmBody', { n: created.dailyCapAed.toLocaleString() })}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmStart(false)}
                disabled={starting}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                {t('lm.machine.plan.confirmNo')}
              </button>
              <button
                type="button"
                onClick={startNow}
                disabled={starting}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
              >
                {starting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('lm.machine.plan.confirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Machines list ── */}
      {machines === null && !loadError && (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      )}

      {machines && machines.length > 0 && (
        <section className="mt-10">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.list.title')}</div>
          <div className="mt-4 space-y-3">
            {machines.map((m) => {
              const pill = STATUS_PILL[m.status] ?? STATUS_PILL.planning
              return (
                <Link
                  key={m.id}
                  href={`/freehold-intelligence/lead-machine/ads-machine/${m.id}`}
                  className="group flex items-start justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 transition hover:border-gold/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pill.dot}`} />
                      <h3 className="truncate text-sm font-semibold text-white">{m.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill.cls}`}>
                        {t(pill.labelKey)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span>{t('lm.machine.list.projects', { n: String(m.projectSlugs.length) })}</span>
                      <span className="text-slate-400">{t('lm.machine.list.cap', { n: m.dailyCapAed.toLocaleString() })}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Honest empty state */}
      {machines && machines.length === 0 && !showNew && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <Bot className="mx-auto h-8 w-8 text-gold/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">{t('lm.machine.list.empty.title')}</div>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-slate-500">{t('lm.machine.list.empty.desc')}</p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright"
          >
            <Plus className="h-4 w-4" /> {t('lm.machine.new')}
          </button>
        </div>
      )}
    </div>
  )
}
