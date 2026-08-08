'use client'

/**
 * LOOKALIKE STUDIO — similar people to OUR people, at every level asked for.
 *
 * Four sources, one discipline:
 *   · Closed deals   — the money that already arrived (strongest seed)
 *   · All CRM leads  — everything the machine has talked to, tiered
 *   · Imported lists — what the company brought with it
 *   · A CSV upload   — any list, parsed in the browser
 *
 * DB sources are analysed and TIERED server-side (closed > qualified >
 * well-rated > the rest) so a capped seed keeps its best rows, and the
 * composition is shown before anything uploads. Contacts are hashed before
 * they reach Meta; the browser never sees another row's identifiers.
 *
 * One seed, up to three similarity levels — each saved as its own audience
 * with the real-estate MUST already inside.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldCheck, Upload, Copy } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const COUNTRY_OPTIONS = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'FR', 'GB', 'DE', 'RU', 'US']
const LEVELS = [0.01, 0.03, 0.05, 0.1]
const MAX_LEVELS = 3

type DbSource = 'closed' | 'crm' | 'imported'
type Source = DbSource | 'csv'

interface SourceStat { total: number; tiers: Record<string, number> }

// ─── CSV parsing (client-side; contacts go straight to the seed API) ─────────
const EMAIL_HEADERS = ['email', 'e-mail', 'mail', 'email address']
const PHONE_HEADERS = ['phone', 'mobile', 'phone number', 'tel', 'telephone', 'whatsapp', 'mobile number', 'contact']

function parseCsvContacts(text: string): { email: string; phone: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const split = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === delim && !quoted) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim().replace(/^"|"$/g, ''))
  }
  const headers = split(lines[0]).map((h) => h.toLowerCase().trim())
  const emailIdx = headers.findIndex((h) => EMAIL_HEADERS.some((k) => h.includes(k)))
  const phoneIdx = headers.findIndex((h) => PHONE_HEADERS.some((k) => h.includes(k)))
  if (emailIdx < 0 && phoneIdx < 0) return []
  const rows: { email: string; phone: string }[] = []
  for (const line of lines.slice(1)) {
    const cells = split(line)
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? '') : ''
    const phone = phoneIdx >= 0 ? (cells[phoneIdx] ?? '') : ''
    if ((email && email.includes('@')) || phone.replace(/\D/g, '').length >= 7) rows.push({ email, phone })
  }
  return rows
}

export default function LookalikeStudio({ onSaved }: { onSaved: () => void }) {
  const t = useT()
  const [stats, setStats] = useState<Record<DbSource, SourceStat> | null>(null)
  const [min, setMin] = useState(100)
  const [metaConnected, setMetaConnected] = useState(false)
  const [source, setSource] = useState<Source>('closed')
  const [levels, setLevels] = useState<number[]>([0.03])
  const [name, setName] = useState('')
  const [country, setCountry] = useState('AE')
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [csvContacts, setCsvContacts] = useState<{ email: string; phone: string }[]>([])
  const [csvFileName, setCsvFileName] = useState('')

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/audiences/smart-lookalike')
      const d = await res.json()
      if (res.ok) {
        setStats(d.sources ?? null)
        setMin(d.min ?? 100)
        setMetaConnected(d.metaConnected === true)
      }
    } catch { /* section shows connect hint */ }
  }, [])
  useEffect(() => { void loadStats() }, [loadStats])

  function toggleLevel(l: number) {
    setLevels((ls) => ls.includes(l) ? ls.filter((x) => x !== l) : ls.length >= MAX_LEVELS ? ls : [...ls, l].sort((a, b) => a - b))
  }

  async function onCsvFile(file: File | null) {
    if (!file) return
    setCsvFileName(file.name)
    setCsvContacts(parseCsvContacts(await file.text()))
    setMsg(null)
  }

  const stat = source !== 'csv' && stats ? stats[source] : null
  const seedCount = source === 'csv' ? csvContacts.length : (stat?.total ?? 0)
  const enough = seedCount >= min
  const canCreate = metaConnected && enough && levels.length > 0 && confirm && !working

  async function create() {
    setMsg(null)
    setWorking(true)
    try {
      const payload = source === 'csv'
        ? { confirm: true, name: name.trim() || csvFileName.replace(/\.csv$/i, ''), country, ratios: levels, contacts: csvContacts }
        : { confirm: true, name: name.trim() || undefined, country, ratios: levels, source }
      const url = source === 'csv' ? '/api/freehold/ads/audiences/seed' : '/api/freehold/ads/audiences/smart-lookalike'
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error === 'not_enough' ? t('lm.aud.la.tooFew').replace('{n}', String(d.count)).replace('{min}', String(d.min)) : d?.error || 'Failed')
      setMsg(t('lm.aud.la.done').replace('{n}', String(d.uploaded)).replace('{k}', String(d.audiences?.length ?? levels.length)))
      setConfirm(false); setName(''); setCsvContacts([]); setCsvFileName('')
      onSaved()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') } finally { setWorking(false) }
  }

  const tierLine = (s: SourceStat) => [
    `${t('lm.aud.la.t.closed')} ${s.tiers.closed ?? 0}`,
    `${t('lm.aud.la.t.qualified')} ${s.tiers.qualified ?? 0}`,
    `${t('lm.aud.la.t.wellRated')} ${s.tiers.wellRated ?? 0}`,
    `${t('lm.aud.la.t.other')} ${s.tiers.other ?? 0}`,
  ].join(' · ')

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Copy className="h-4 w-4 text-gold" /> {t('lm.aud.la.title')}
      </div>
      <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.la.sub')}</p>

      {!metaConnected ? (
        <p className="mt-3 text-[12px] text-slate-400">{t('lm.aud.seed.needMeta')}</p>
      ) : (
        <div className="mt-4 space-y-3.5">
          {/* Source */}
          <div className="flex flex-wrap gap-2">
            {(['closed', 'crm', 'imported', 'csv'] as Source[]).map((s) => (
              <button key={s} type="button" onClick={() => { setSource(s); setMsg(null) }}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${source === s ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'}`}>
                {t(`lm.aud.la.source.${s}`)}
                {s !== 'csv' && stats ? <span className="ms-1.5 text-slate-500">{stats[s]?.total ?? 0}</span> : null}
              </button>
            ))}
          </div>

          {/* What the chosen list is made of — shown BEFORE anything uploads. */}
          {source !== 'csv' && stat && (
            <p className={`text-[12px] ${enough ? 'text-slate-300' : 'text-amber-400'}`}>
              {enough
                ? `${t('lm.aud.la.analysis')}: ${tierLine(stat)}`
                : t('lm.aud.la.tooFew').replace('{n}', String(seedCount)).replace('{min}', String(min))}
            </p>
          )}
          {source === 'csv' && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px] font-semibold text-slate-300 transition hover:text-white">
                <Upload className="h-3.5 w-3.5" /> {t('lm.aud.seed.pick')}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onCsvFile(e.target.files?.[0] ?? null)} />
              </label>
              {csvFileName && <span className="text-[12px] text-slate-400">{csvFileName}</span>}
              {csvContacts.length > 0 && (
                <span className={`text-[12px] font-semibold ${enough ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {enough
                    ? t('lm.aud.seed.parsed').replace('{n}', csvContacts.length.toLocaleString())
                    : t('lm.aud.seed.tooFew').replace('{n}', String(csvContacts.length))}
                </span>
              )}
            </div>
          )}

          {enough && (
            <>
              {/* Levels — 1% is the twin, 10% is the neighbourhood. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-slate-500">{t('lm.aud.la.levels')}:</span>
                {LEVELS.map((l) => (
                  <button key={l} type="button" onClick={() => toggleLevel(l)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition ${levels.includes(l) ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                    {Math.round(l * 100)}%
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{t('lm.aud.la.levelsNote')}</p>

              <div className="grid gap-2.5 md:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('lm.aud.seed.namePh')}
                  className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
                  {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-start gap-2 text-[12px] text-slate-300">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" /> {t('lm.aud.seed.confirm')}</span>
              </label>
              <button type="button" onClick={() => void create()} disabled={!canCreate}
                className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
                {working ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.seed.working')}</> : t('lm.aud.la.cta')}
              </button>
            </>
          )}
          {msg && <p className="text-[12px] text-slate-300">{msg}</p>}
          <p className="text-[10.5px] leading-relaxed text-slate-600">{t('lm.aud.la.mustNote')}</p>
        </div>
      )}
    </section>
  )
}
