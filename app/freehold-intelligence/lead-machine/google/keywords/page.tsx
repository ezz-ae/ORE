'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Plus,
  X,
} from 'lucide-react'
import type { GoogleKeyword, NegativeKeyword, GoogleKeywordMatchType } from '@/lib/google/types'
import { UAE_REAL_ESTATE_KEYWORD_THEMES } from '@/lib/google/keyword-themes'
import { useT } from '@/lib/i18n/provider'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMicros(m: number): string {
  const aed = m / 1_000_000
  if (aed >= 1000) return `AED ${(aed / 1000).toFixed(1)}K`
  return `AED ${aed.toFixed(2)}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

// ─── Badge colour maps ────────────────────────────────────────────────────────

const MATCH_BADGE: Record<GoogleKeywordMatchType, string> = {
  BROAD:  'bg-surface-2 text-slate-500 border-line',
  PHRASE: 'bg-teal-400/10 text-slate-400 border-teal-400/20',
  EXACT:  'bg-gold/10 text-gold border-gold/20',
}

// i18n keys — render with t(MATCH_LABEL[type])
const MATCH_LABEL: Record<GoogleKeywordMatchType, string> = {
  BROAD:  'lm.google.common.broad',
  PHRASE: 'lm.google.common.phrase',
  EXACT:  'lm.google.common.exact',
}

const INTENT_BADGE: Record<string, string> = {
  high:   'bg-gold/10 text-gold-bright border-gold/20',
  medium: 'bg-teal-400/10 text-slate-400 border-teal-400/20',
  brand:  'bg-violet-400/10 text-slate-400 border-violet-400/20',
}

// ─── Quality score indicator ──────────────────────────────────────────────────

function QualityScore({ score }: { score: number }) {
  const color =
    score <= 3 ? 'bg-red-400' : score <= 6 ? 'bg-yellow-400' : 'bg-gold'
  const textColor =
    score <= 3 ? 'text-red-400' : score <= 6 ? 'text-yellow-400' : 'text-gold'

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
          <span
            key={d}
            className={`inline-block h-1.5 w-1.5 rounded-full transition ${
              d <= score ? color : 'bg-surface-2'
            }`}
          />
        ))}
      </div>
      <span className={`text-sm font-medium tabular-nums ${textColor}`}>{score}</span>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchFilter = 'ALL' | GoogleKeywordMatchType

interface KeywordsApiResponse {
  keywords?: GoogleKeyword[]
  negatives?: NegativeKeyword[]
  error?: string
  type?: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoogleKeywordsPage() {
  const t = useT()
  const [data, setData]               = useState<KeywordsApiResponse>({})
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('ALL')
  const [negsOpen, setNegsOpen]       = useState(false)
  const [newKw, setNewKw]             = useState('')
  const [newMatch, setNewMatch]       = useState<GoogleKeywordMatchType>('BROAD')
  const [adding, setAdding]           = useState(false)
  // Target campaign for new keywords — when connected, the API adds the
  // keyword LIVE to that campaign's first ad group.
  const [campaignOpts, setCampaignOpts] = useState<{ id: string; name: string }[]>([])
  const [campaignSel, setCampaignSel]   = useState('')

  useEffect(() => {
    fetch('/api/google/campaigns')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const opts = Array.isArray(d?.campaigns)
          ? (d.campaigns as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }))
          : []
        setCampaignOpts(opts)
        setCampaignSel((prev) => prev || opts[0]?.id || '')
      })
      .catch(() => {})
  }, [])

  async function addKeyword() {
    const text = newKw.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/google/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, matchType: newMatch, campaignId: campaignSel || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error)
      setNewKw('')
      toast.success(t('lm.google.keywords.added'))
      fetchData(true)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('lm.google.actions.failed'))
    } finally {
      setAdding(false)
    }
  }

  async function removeKeyword(kw: GoogleKeyword) {
    try {
      // Live keywords are removed by criterion resource name; local drafts by id.
      const qs = kw.id.startsWith('local-')
        ? `id=${encodeURIComponent(kw.id)}`
        : `id=${encodeURIComponent(kw.id)}&resourceName=${encodeURIComponent(kw.resourceName)}`
      const res = await fetch(`/api/google/keywords?${qs}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(t('lm.google.keywords.removed'))
      fetchData(true)
    } catch {
      toast.error(t('lm.google.actions.failed'))
    }
  }

  async function fetchData(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/google/keywords?negatives=true')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: t('lm.google.err.network') })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const keywords  = data.keywords  ?? []
  const negatives = data.negatives ?? []

  // ─ Derived stats ─
  const broadCount  = keywords.filter((k) => k.matchType === 'BROAD').length
  const phraseCount = keywords.filter((k) => k.matchType === 'PHRASE').length
  const exactCount  = keywords.filter((k) => k.matchType === 'EXACT').length
  const totalImps   = keywords.reduce((s, k) => s + (k.metrics?.impressions ?? 0), 0)
  const qsKeywords  = keywords.filter((k) => k.qualityScore != null)
  const avgQS       = qsKeywords.length
    ? qsKeywords.reduce((s, k) => s + (k.qualityScore ?? 0), 0) / qsKeywords.length
    : null

  // ─ Filter + sort ─
  const filtered = keywords
    .filter((k) => matchFilter === 'ALL' || k.matchType === matchFilter)
    .sort((a, b) => (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0))

  const isConfigErr = data.type === 'config'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
            <Search className="h-3.5 w-3.5" />
            {t('lm.google.keywords.title')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {t('lm.google.kw.heading')} /<br />
            <span className="text-slate-500">
              {loading
                ? '…'
                : isConfigErr
                  ? t('lm.google.sub.notConnected')
                  : t('lm.google.kw.countSub', { n: keywords.length })}
            </span>
          </h1>
        </section>

        <div className="mt-7 sm:mt-10">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('lm.google.common.refresh')}
          </button>
        </div>
      </div>

      {/* ── Config error ── */}
      {isConfigErr && (
        <div className="mt-8 rounded-[20px] border border-line bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.google.common.notConnected')}</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/google"
                className="mt-3 inline-flex items-center gap-1 text-xs text-[#4285F4]/80 transition hover:text-[#4285F4]"
              >
                {t('lm.google.common.setup')} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── General error ── */}
      {data.error && !isConfigErr && (
        <div className="mt-8 rounded-[18px] border border-line bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-12 text-center text-[14px] text-slate-500">{t('lm.google.keywords.title')}…</div>
      )}

      {!loading && !isConfigErr && (
        <>
          {/* ── Stats row ── */}
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: t('lm.google.keywords.filter.all'),    value: keywords.length,            color: 'text-white'       },
              { label: t('lm.google.common.broad'),           value: broadCount,                 color: 'text-slate-400'    },
              { label: t('lm.google.common.phrase'),          value: phraseCount,                color: 'text-slate-400'     },
              { label: t('lm.google.common.exact'),           value: exactCount,                 color: 'text-gold' },
              { label: t('lm.google.common.impressions'),     value: totalImps.toLocaleString(), color: 'text-white'       },
              {
                label: t('lm.google.common.qualityScore'),
                value: avgQS != null ? avgQS.toFixed(1) : '—',
                color:
                  avgQS == null
                    ? 'text-slate-500'
                    : avgQS >= 7
                      ? 'text-gold'
                      : avgQS >= 4
                        ? 'text-yellow-400'
                        : 'text-red-400',
              },
            ].map((s) => (
              <div key={s.label} className="rounded-[16px] border border-line bg-surface px-4 py-3">
                <div className={`text-[22px] font-semibold leading-none tabular-nums ${s.color}`}>
                  {s.value}
                </div>
                <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Match type filter tabs ── */}
          <div className="mt-8 flex items-center gap-1 rounded-[14px] border border-line bg-surface p-1 w-fit">
            {(['ALL', 'BROAD', 'PHRASE', 'EXACT'] as MatchFilter[]).map((f) => {
              const label =
                f === 'ALL'
                  ? `${t('lm.google.keywords.filter.all')} (${keywords.length})`
                  : `${t(MATCH_LABEL[f as GoogleKeywordMatchType])} (${keywords.filter((k) => k.matchType === f).length})`
              return (
                <button
                  key={f}
                  onClick={() => setMatchFilter(f)}
                  className={`rounded-[10px] px-3.5 py-1.5 text-xs font-medium transition ${
                    matchFilter === f
                      ? 'bg-[#4285F4] text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── Add keyword ── */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }}
              placeholder={t('lm.google.keywords.addPlaceholder')}
              className="min-w-[200px] flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#4285F4]/50"
            />
            <select
              value={newMatch}
              onChange={(e) => setNewMatch(e.target.value as GoogleKeywordMatchType)}
              className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="BROAD">{t('lm.google.keywords.matchBroad')}</option>
              <option value="PHRASE">{t('lm.google.keywords.matchPhrase')}</option>
              <option value="EXACT">{t('lm.google.keywords.matchExact')}</option>
            </select>
            {campaignOpts.length > 0 && (
              <select
                value={campaignSel}
                onChange={(e) => setCampaignSel(e.target.value)}
                title={t('lm.google.keywords.campaignLabel')}
                aria-label={t('lm.google.keywords.campaignLabel')}
                className="max-w-[220px] truncate rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                {campaignOpts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={addKeyword}
              disabled={adding || !newKw.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4285F4] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> {t('lm.google.keywords.addBtn')}
            </button>
          </div>

          {/* ── Keywords table ── */}
          {filtered.length > 0 ? (
            <>
            {/* LITE: stacked keyword cards on phones — the 8-column grid stays md+ */}
            <div className="mt-4 divide-y divide-white/[0.035] overflow-hidden rounded-[20px] border border-line bg-surface md:hidden">
              {filtered.map((kw) => (
                <div key={kw.id} className="px-4 py-3.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kw.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{kw.text}</span>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${MATCH_BADGE[kw.matchType]}`}>
                      {t(MATCH_LABEL[kw.matchType])}
                    </span>
                    {(kw.id.startsWith('local-') || kw.resourceName) && (
                      <button onClick={() => removeKeyword(kw)} title={t('common.remove')}
                        className="shrink-0 rounded p-0.5 text-slate-600 transition hover:bg-white/[0.06] hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
                    <span>{kw.metrics?.clicks.toLocaleString() ?? '—'} · {kw.metrics?.ctr != null ? fmtPct(kw.metrics.ctr) : '—'}</span>
                    <span>{kw.metrics?.averageCpcMicros != null ? fmtMicros(kw.metrics.averageCpcMicros) : '—'}</span>
                    <span className="font-medium text-slate-300">{kw.metrics?.conversions != null ? Math.round(kw.metrics.conversions) : '—'} {t('lm.google.kw.convSuffix')}</span>
                    {kw.qualityScore != null && <QualityScore score={kw.qualityScore} />}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-hidden rounded-[20px] border border-line bg-surface md:block">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_140px_80px_72px_80px_80px_40px] gap-x-3 border-b border-line px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                <span>{t('lm.google.kw.th.keyword')}</span>
                <span>{t('lm.google.kw.th.match')}</span>
                <span>{t('lm.google.common.qualityScore')}</span>
                <span className="text-right">{t('lm.google.kw.th.impr')}</span>
                <span className="text-right">{t('lm.google.common.clicks')}</span>
                <span className="text-right">{t('lm.google.overview.stat.ctr')}</span>
                <span className="text-right">{t('lm.google.overview.stat.cpc')}</span>
                <span className="text-right">{t('lm.google.kw.th.conv')}</span>
              </div>

              <div className="divide-y divide-white/[0.035]">
                {filtered.map((kw) => (
                  <div
                    key={kw.id}
                    className="grid grid-cols-[1fr_100px_140px_80px_72px_80px_80px_40px] items-center gap-x-3 px-5 py-3 text-xs transition hover:bg-surface-2"
                  >
                    {/* Keyword text + status dot */}
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          kw.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-white/20'
                        }`}
                      />
                      <span className="truncate font-medium text-white">{kw.text}</span>
                      {(kw.id.startsWith('local-') || kw.resourceName) && (
                        <button
                          onClick={() => removeKeyword(kw)}
                          title={t('common.remove')}
                          className="ml-auto shrink-0 rounded p-0.5 text-slate-600 transition hover:bg-white/[0.06] hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Match type badge */}
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${MATCH_BADGE[kw.matchType]}`}
                    >
                      {t(MATCH_LABEL[kw.matchType])}
                    </span>

                    {/* Quality score */}
                    <div>
                      {kw.qualityScore != null ? (
                        <QualityScore score={kw.qualityScore} />
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </div>

                    {/* Metrics */}
                    <span className="text-right text-slate-400">
                      {kw.metrics?.impressions.toLocaleString() ?? '—'}
                    </span>
                    <span className="text-right text-slate-400">
                      {kw.metrics?.clicks.toLocaleString() ?? '—'}
                    </span>
                    <span className="text-right text-slate-400">
                      {kw.metrics?.ctr != null ? fmtPct(kw.metrics.ctr) : '—'}
                    </span>
                    <span className="text-right text-slate-400">
                      {kw.metrics?.averageCpcMicros != null
                        ? fmtMicros(kw.metrics.averageCpcMicros)
                        : '—'}
                    </span>
                    <span className="text-right font-medium text-slate-300">
                      {kw.metrics?.conversions != null
                        ? Math.round(kw.metrics.conversions)
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </>
          ) : (
            /* ── Empty state ── */
            <div className="mt-8 rounded-[24px] border border-line bg-surface px-6 py-14 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-[#4285F4]/30" />
              <div className="text-[16px] font-semibold text-white">{t('lm.google.keywords.empty')}</div>
              <p className="mt-2 text-sm text-slate-500">
                {matchFilter !== 'ALL'
                  ? t('lm.google.kw.emptyFiltered', { match: t(MATCH_LABEL[matchFilter as GoogleKeywordMatchType]).toLowerCase() })
                  : t('lm.google.kw.emptyAdd')}
              </p>
            </div>
          )}

          {/* ── Negative keywords (collapsible) ── */}
          {negatives.length > 0 && (
            <section className="mt-8">
              <button
                onClick={() => setNegsOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-[16px] border border-line bg-surface px-5 py-4 text-left transition hover:border-white/[0.10]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white">{t('lm.google.kw.negatives')}</span>
                  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-300">
                    {t('lm.google.kw.exclusions', { n: negatives.length })}
                  </span>
                </div>
                {negsOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {negsOpen && (
                <div className="mt-1 overflow-hidden rounded-[16px] border border-line bg-surface">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px_120px] gap-x-3 border-b border-line px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                    <span>{t('lm.google.kw.th.keyword')}</span>
                    <span>{t('lm.google.kw.th.match')}</span>
                    <span>{t('lm.google.kw.th.campaign')}</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {negatives.map((neg) => (
                      <div
                        key={neg.id}
                        className="grid grid-cols-[1fr_80px_120px] items-center gap-x-3 px-5 py-2.5 text-xs"
                      >
                        <span className="truncate font-medium text-slate-300">{neg.text}</span>
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${MATCH_BADGE[neg.matchType]}`}
                        >
                          {t(MATCH_LABEL[neg.matchType])}
                        </span>
                        <span className="truncate text-sm text-slate-500">{neg.campaignId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Keyword Themes ── */}
          <section className="mt-12">
            <div className="mb-5">
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
                {t('lm.google.kw.themesTitle')}
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {t('lm.google.kw.themesBody')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {UAE_REAL_ESTATE_KEYWORD_THEMES.map((theme) => (
                <div
                  key={theme.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-5"
                >
                  {/* Theme header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{theme.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                            INTENT_BADGE[theme.intent] ?? INTENT_BADGE.medium
                          }`}
                        >
                          {theme.intent === 'high'
                            ? t('lm.google.kw.intentHigh')
                            : theme.intent === 'brand'
                              ? t('lm.google.kw.intentBrand')
                              : t('lm.google.kw.intentMedium')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {theme.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-sm font-medium text-slate-400">
                      {t('lm.google.kw.kwCount', { n: theme.keywords.length })}
                    </span>
                  </div>

                  {/* First 5 keywords */}
                  <div className="space-y-1">
                    {theme.keywords.slice(0, 5).map((kw, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-xs text-slate-400">{kw.text}</span>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${MATCH_BADGE[kw.matchType]}`}
                        >
                          {t(MATCH_LABEL[kw.matchType])}
                        </span>
                      </div>
                    ))}
                    {theme.keywords.length > 5 && (
                      <p className="text-sm text-slate-600">
                        {t('lm.google.kw.moreKeywords', { n: theme.keywords.length - 5 })}
                      </p>
                    )}
                  </div>

                  {/* Add to campaign */}
                  <div className="mt-1 flex justify-end">
                    <Link
                      href="/freehold-intelligence/lead-machine/google/campaigns/new"
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-1.5 text-xs text-slate-400 transition hover:border-[#4285F4]/30 hover:text-white"
                    >
                      {t('lm.google.kw.addToCampaign')} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
