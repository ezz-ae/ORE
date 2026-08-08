'use client'

/**
 * CRM AUDIENCES — a popup, not a form.
 *
 * Three things the company's own lead book can become, in plain words:
 *   · Rated leads     — pick a minimum mark (5 to 10, the same rating used
 *                       everywhere in the system) and target everyone at or
 *                       above it.
 *   · Smart retargeting — the leads who showed interest but never bought.
 *                       Anyone the team is still working on is left out.
 *   · Lead lookalike  — new people similar to your best-rated leads.
 *
 * One type on screen at a time. Contacts are hashed before Meta sees them.
 */
import { useEffect, useState } from 'react'
import { X, Loader2, ShieldCheck, Users, RotateCcw, Copy } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const RATES = [5, 6, 7, 8, 9, 10]
const LEVELS = [0.01, 0.03, 0.05, 0.1]

type CrmType = 'rated' | 'retargeting' | 'lookalike'

export default function CrmAudiences({ open, onClose, onSaved }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [counts, setCounts] = useState<{ rated: Record<number, number>; retargeting: number; min: number; metaConnected: boolean } | null>(null)
  const [type, setType] = useState<CrmType>('rated')
  const [minRating, setMinRating] = useState(7)
  const [levels, setLevels] = useState<number[]>([0.03])
  const [country, setCountry] = useState('AE')
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMsg(null)
    fetch('/api/freehold/ads/audiences/crm')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCounts(d) })
      .catch(() => {})
  }, [open])

  if (!open) return null

  const ratedCount = counts?.rated?.[minRating] ?? 0
  const count = type === 'retargeting' ? (counts?.retargeting ?? 0) : ratedCount
  const min = counts?.min ?? 100
  const enough = count >= min

  async function create() {
    setMsg(null)
    setWorking(true)
    try {
      const url = type === 'lookalike'
        ? '/api/freehold/ads/audiences/smart-lookalike'
        : '/api/freehold/ads/audiences/crm'
      const payload = type === 'lookalike'
        ? { confirm: true, source: 'rated', minRating, ratios: levels, country }
        : { confirm: true, type, minRating }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) {
        throw new Error(d?.error === 'not_enough'
          ? t('lm.aud.la.tooFew').replace('{n}', String(d.count)).replace('{min}', String(d.min))
          : d?.error || 'Failed')
      }
      setMsg(t('lm.aud.crm.done'))
      setConfirm(false)
      onSaved()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') } finally { setWorking(false) }
  }

  const TYPES: { id: CrmType; icon: typeof Users }[] = [
    { id: 'rated', icon: Users },
    { id: 'retargeting', icon: RotateCcw },
    { id: 'lookalike', icon: Copy },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold text-white">{t('lm.aud.crm.title')}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t('lm.aud.crm.sub')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 transition hover:text-white" aria-label={t('lm.aud.crm.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The three types, as cards. */}
        <div className="mt-4 grid gap-2">
          {TYPES.map(({ id, icon: Icon }) => (
            <button
              key={id} type="button"
              onClick={() => { setType(id); setMsg(null); setConfirm(false) }}
              className={`flex items-start gap-3 rounded-xl border p-3 text-start transition ${
                type === id ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface-2 hover:border-slate-600'
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${type === id ? 'text-gold' : 'text-slate-500'}`} />
              <span>
                <span className={`block text-[13px] font-semibold ${type === id ? 'text-gold' : 'text-white'}`}>{t(`lm.aud.crm.${id}.name`)}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-400">{t(`lm.aud.crm.${id}.desc`)}</span>
              </span>
            </button>
          ))}
        </div>

        {/* The chosen type's few dials. */}
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {(type === 'rated' || type === 'lookalike') && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-slate-500">{t('lm.aud.crm.minRate')}:</span>
              {RATES.map((r) => (
                <button key={r} type="button" onClick={() => setMinRating(r)}
                  className={`h-8 w-8 rounded-full border text-[12px] font-semibold transition ${
                    minRating === r ? 'border-gold/60 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          )}
          {type === 'lookalike' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-slate-500">{t('lm.aud.la.levels')}:</span>
              {LEVELS.map((l) => (
                <button key={l} type="button"
                  onClick={() => setLevels((ls) => ls.includes(l) ? ls.filter((x) => x !== l) : ls.length >= 3 ? ls : [...ls, l].sort((a, b) => a - b))}
                  className={`rounded-full border px-3 py-1 text-[12px] transition ${levels.includes(l) ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                  {Math.round(l * 100)}%
                </button>
              ))}
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-slate-200 outline-none focus:border-gold/40">
                {['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'GB'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <p className={`text-[12px] font-semibold ${enough ? 'text-emerald-400' : 'text-amber-400'}`}>
            {counts == null
              ? t('lm.aud.crm.counting')
              : enough
                ? t('lm.aud.crm.count').replace('{n}', count.toLocaleString())
                : t('lm.aud.la.tooFew').replace('{n}', String(count)).replace('{min}', String(min))}
          </p>

          {counts != null && !counts.metaConnected && (
            <p className="text-[12px] text-slate-400">{t('lm.aud.seed.needMeta')}</p>
          )}

          {enough && counts?.metaConnected && (
            <>
              <label className="flex items-start gap-2 text-[12px] text-slate-300">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" /> {t('lm.aud.seed.confirm')}</span>
              </label>
              <button type="button" onClick={() => void create()} disabled={!confirm || working || (type === 'lookalike' && levels.length === 0)}
                className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
                {working ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.seed.working')}</> : t('lm.aud.crm.cta')}
              </button>
            </>
          )}
          {msg && <p className="text-[12px] text-slate-300">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
