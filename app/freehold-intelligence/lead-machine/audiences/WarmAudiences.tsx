'use client'

/**
 * THE WARM LAYER'S LIVE STATE — filled by Meta, judged by the same floor
 * that guards the launch.
 *
 * Not a builder: one press creates the three rule audiences (site visitors,
 * page engagers, form openers) and Meta fills them from behaviour forever
 * after. What this panel mostly does is tell the truth about readiness — a
 * rung below the floor shows how many more people it needs, because a
 * retargeting ad set launched at 90 people burns budget proving nothing.
 */
import { useEffect, useState } from 'react'
import { Loader2, Flame } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Status {
  rung: string
  name: string
  audienceId: string | null
  size: number | null
  blocked: 'pixel' | 'page' | null
}
interface WarmData {
  connected: boolean
  statuses: Status[]
  created: string[]
  readiness?: { arms: Array<{ rung: string }>; notReady: Array<{ rung: string; size: number; needs: number }> }
  errors: string[]
}

const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))

export default function WarmAudiences() {
  const t = useT()
  const [data, setData] = useState<WarmData | null>(null)
  const [busy, setBusy] = useState(false)

  async function load(method: 'GET' | 'POST') {
    setBusy(true)
    try {
      const r = await fetch('/api/freehold/ads/audiences/warm', { method, cache: 'no-store' })
      if (r.ok) setData(await r.json())
    } catch { /* panel stays in its last state */ } finally { setBusy(false) }
  }
  useEffect(() => { void load('GET') }, [])

  if (!data || !data.connected) return null

  const ready = new Set((data.readiness?.arms ?? []).map((a) => a.rung))
  const needsByRung = new Map((data.readiness?.notReady ?? []).map((n) => [n.rung, n.needs]))

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-white">
            <Flame className="h-4 w-4 text-gold" /> {t('lm.aud.warm.title')}
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">{t('lm.aud.warm.sub')}</p>
        </div>
        <button type="button" onClick={() => void load('POST')} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[12px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} {t('lm.aud.warm.build')}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {data.statuses.map((s) => (
          <div key={s.rung} className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
            <div className="text-[12px] font-semibold text-white">{t(`lm.aud.warmRung.${s.rung}`)}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {s.blocked
                ? t(`lm.aud.warm.blocked.${s.blocked}`)
                : !s.audienceId
                  ? t('lm.aud.warm.notBuilt')
                  : s.size === null
                    ? t('lm.aud.warm.filling')
                    : ready.has(s.rung)
                      ? t('lm.aud.warm.ready', { size: fmt(s.size) })
                      : t('lm.aud.warm.needs', { size: fmt(s.size), needs: fmt(needsByRung.get(s.rung) ?? 0) })}
            </div>
          </div>
        ))}
      </div>

      {data.errors.length > 0 && (
        <p className="mt-2 text-[11px] text-rose-300">{data.errors.join(' · ')}</p>
      )}
    </section>
  )
}
