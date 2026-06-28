'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Link as LinkIcon,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ExternalLink,
  Phone,
  MapPin,
  MessageSquare,
  Tag,
  Layers,
  Info,
  FileText,
  Plus,
} from 'lucide-react'
import type {
  GoogleExtension,
  GoogleSitelinkExtension,
  GoogleCalloutExtension,
  GoogleCallExtension,
} from '@/lib/google/types'
import { useT } from '@/lib/i18n/provider'

// ─── API shape ────────────────────────────────────────────────────────────────

interface ExtensionsApiResponse {
  extensions?: GoogleExtension[]
  error?: string
  type?: string
}

// ─── Extension type helpers ───────────────────────────────────────────────────

type ExtensionFilter = 'ALL' | 'SITELINK' | 'CALLOUT' | 'CALL' | 'LOCATION' | 'LEAD_FORM'

const FILTER_TABS: { label: string; value: ExtensionFilter }[] = [
  { label: 'All',       value: 'ALL'       },
  { label: 'Sitelinks', value: 'SITELINK'  },
  { label: 'Callouts',  value: 'CALLOUT'   },
  { label: 'Call',      value: 'CALL'      },
  { label: 'Location',  value: 'LOCATION'  },
  { label: 'Lead Form', value: 'LEAD_FORM' },
]

const TYPE_ICON: Record<string, React.ReactNode> = {
  SITELINK:  <LinkIcon   className="h-4 w-4 text-[#4285F4]/60" />,
  CALLOUT:   <Tag        className="h-4 w-4 text-slate-400/60" />,
  CALL:      <Phone      className="h-4 w-4 text-gold/60" />,
  LOCATION:  <MapPin     className="h-4 w-4 text-orange-400/60" />,
  LEAD_FORM: <FileText   className="h-4 w-4 text-slate-400/60" />,
}

const TYPE_LABEL: Record<string, string> = {
  SITELINK:           'Sitelinks',
  CALLOUT:            'Callouts',
  CALL:               'Call extensions',
  LOCATION:           'Location extensions',
  LEAD_FORM:          'Lead form extensions',
  STRUCTURED_SNIPPET: 'Structured snippets',
}

// ─── Individual extension renders ────────────────────────────────────────────

function SitelinkCard({ ext }: { ext: GoogleSitelinkExtension }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-4 transition hover:border-[#4285F4]/20">
      <div className="text-sm font-semibold text-white">{ext.linkText}</div>
      {ext.description1 && (
        <div className="mt-1 text-xs text-slate-400">{ext.description1}</div>
      )}
      {ext.description2 && (
        <div className="text-xs text-slate-400">{ext.description2}</div>
      )}
      {ext.finalUrls[0] && (
        <div className="mt-2 truncate font-mono text-sm text-slate-600">
          {ext.finalUrls[0]}
        </div>
      )}
    </div>
  )
}

function CalloutCard({ ext }: { ext: GoogleCalloutExtension }) {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/[0.07] px-3 py-1.5 text-xs font-medium text-slate-400">
      {ext.calloutText}
    </span>
  )
}

function CallCard({ ext }: { ext: GoogleCallExtension }) {
  return (
    <div className="flex items-center gap-4 rounded-[16px] border border-line bg-surface p-4 transition hover:border-gold/20">
      <Phone className="h-5 w-5 shrink-0 text-gold/60" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">
          +{ext.countryCode} {ext.phoneNumber}
        </div>
      </div>
      {ext.callOnly && (
        <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
          Call-only
        </span>
      )}
    </div>
  )
}

function LocationCard({ ext }: { ext: Extract<GoogleExtension, { type: 'LOCATION' }> }) {
  return (
    <div className="flex items-start gap-4 rounded-[16px] border border-line bg-surface p-4 transition hover:border-orange-400/20">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-400/60" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{ext.businessName}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {ext.addressLine1}, {ext.city}, {ext.countryCode}
        </div>
      </div>
    </div>
  )
}

function LeadFormCard({ ext }: { ext: Extract<GoogleExtension, { type: 'LEAD_FORM' }> }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-4 transition hover:border-violet-400/20">
      <div className="text-sm font-semibold text-white">{ext.headline}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{ext.description}</p>
      {ext.fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ext.fields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-2.5 py-0.5 text-xs font-medium text-slate-400"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Extension group section ──────────────────────────────────────────────────

function ExtensionGroup({
  type,
  extensions,
}: {
  type: string
  extensions: GoogleExtension[]
}) {
  const icon  = TYPE_ICON[type]  ?? <Layers className="h-4 w-4 text-slate-500" />
  const label = TYPE_LABEL[type] ?? type

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-slate-500">
          {extensions.length}
        </span>
      </div>

      {/* Callouts rendered as a flex-wrap pill list */}
      {type === 'CALLOUT' ? (
        <div className="flex flex-wrap gap-2">
          {(extensions as GoogleCalloutExtension[]).map((ext) => (
            <CalloutCard key={ext.id} ext={ext} />
          ))}
        </div>
      ) : type === 'SITELINK' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(extensions as GoogleSitelinkExtension[]).map((ext) => (
            <SitelinkCard key={ext.id} ext={ext} />
          ))}
        </div>
      ) : type === 'CALL' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(extensions as GoogleCallExtension[]).map((ext) => (
            <CallCard key={ext.id} ext={ext} />
          ))}
        </div>
      ) : type === 'LOCATION' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(extensions as Extract<GoogleExtension, { type: 'LOCATION' }>[]).map((ext) => (
            <LocationCard key={ext.id} ext={ext} />
          ))}
        </div>
      ) : type === 'LEAD_FORM' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(extensions as Extract<GoogleExtension, { type: 'LEAD_FORM' }>[]).map((ext) => (
            <LeadFormCard key={ext.id} ext={ext} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

// ─── Recommended extension card ───────────────────────────────────────────────

function RecommendedCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-[16px] border border-dashed border-line bg-surface-2 p-5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      <span className="mt-0.5 shrink-0 rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-2.5 py-0.5 text-xs font-medium text-[#4285F4]">
        Recommended
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoogleExtensionsPage() {
  const t = useT()
  const [data, setData]             = useState<ExtensionsApiResponse>({})
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]         = useState<ExtensionFilter>('ALL')
  const [newText, setNewText]       = useState('')
  const [newType, setNewType]       = useState<'SITELINK' | 'CALLOUT'>('SITELINK')
  const [adding, setAdding]         = useState(false)

  async function addExtension() {
    const text = newText.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/google/extensions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, text }),
      })
      if (!res.ok) throw new Error()
      setNewText('')
      toast.success(t('lm.google.extensions.added'))
      fetchData(true)
    } catch {
      toast.error(t('lm.google.actions.failed'))
    } finally { setAdding(false) }
  }

  async function fetchData(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/google/extensions')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Network error — could not reach Google Ads API' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const extensions  = data.extensions ?? []
  const isConfigErr = data.type === 'config'

  // ─ Group by type ─
  const byType = extensions.reduce<Record<string, GoogleExtension[]>>((acc, ext) => {
    if (!acc[ext.type]) acc[ext.type] = []
    acc[ext.type].push(ext)
    return acc
  }, {})

  const sitelinks  = byType['SITELINK']  ?? []
  const callouts   = byType['CALLOUT']   ?? []
  const calls      = byType['CALL']      ?? []
  const locations  = byType['LOCATION']  ?? []
  const leadForms  = byType['LEAD_FORM'] ?? []

  // ─ Filtered groups ─
  const filteredGroups: [string, GoogleExtension[]][] =
    filter === 'ALL'
      ? Object.entries(byType)
      : Object.entries(byType).filter(([type]) => type === filter)

  // ─ Recommended: what's missing ─
  const recommended: { icon: React.ReactNode; title: string; description: string }[] = []
  if (sitelinks.length === 0)
    recommended.push({
      icon: <LinkIcon className="h-4 w-4 text-[#4285F4]/60" />,
      title: 'Add sitelinks',
      description:
        'Sitelinks show additional links below your ad, directing users to high-value pages. They increase click area and CTR by up to 20%.',
    })
  if (callouts.length === 0)
    recommended.push({
      icon: <Tag className="h-4 w-4 text-slate-400/60" />,
      title: 'Add callouts',
      description:
        'Callout text highlights key selling points — "No agency fees", "Payment plans available", "DLD registered". Adds real estate credibility.',
    })
  if (calls.length === 0)
    recommended.push({
      icon: <Phone className="h-4 w-4 text-gold/60" />,
      title: 'Add a call extension',
      description:
        'Let users call your team directly from the ad on mobile. Particularly effective for high-intent property enquiries.',
    })
  if (leadForms.length === 0)
    recommended.push({
      icon: <FileText className="h-4 w-4 text-slate-400/60" />,
      title: 'Add lead form extension',
      description:
        'Capture name, email, and phone directly in Google — no landing page required. Ideal for property enquiry campaigns.',
    })
  if (locations.length === 0)
    recommended.push({
      icon: <MapPin className="h-4 w-4 text-orange-400/60" />,
      title: 'Add location extension',
      description:
        'Show your office address in Dubai below your ad to build local trust with property buyers.',
    })

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
            <LinkIcon className="h-3.5 w-3.5" />
            Extensions
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Ad extensions /<br />
            <span className="text-slate-500">
              {loading
                ? '…'
                : isConfigErr
                  ? 'not connected.'
                  : `${extensions.length} assets.`}
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
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
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
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-12 text-center text-[14px] text-slate-500">{t('lm.google.extensions.title')}…</div>
      )}

      {!loading && !isConfigErr && (
        <>
          {/* ── Type filter tabs ── */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FILTER_TABS.map(({ label, value }) => {
              const count =
                value === 'ALL'
                  ? extensions.length
                  : (byType[value] ?? []).length
              const isActive = filter === value
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={[
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                    isActive
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/15 text-[#4285F4]'
                      : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {label}
                  <span className="ml-1.5 text-xs opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {/* ── Create extension ── */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addExtension() }}
              placeholder={t('lm.google.extensions.newPlaceholder')}
              className="min-w-[200px] flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#4285F4]/50"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'SITELINK' | 'CALLOUT')}
              className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="SITELINK">Sitelink</option>
              <option value="CALLOUT">Callout</option>
            </select>
            <button
              onClick={addExtension}
              disabled={adding || !newText.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4285F4] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> {t('lm.google.extensions.addBtn')}
            </button>
          </div>

          {/* ── Extension groups ── */}
          {filteredGroups.length > 0 ? (
            filteredGroups.map(([type, exts]) => (
              <ExtensionGroup key={type} type={type} extensions={exts} />
            ))
          ) : (
            <div className="mt-8 rounded-[24px] border border-line bg-surface px-6 py-12 text-center">
              <MessageSquare className="mx-auto mb-4 h-7 w-7 text-[#4285F4]/30" />
              <div className="text-sm font-semibold text-white">{t('lm.google.extensions.empty')}</div>
              <p className="mt-2 text-sm text-slate-500">
                {filter !== 'ALL'
                  ? `No ${FILTER_TABS.find((t) => t.value === filter)?.label.toLowerCase()} configured yet.`
                  : 'Create extensions in Google Ads Manager to improve your ad visibility and CTR.'}
              </p>
            </div>
          )}

          {/* ── Recommended extensions (based on what's missing) ── */}
          {recommended.length > 0 && (
            <section className="mt-12">
              <div className="mb-5">
                <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  Recommended extensions
                </div>
                <p className="mt-1.5 text-sm text-slate-500">
                  Missing assets that can improve your ad rank and click-through rate.
                </p>
              </div>
              <div className="space-y-3">
                {recommended.map((r) => (
                  <RecommendedCard key={r.title} {...r} />
                ))}
              </div>
            </section>
          )}

          {/* ── What are extensions info box ── */}
          <div className="mt-10 rounded-[18px] border border-[#4285F4]/15 bg-[#4285F4]/[0.04] p-5">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4285F4]/60" />
              <div>
                <div className="text-sm font-semibold text-white">What are ad extensions?</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  Ad extensions (now called assets in Google Ads) expand your ad with additional information — links, phone numbers, addresses, and lead forms. They increase your ad&apos;s visible footprint and improve ad rank by signalling relevance to Google. Well-configured extensions improve CTR by{' '}
                  <span className="font-medium text-slate-300">10–15%</span> on average, and are{' '}
                  <span className="font-medium text-slate-300">free to add</span> — you only pay per click.
                </p>
              </div>
            </div>
          </div>

          {/* ── Create extension CTA ── */}
          <div className="mt-8 flex justify-end">
            <button
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-2.5 text-sm font-medium text-slate-500"
              title="Create and manage extensions directly in Google Ads Manager"
            >
              Create in Google Ads Manager
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
