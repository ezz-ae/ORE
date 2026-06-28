'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Palette, Plus, AlertCircle, RefreshCw, ArrowUpRight, Wand2, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface CreativeDetail {
  id: string
  name: string
  status?: string
  body?: string
  title?: string
  object_story_spec?: {
    link_data?: {
      link?: string
      message?: string
      name?: string
      description?: string
      picture?: string
      call_to_action?: { type?: string }
    }
  }
}

interface CreativesResponse {
  creatives?: CreativeDetail[]
  error?: string
  type?: string
}

function truncate(s: string | undefined, n: number) {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function CreativesPage() {
  const t = useT()
  const [data, setData]       = useState<CreativesResponse>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchCreatives(quiet = false) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/meta/creatives')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Network error', type: 'network' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchCreatives() }, [])

  const creatives     = data.creatives ?? []
  const isConfigError = data.type === 'config'

  const stats = [
    { labelKey: 'lm.creatives.stat.total',     value: creatives.length },
    { labelKey: 'lm.creatives.stat.withImage',  value: creatives.filter((c) => c.object_story_spec?.link_data?.picture).length },
    { labelKey: 'lm.creatives.stat.named',      value: creatives.filter((c) => c.name && c.name !== 'Unnamed').length },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <Palette className="h-3.5 w-3.5" /> {t('lm.creatives.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {t('lm.creatives.title')}<br />
            <span className="text-slate-500">
              {loading ? t('lm.creatives.titleLoading') : isConfigError ? t('lm.creatives.titleNotConnected') : t('lm.creatives.titleTotal', { n: String(creatives.length) })}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/creatives/generate"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] sm:mt-10"
        >
          <Wand2 className="h-4 w-4" /> {t('lm.creatives.generateCopy')}
        </Link>
      </div>

      {/* Config error */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.creatives.metaNotConnected')}</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link href="/freehold-intelligence/integrations/meta" className="mt-3 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold">
                {t('lm.creatives.setupMeta')} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* API error */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* Stats + refresh */}
      {!isConfigError && !loading && (
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-3">
            {stats.map((s) => (
              <div key={s.labelKey} className="rounded-[14px] border border-line bg-surface px-4 py-3">
                <div className="text-[20px] font-semibold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => fetchCreatives(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('lm.creatives.refresh')}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-12 text-center text-[14px] text-slate-500">{t('lm.creatives.loading')}</div>
      )}

      {/* Creative grid */}
      {!loading && creatives.length > 0 && (
        <section className="mt-8">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-4">{t('lm.creatives.allCreatives')}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {creatives.map((creative) => {
              const ld       = creative.object_story_spec?.link_data
              const headline = creative.title ?? ld?.name ?? '—'
              const body     = creative.body ?? ld?.message ?? '—'
              const desc     = ld?.description ?? ''
              const imgUrl   = ld?.picture
              const ctaType  = ld?.call_to_action?.type
              const pageUrl  = ld?.link

              return (
                <div key={creative.id} className="overflow-hidden rounded-[22px] border border-line bg-surface">
                  {/* Image preview */}
                  {imgUrl ? (
                    <div className="relative h-40 w-full overflow-hidden bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt={headline} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-surface-2">
                      <Palette className="h-8 w-8 text-slate-700" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-[14px] font-semibold text-white leading-snug">{truncate(headline, 60)}</h3>
                      {creative.status && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                          creative.status === 'ACTIVE' ? 'bg-gold/10 text-gold' : 'bg-surface-2 text-slate-500'
                        }`}>
                          {creative.status}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{truncate(body, 150)}</p>

                    {desc && (
                      <p className="mt-2 text-sm text-slate-500 line-clamp-1">{desc}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-2">
                        {ctaType && (
                          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-slate-500">
                            {ctaType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {pageUrl && (
                          <a
                            href={pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-slate-600 transition hover:text-gold"
                          >
                            <ExternalLink className="h-3 w-3" /> {t('lm.creatives.landing')}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-line pt-3 text-xs font-mono text-slate-600 truncate">
                      {creative.id}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && !isConfigError && creatives.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <Palette className="mx-auto h-8 w-8 text-gold/40 mb-4" />
          <div className="text-[18px] font-semibold text-white">{t('lm.creatives.emptyTitle')}</div>
          <p className="mt-2 text-[14px] text-slate-500">{t('lm.creatives.emptyDesc')}</p>
          <Link
            href="/freehold-intelligence/lead-machine/creatives/generate"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            <Wand2 className="h-4 w-4" /> {t('lm.creatives.generateFirst')}
          </Link>
        </div>
      )}

    </div>
  )
}
