'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Building2, Plus, Sparkles, CheckCircle2, AlertCircle, Search, Globe, RefreshCw, TrendingUp } from 'lucide-react'

interface DeveloperRow {
  slug:          string
  name:          string
  initials:      string
  color:         string
  listings:      number
  profileStatus: 'Complete' | 'Incomplete' | 'Draft'
  seo:           number
  leads30d:      number
}

type FilterKey = 'All' | 'Complete' | 'Incomplete' | 'Draft'

const STATUS_STYLE: Record<DeveloperRow['profileStatus'], string> = {
  Complete:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Incomplete: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  Draft:      'text-slate-400   bg-surface-2   border-line-strong',
}

const AVATAR_COLORS = [
  'bg-sky-500/20 text-sky-300', 'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300', 'bg-violet-500/20 text-violet-300',
  'bg-cyan-500/20 text-cyan-300', 'bg-pink-500/20 text-pink-300',
  'bg-rose-500/20 text-rose-300', 'bg-orange-500/20 text-orange-300',
  'bg-indigo-500/20 text-indigo-300', 'bg-teal-500/20 text-teal-300',
]

function deriveStatus(score: number | null, count: number | null): DeveloperRow['profileStatus'] {
  if (!count || count < 1) return 'Draft'
  const s = score ?? 0
  if (s >= 70) return 'Complete'
  if (s >= 40) return 'Incomplete'
  return 'Draft'
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export default function DeveloperProfilesPage() {
  const [developers, setDevelopers] = useState<DeveloperRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterKey>('All')
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [writing,    setWriting]    = useState<string | null>(null)
  const [written,    setWritten]    = useState<string[]>([])
  const [showNew,    setShowNew]    = useState(false)
  const [newName,    setNewName]    = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/freehold/public/developers').then((r) => r.ok ? r.json() : { developers: [] }).catch(() => ({ developers: [] })),
      fetch('/api/freehold/web-content?kind=developer', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ])
      .then(([data, custom]) => {
        const mapped: DeveloperRow[] = (data.developers ?? []).map((d: {
          slug: string; name: string; project_count: number | null;
          avg_score: number | null; avg_yield: number | null
        }, i: number) => ({
          slug: d.slug,
          name: d.name,
          initials: initials(d.name),
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          listings: d.project_count ?? 0,
          profileStatus: deriveStatus(d.avg_score, d.project_count),
          seo: Math.min(100, Math.round((d.avg_score ?? 40) * 1.1)),
          leads30d: 0,
        }))
        const customDevs: DeveloperRow[] = (custom.items ?? []).map((c: { slug: string; name: string; status: string; body?: string }, i: number) => ({
          slug: c.slug,
          name: c.name,
          initials: initials(c.name),
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          listings: 0,
          profileStatus: (c.body ? 'Complete' : 'Draft') as DeveloperRow['profileStatus'],
          seo: c.body ? 60 : 20,
          leads30d: 0,
        }))
        const seen = new Set(mapped.map((m) => m.slug))
        setDevelopers([...customDevs.filter((c) => !seen.has(c.slug)), ...mapped])
      })
      .catch(() => toast.error('Failed to load developer data'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = developers
    .filter((d) => filter === 'All' || d.profileStatus === filter)
    .filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()))

  async function aiWrite(name: string) {
    setWriting(name)
    try {
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write a professional developer profile for ${name}, a UAE real-estate developer. Cover track record, flagship projects, build quality, delivery reputation, and why investors trust them. 250-350 words, ready to publish.`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) throw new Error(data?.error || 'AI failed')
      try { await navigator.clipboard.writeText(data.text) } catch { /* optional */ }
      setWritten((p) => [...p, name])
      toast.success(`AI profile for ${name} generated${data.source === 'gemini' ? ' & copied to clipboard' : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setWriting(null)
    }
  }

  const complete    = developers.filter((d) => d.profileStatus === 'Complete').length
  const avgSeo      = developers.length ? Math.round(developers.reduce((s, d) => s + d.seo, 0) / developers.length) : 0
  const totalLeads  = developers.reduce((s, d) => s + d.leads30d, 0)
  const incomplete  = developers.filter((d) => d.profileStatus !== 'Complete').length

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Developer Profiles</h1>
          <p className="mt-1 text-xs text-slate-500">SEO pages for each developer — drives organic ranking</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
          <Plus className="h-3.5 w-3.5" /> {showNew ? 'Cancel' : 'Add developer'}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Complete',  value: loading ? '…' : `${complete}/${developers.length}`, Icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Avg SEO',   value: loading ? '…' : avgSeo,                             Icon: TrendingUp,   color: 'text-sky-400'     },
          { label: '30d Leads', value: loading ? '…' : totalLeads,                         Icon: Globe,        color: 'text-gold'   },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="mb-5 rounded-xl border border-sky-400/20 bg-sky-400/[0.03] p-4 space-y-3">
          <div className="text-sm font-semibold text-white">New developer profile</div>
          <input autoFocus placeholder="Developer name (e.g. Emaar Properties)" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/40" />
          <div className="flex gap-2">
            <button onClick={async () => {
              const name = newName.trim()
              if (!name) return
              try {
                const res = await fetch('/api/freehold/web-content', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'developer', name }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.error || 'Failed')
                setDevelopers((prev) => [{ slug: data.item.slug, name: data.item.name, initials: initials(data.item.name), color: AVATAR_COLORS[0], listings: 0, profileStatus: 'Draft', seo: 20, leads30d: 0 }, ...prev])
                setShowNew(false); setNewName(''); toast.success('Developer profile created')
              } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to create') }
            }}
              className="rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-4 py-2 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
              Create profile
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">Cancel</button>
          </div>
        </div>
      )}

      {!loading && incomplete > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
          <div>
            <div className="text-sm font-medium text-amber-300/90">{incomplete} profiles incomplete</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Incomplete profiles reduce Google ranking. Use AI Write to complete them.
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input type="text" placeholder="Search developers…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/30" />
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {(['All', 'Complete', 'Incomplete', 'Draft'] as FilterKey[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${filter === f ? 'bg-surface-3 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-slate-500">Loading from Neon…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-slate-500">No developers match.</div>
        )}

        {filtered.map((d) => {
          const isExpanded = expanded === d.name
          const isWriting  = writing === d.name
          const isWritten  = written.includes(d.name)

          return (
            <div key={d.slug} className="rounded-xl border border-line bg-surface overflow-hidden">
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpanded(isExpanded ? null : d.name)}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${d.color}`}>
                  {d.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-300">{d.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.profileStatus]}`}>
                      {d.profileStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{d.listings} listings</span>
                    <span>·</span>
                    <span>SEO {d.seo}</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-line px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => aiWrite(d.name)} disabled={isWriting}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        isWritten ? 'border-emerald-400/25 text-emerald-400' : 'border-sky-400/25 bg-sky-400/[0.06] text-sky-400 hover:bg-sky-400/15'
                      } disabled:opacity-50`}>
                      {isWriting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {isWriting ? 'Writing…' : isWritten ? 'Content ready' : 'AI Complete profile'}
                    </button>
                    <a href={`/developers/${d.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
                      <Globe className="h-3 w-3" /> Preview
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        {developers.length} developers loaded from Neon
      </p>
    </div>
  )
}
