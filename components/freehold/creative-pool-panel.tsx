'use client'

/**
 * THE CREATIVE POOL, ON SCREEN — pick pictures, press once, get ads.
 *
 * What this replaces, measured in screens: find a photo, open the designer,
 * export it, download it, open the launcher, re-upload, retype the caption,
 * re-pick the form, launch a second campaign nobody wanted. Six screens and a
 * campaign that should have been three more ads in the ad set that already
 * works.
 *
 * THREE THINGS THE PANEL WILL NOT DO:
 *
 *  · Offer a picture that is already running. It is shown — an operator
 *    looking for what exists wants to see it — but it cannot be selected,
 *    because selecting it produces a duplicate ad and a frequency problem
 *    made worse by the thing meant to fix it.
 *
 *  · Offer to launch a video. Meta video ads need /advideos, an encoding poll
 *    and a thumbnail, none of which this client has. The tile routes to the
 *    reel maker, which is the tool that can actually use it.
 *
 *  · Switch new ads on. They are created PAUSED unless the operator says
 *    otherwise on this screen. Three new ads going live inside an ad set that
 *    is mid-learning is a spending decision, and it stays theirs.
 *
 * THE GENERATIVE HALF is `Design them`: each chosen photograph is composed
 * into a real ad — headline band, price block, terms — from the PROJECT'S OWN
 * FACTS, with a different layout and palette per design so a batch of three is
 * a real set rather than one ad entered three times. It is off by default and
 * disabled outright when the campaign has no project behind it, because a
 * design with no facts to print is a filter, not an ad.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  X, Loader2, Upload, CheckCircle2, AlertTriangle, Wand2, Film, FileText, Images,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { adImageSrc } from '@/lib/meta/ad-image-src'
import { composeProjectAd } from '@/lib/freehold/project-ad'
import {
  isLaunchable, adsToAdd, MAX_ADS_FOR_ROTATION, MIN_ADS_FOR_ROTATION,
  type PoolItem, type PoolReadiness,
} from '@/lib/freehold/creative-pool'

interface PoolProject {
  name: string; slug: string; area: string; developer: string
  startingPriceAED: number | null; paymentPlan: string | null; handoverYear: number | null
}
export interface PoolAdSet { id: string; name: string; liveAds: number; active: boolean }

type Created = { adId: string; creativeId: string; name: string }
type Failed = { name: string; error: string }

const FI = '/freehold-intelligence'

export default function CreativePoolPanel({
  campaignId, adSets, initialAdSetId, onClose, onCreated,
}: {
  campaignId: string
  adSets: PoolAdSet[]
  /** The ad set the recommendation aimed at, when it came from one. */
  initialAdSetId?: string
  onClose: () => void
  onCreated?: () => void
}) {
  const t = useT()
  const [pool, setPool] = useState<PoolItem[] | null>(null)
  const [readiness, setReadiness] = useState<PoolReadiness | null>(null)
  const [project, setProject] = useState<PoolProject | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [design, setDesign] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [composing, setComposing] = useState(false)
  const [adSetId, setAdSetId] = useState(initialAdSetId ?? '')
  const [goLive, setGoLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: Created[]; failed: Failed[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Default to the ad set that is actually running and carrying ads — never a
  // paused one, which is where a new ad would sit and do nothing.
  useEffect(() => {
    if (adSetId) return
    const live = adSets.filter((a) => a.active)
    setAdSetId((live[0] ?? adSets[0])?.id ?? '')
  }, [adSets, adSetId])

  useEffect(() => {
    fetch(`/api/meta/campaigns/${encodeURIComponent(campaignId)}/pool`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setPool(Array.isArray(d?.pool) ? d.pool : [])
        setReadiness(d?.readiness ?? null)
        setProject(d?.project ?? null)
      })
      .catch(() => setPool([]))
  }, [campaignId])

  const items = pool ?? []
  const byId = useCallback((id: string) => items.find((p) => p.id === id) ?? null, [items])
  const target = adSets.find((a) => a.id === adSetId) ?? null

  // How many this ad set is actually short. Shown next to the button so the
  // number is a reason, not a limit that appears from nowhere.
  const short = target ? adsToAdd(target.liveAds, readiness?.freshImages ?? 0) : 0

  function toggle(item: PoolItem) {
    if (item.inUse || !isLaunchable(item)) return
    setResult(null)
    setPicked((cur) => cur.includes(item.id)
      ? cur.filter((x) => x !== item.id)
      : cur.length >= MAX_ADS_FOR_ROTATION ? cur : [...cur, item.id])
  }

  /**
   * Compose the picked photographs into designed ads. Runs on toggle and on
   * every change to the selection, because a preview that lags the selection
   * is a preview of a different ad than the one that would launch.
   */
  const rebuild = useCallback(async (ids: string[], on: boolean) => {
    if (!on || !project || ids.length === 0) { setPreviews({}); return }
    setComposing(true)
    const next: Record<string, string> = {}
    for (const [i, id] of ids.entries()) {
      const it = byId(id)
      if (!it) continue
      const url = await composeProjectAd(
        {
          projectName: project.name, area: project.area, developer: project.developer,
          startingPriceAED: project.startingPriceAED, paymentPlan: project.paymentPlan,
          handoverYear: project.handoverYear,
        },
        {
          from: t('lm.pool.compose.from'),
          total: t('lm.pool.compose.total'),
          handover: (y) => t('lm.pool.compose.handover', { y }),
        },
        { image: adImageSrc(it.url, it.imageHash), variant: i },
      )
      if (url) next[id] = url
    }
    setPreviews(next)
    setComposing(false)
  }, [byId, project, t])

  useEffect(() => { void rebuild(picked, design) }, [picked, design, rebuild])

  /** An upload joins the pool as a fresh, already-selected tile. The file is
   *  pushed to the ad account immediately so the hash — the thing that
   *  actually launches — exists before Create is pressed. */
  async function onUpload(file: File | null) {
    if (!file) return
    setUploading(true); setError('')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('lm.pool.uploadFailed')); return }
      const item: PoolItem = {
        id: `upload:${d.hash}`, source: 'library', kind: 'image',
        url: dataUrl, imageHash: String(d.hash), title: file.name,
      }
      setPool((cur) => [item, ...(cur ?? [])])
      setReadiness((r) => (r ? { ...r, total: r.total + 1, freshImages: r.freshImages + 1 } : r))
      setPicked((cur) => (cur.length >= MAX_ADS_FOR_ROTATION ? cur : [...cur, item.id]))
    } catch { setError(t('lm.pool.uploadFailed')) } finally { setUploading(false) }
  }

  async function create() {
    if (busy || picked.length === 0 || !adSetId) return
    setBusy(true); setError(''); setResult(null)
    try {
      // A designed variant is uploaded first so the ad carries a native hash;
      // an undesigned pick rides its own hash or hosted URL.
      const ads: Array<{ imageHash?: string; imageUrl?: string; name?: string }> = []
      for (const id of picked) {
        const it = byId(id)
        if (!it) continue
        const composed = previews[id]
        if (composed) {
          const res = await fetch('/api/meta/adimages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: composed }),
          })
          const d = await res.json().catch(() => ({}))
          if (!res.ok || !d?.hash) { setError(d?.error || t('lm.pool.uploadFailed')); setBusy(false); return }
          ads.push({ imageHash: String(d.hash), name: it.title })
          continue
        }
        ads.push(it.imageHash ? { imageHash: it.imageHash, name: it.title } : { imageUrl: it.url, name: it.title })
      }

      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(campaignId)}/pool`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSetId, ads, status: goLive ? 'ACTIVE' : 'PAUSED' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok && !Array.isArray(d?.created)) { setError(d?.error || t('lm.pool.createFailed')); return }
      setResult({ created: d.created ?? [], failed: d.failed ?? [] })
      setPicked([]); setPreviews({})
      if ((d.created ?? []).length > 0) onCreated?.()
    } catch { setError(t('lm.pool.createFailed')) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-surface"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('lm.pool.title')}>

        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Images className="h-4 w-4 text-gold" /> {t('lm.pool.title')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {readiness
                ? t('lm.pool.sub', { fresh: readiness.freshImages, used: readiness.inUse, sources: readiness.sources })
                : t('lm.pool.loading')}
            </p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')}
            className="rounded-lg p-1 text-slate-500 transition hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {pool === null && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {pool !== null && items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">{t('lm.pool.empty')}</p>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {/* Upload sits in the grid rather than in a corner: adding a new
                  design is the same action as picking an existing one. */}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-[11px] text-slate-400 transition hover:border-gold/40 hover:text-white disabled:opacity-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('lm.pool.upload')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { void onUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />

              {items.map((it) => {
                const on = picked.includes(it.id)
                const usable = isLaunchable(it) && !it.inUse
                const src = previews[it.id] || adImageSrc(it.url, it.imageHash)
                return (
                  <div key={it.id} className="relative">
                    <button type="button" onClick={() => toggle(it)} disabled={!usable}
                      title={it.inUse ? t('lm.pool.alreadyRunning') : it.title}
                      className={`relative block aspect-square w-full overflow-hidden rounded-xl border transition ${
                        on ? 'border-gold ring-2 ring-gold/40' : 'border-line'
                      } ${usable ? 'hover:border-gold/50' : 'cursor-default opacity-55'}`}>
                      {it.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={it.title} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface-2 text-[10px] text-slate-400">
                          {it.kind === 'video' ? <Film className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                          <span className="line-clamp-2 px-1.5 text-center">{it.title}</span>
                        </span>
                      )}
                      {on && (
                        <span className="absolute end-1.5 top-1.5 rounded-full bg-gold p-0.5 text-ink">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {it.inUse && (
                        <span className="absolute bottom-0 start-0 end-0 bg-black/70 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
                          {t('lm.pool.running')}
                        </span>
                      )}
                    </button>
                    {/* A source is not a dead tile: it routes to the tool that
                        can turn it into something launchable. */}
                    {!isLaunchable(it) && (
                      <Link
                        href={it.kind === 'video'
                          ? `${FI}/creative-studio/reel${project ? `?project=${encodeURIComponent(project.slug)}` : ''}`
                          : `${FI}/creative-studio/ad-designer`}
                        className="mt-1 block text-center text-[10px] text-gold underline-offset-2 hover:underline">
                        {it.kind === 'video' ? t('lm.pool.makeReel') : t('lm.pool.makeDesign')}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {result && (
            <div className="mt-5 space-y-2">
              {result.created.length > 0 && (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3">
                  <p className="text-xs font-semibold text-emerald-200">
                    {t('lm.pool.created', { n: result.created.length, adSet: target?.name ?? '' })}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {goLive ? t('lm.pool.createdLive') : t('lm.pool.createdPaused')}
                  </p>
                </div>
              )}
              {result.failed.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-3 text-[11px] text-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><span className="font-semibold">{f.name}</span> — {f.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line p-5">
          {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              {t('lm.pool.intoAdSet')}
              <select value={adSetId} onChange={(e) => setAdSetId(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-gold/40">
                {adSets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {t('lm.pool.adsNow', { n: a.liveAds })}{a.active ? '' : ` · ${t('lm.pool.paused')}`}
                  </option>
                ))}
              </select>
            </label>

            <label className={`flex items-center gap-2 text-xs ${project ? 'text-slate-300' : 'text-slate-600'}`}
              title={project ? t('lm.pool.designHint') : t('lm.pool.designNoProject')}>
              <input type="checkbox" checked={design} disabled={!project}
                onChange={(e) => setDesign(e.target.checked)} className="accent-[#D4AF37]" />
              <Wand2 className="h-3.5 w-3.5" /> {t('lm.pool.design')}
              {composing && <Loader2 className="h-3 w-3 animate-spin" />}
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)}
                className="accent-[#D4AF37]" />
              {t('lm.pool.goLive')}
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              {target && target.liveAds < MIN_ADS_FOR_ROTATION && short > 0
                ? t('lm.pool.shortBy', { n: short, has: target.liveAds, target: MIN_ADS_FOR_ROTATION })
                : t('lm.pool.rotationOk', { target: MIN_ADS_FOR_ROTATION })}
            </p>
            <button type="button" onClick={() => void create()}
              disabled={busy || composing || picked.length === 0 || !adSetId}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-40">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('lm.pool.create', { n: picked.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
