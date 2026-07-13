'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Trophy, Trash2, Plus, X, ExternalLink, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Funnel = { key: string; count: number; pct: number }
type Quality = { score: number | null; attributed: number; reached: number; qualified: number; won: number; junk: number; funnel: Funnel[] }
type AdRow = { id: string; name: string; status: string; spendAED: number; leads: number; cpl: number }
type AdSetRow = { id: string; name: string; status: string; dailyBudgetAED: number; spendAED: number; leads: number; cpl: number; ads: AdRow[] }
type Member = {
  campaignId: string; label: string; objective: string; name: string
  status: string; running: boolean; spendAED: number; leads: number; cpl: number; quality: Quality
  adSets?: AdSetRow[]
}
type GroupData = {
  group: { id: string; name: string; projectSlug: string | null; createdAt: string }
  members: Member[]
  totals: { spendAED: number; leads: number }
  winners: { cpl: string | null; quality: string | null }
}
type LiveCampaign = { id: string; name: string; objective: string; status: string }

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-AE')}`

function objectiveLabel(obj: string, t: (k: string) => string): string {
  const o = obj.toUpperCase()
  if (o.includes('LEAD')) return t('cg.obj.leadForm')
  if (o.includes('TRAFFIC') || o.includes('LINK') || o.includes('SALES') || o.includes('CONVERS')) return t('cg.obj.landing')
  if (o.includes('REACH') || o.includes('AWARENESS')) return t('cg.obj.awareness')
  return obj || t('cg.obj.other')
}

export default function GroupDetailClient({ id }: { id: string }) {
  const t = useT()
  const router = useRouter()
  const [data, setData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openRollup, setOpenRollup] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/freehold/ads/campaign-groups/${id}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); return }
      const d = await res.json()
      setData(d)
    } catch { setNotFound(true) } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function loadCampaigns() {
    const c = await fetch('/api/meta/campaigns', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
    setCampaigns(Array.isArray(c.campaigns) ? c.campaigns : [])
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/ads/campaign-groups/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('cg.updateFailed')); return false }
      await load()
      return true
    } catch { toast.error(t('cg.updateFailed')); return false } finally { setBusy(false) }
  }

  async function addMember(c: LiveCampaign) {
    const ok = await patch({ action: 'addMember', campaignId: c.id, objective: c.objective, label: objectiveLabel(c.objective, t) })
    if (ok) { toast.success(t('cg.armAdded')); setAdding(false) }
  }
  async function removeMember(campaignId: string) {
    await patch({ action: 'removeMember', campaignId })
  }
  async function del() {
    if (!confirm(t('cg.deleteConfirm'))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/ads/campaign-groups/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error(t('cg.updateFailed')); return }
      toast.success(t('cg.deleted'))
      router.push('/freehold-intelligence/lead-machine/campaigns/groups')
    } catch { toast.error(t('cg.updateFailed')) } finally { setBusy(false) }
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  if (notFound || !data) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-sm text-slate-400">{t('cg.notFound')}</p>
      <Link href="/freehold-intelligence/lead-machine/campaigns/groups" className="mt-3 inline-block text-sm text-gold hover:opacity-80">{t('cg.title')}</Link>
    </div>
  )

  const { group, members, totals, winners } = data
  const memberIds = new Set(members.map((m) => m.campaignId))
  const available = campaigns.filter((c) => !memberIds.has(c.id))

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <Link href="/freehold-intelligence/lead-machine/campaigns/groups" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t('cg.title')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">{group.name}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{t('cg.detail.totals', { spend: aed(totals.spendAED), leads: String(totals.leads) })}</p>
        </div>
        <button type="button" onClick={del} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" /> {t('cg.detail.delete')}
        </button>
      </div>

      {/* Arms — side-by-side comparison */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {members.map((m) => {
          const isCplWinner = winners.cpl === m.campaignId
          const isQualityWinner = winners.quality === m.campaignId
          return (
            <div key={m.campaignId} className="rounded-2xl border border-line bg-surface/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="rounded-full border border-gold/25 bg-gold/[0.06] px-2 py-0.5 text-[10px] font-semibold text-gold">{m.label || objectiveLabel(m.objective, t)}</span>
                  <p className="mt-1.5 truncate text-sm font-semibold text-slate-100">{m.name}</p>
                </div>
                <button type="button" onClick={() => removeMember(m.campaignId)} disabled={busy} title={t('cg.detail.removeArm')} className="shrink-0 text-slate-500 transition hover:text-rose-400"><X className="h-4 w-4" /></button>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 ${m.running ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${m.running ? 'bg-emerald-400' : 'bg-slate-600'}`} /> {m.running ? t('cg.status.running') : t('cg.status.paused')}
                </span>
              </div>

              {/* Metrics */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric label={t('cg.metric.spend')} value={aed(m.spendAED)} />
                <Metric label={t('cg.metric.leads')} value={String(m.leads)} />
                <Metric label={t('cg.metric.cpl')} value={m.cpl > 0 ? aed(m.cpl) : '—'} highlight={isCplWinner} />
              </div>

              {/* CRM quality */}
              <div className="mt-3 rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('cg.quality.title')}</span>
                  <span className={`text-sm font-bold ${isQualityWinner ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {m.quality.score === null ? t('cg.quality.na') : `${m.quality.score}/100`}
                  </span>
                </div>
                {m.quality.attributed > 0 ? (
                  <div className="mt-2 space-y-1">
                    {m.quality.funnel.map((f) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[10px] capitalize text-slate-500">{t(`cg.funnel.${f.key}`)}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div className={`h-full ${f.key === 'junk' ? 'bg-rose-500/60' : 'bg-gold'}`} style={{ width: `${Math.min(100, f.pct)}%` }} />
                        </div>
                        <span className="w-6 shrink-0 text-right text-[10px] text-slate-400">{f.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">{t('cg.quality.noneYet')}</p>
                )}
              </div>

              {/* 3-level rollup: ad sets (audience/language) → ads (creative) */}
              {(m.adSets?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <button type="button" onClick={() => setOpenRollup((prev) => { const n = new Set(prev); n.has(m.campaignId) ? n.delete(m.campaignId) : n.add(m.campaignId); return n })}
                    className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-2/40 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-line-strong">
                    <span>{t('cg.rollup.title', { n: String(m.adSets?.length ?? 0) })}</span>
                    {openRollup.has(m.campaignId) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {openRollup.has(m.campaignId) && (
                    <div className="mt-1.5 space-y-1.5">
                      {(m.adSets ?? []).map((as) => (
                        <div key={as.id} className="rounded-lg border border-line bg-surface/50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-200">{as.name}</span>
                            <span className="shrink-0 text-[10px] text-slate-500">{aed(as.spendAED)} · {as.leads}L · {as.cpl > 0 ? aed(as.cpl) : '—'}</span>
                          </div>
                          {as.ads.length > 0 && (
                            <div className="mt-1 space-y-0.5 border-t border-line pt-1">
                              {as.ads.map((ad) => (
                                <div key={ad.id} className="flex items-center justify-between gap-2 pl-2 text-[10px]">
                                  <span className="min-w-0 flex-1 truncate text-slate-400">{ad.name}</span>
                                  <span className="shrink-0 text-slate-500">{aed(ad.spendAED)} · {ad.leads}L · {ad.cpl > 0 ? aed(ad.cpl) : '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Winner ribbons + link */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {isCplWinner && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><Trophy className="h-3 w-3" /> {t('cg.win.cpl')}</span>}
                {isQualityWinner && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><Trophy className="h-3 w-3" /> {t('cg.win.quality')}</span>}
                <Link href={`/freehold-intelligence/ads-live/meta/${m.campaignId}`} className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-white">
                  {t('cg.detail.open')} <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add an arm */}
      <div className="mt-4">
        {adding ? (
          <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('cg.detail.addArm')}</span>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-white">{t('cg.form.cancel')}</button>
            </div>
            {available.length === 0 ? (
              <p className="text-xs text-slate-500">{t('cg.form.noneAvail')}</p>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {available.map((c) => (
                  <button key={c.id} type="button" onClick={() => addMember(c)} disabled={busy}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-left transition hover:border-gold/40 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{c.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-slate-400">{objectiveLabel(c.objective, t)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => { setAdding(true); loadCampaigns() }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs text-slate-200 transition hover:border-gold/40">
            <Plus className="h-3.5 w-3.5" /> {t('cg.detail.addArm')}
          </button>
        )}
      </div>
      <p className="mt-4 text-[11px] leading-snug text-slate-500">{t('cg.detail.hint')}</p>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${highlight ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-line bg-surface'}`}>
      <div className={`text-sm font-bold ${highlight ? 'text-emerald-300' : 'text-slate-100'}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
