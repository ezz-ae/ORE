'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Layers, Plus, Loader2, ArrowRight, Check, FlaskConical } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Member = { campaignId: string; objective: string; label: string }
type Group = { id: string; name: string; projectSlug: string | null; createdAt: string; members: Member[] }
type LiveCampaign = { id: string; name: string; status: string; objective: string }

// A short human label for a Meta objective — the A/B axis brokers care about.
function objectiveLabel(obj: string, t: (k: string) => string): string {
  const o = obj.toUpperCase()
  if (o.includes('LEAD')) return t('cg.obj.leadForm')
  if (o.includes('TRAFFIC') || o.includes('LINK') || o.includes('SALES') || o.includes('CONVERS')) return t('cg.obj.landing')
  if (o.includes('REACH') || o.includes('AWARENESS')) return t('cg.obj.awareness')
  return obj || t('cg.obj.other')
}

export default function GroupsClient() {
  const t = useT()
  const [groups, setGroups] = useState<Group[]>([])
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, c] = await Promise.all([
        fetch('/api/freehold/ads/campaign-groups', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/meta/campaigns', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ])
      setGroups(Array.isArray(g.groups) ? g.groups : [])
      setCampaigns(Array.isArray(c.campaigns) ? c.campaigns.map((x: LiveCampaign) => ({ id: x.id, name: x.name, status: x.status, objective: x.objective })) : [])
    } catch { setGroups([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = new Set(groups.flatMap((g) => g.members.map((m) => m.campaignId)))
  const available = campaigns.filter((c) => !grouped.has(c.id))

  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function create() {
    if (!name.trim()) { toast.error(t('cg.needName')); return }
    if (picked.size < 2) { toast.error(t('cg.needTwo')); return }
    setCreating(true)
    try {
      const members = campaigns.filter((c) => picked.has(c.id)).map((c) => ({
        campaignId: c.id, objective: c.objective, label: objectiveLabel(c.objective, t),
      }))
      const res = await fetch('/api/freehold/ads/campaign-groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), members }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.group) { toast.error(d.error || t('cg.createFailed')); return }
      toast.success(t('cg.created'))
      setName(''); setPicked(new Set()); setShowForm(false); load()
    } catch { toast.error(t('cg.createFailed')) } finally { setCreating(false) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <Link href="/freehold-intelligence/lead-machine/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t('cg.backCampaigns')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white"><Layers className="h-5 w-5 text-gold" /> {t('cg.title')}</h1>
          <p className="mt-0.5 max-w-xl text-xs text-slate-500">{t('cg.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
          <Plus className="h-3.5 w-3.5" /> {t('cg.new')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mt-5 rounded-2xl border border-line bg-surface-2/40 p-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('cg.form.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cg.form.namePh')}
            className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/30" />
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('cg.form.pick')}</span>
            <span className="text-[11px] text-slate-500">{t('cg.form.picked', { n: String(picked.size) })}</span>
          </div>
          {available.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface/50 px-3 py-4 text-center text-xs text-slate-500">{t('cg.form.noneAvail')}</p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {available.map((c) => {
                const on = picked.has(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${on ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface hover:border-line-strong'}`}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-gold bg-gold text-ink' : 'border-line'}`}>{on && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{c.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-slate-400">{objectiveLabel(c.objective, t)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={create} disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} {t('cg.form.create')}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setPicked(new Set()); setName('') }} className="text-xs text-slate-400 hover:text-white">{t('cg.form.cancel')}</button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">{t('cg.form.hint')}</p>
        </div>
      )}

      {/* Group list */}
      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
      ) : groups.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface-2/30 px-6 py-12 text-center">
          <Layers className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-300">{t('cg.empty.title')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('cg.empty.body')}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <Link key={g.id} href={`/freehold-intelligence/lead-machine/campaigns/groups/${g.id}`}
              className="group rounded-2xl border border-line bg-surface/50 p-4 transition hover:border-line-strong hover:bg-surface-2">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">{g.name}
                  <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-slate-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100" />
                </h2>
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-slate-400">{t('cg.armCount', { n: String(g.members.length) })}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.members.slice(0, 4).map((m) => (
                  <span key={m.campaignId} className="rounded-full border border-gold/25 bg-gold/[0.06] px-2 py-0.5 text-[10px] text-gold">
                    {m.label || objectiveLabel(m.objective, t)}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
