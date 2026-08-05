'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RadioTower, Plus, Loader2, AlertTriangle, CheckCircle2, Copy, Check,
  ChevronDown, ChevronRight, Rocket, Target, Sparkles, Activity,
} from 'lucide-react'
import { PageHeader, Panel, PanelHeader, Section, EmptyState, Button, buttonClass, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import {
  PIXEL_EVENT_CATALOGUE, findPixelEvent, standardEventRule, urlContainsRule,
  recommendPixelActions, LANDING_PAGE_URL_FRAGMENT,
  type PixelSuggestion,
} from '@/lib/meta/pixel-events'
import type { MetaPixel, MetaCustomConversion } from '@/lib/meta/types'

// ─── Wire types (exactly what the API routes answer) ──────────────────────────

interface PixelsResponse {
  pixels?: MetaPixel[]
  capiPixelId?: string | null
  /** Meta's own sentence naming the missing env var — never a silent empty list. */
  configError?: string
  error?: string
}
interface ConversionsResponse {
  conversions?: MetaCustomConversion[]
  configError?: string
  error?: string
}
interface TrackingResponse {
  pixels?: { metaPixelId: string; googleTagId: string; googleConversionId: string; tiktokPixelId: string }
}

const EMPTY_TRACKING = { metaPixelId: '', googleTagId: '', googleConversionId: '', tiktokPixelId: '' }

// Read an error out of any of this app's Meta responses. Meta's message is
// shown verbatim — a translated paraphrase would hide the code the operator
// needs to act on.
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; code?: number }
    if (body?.error) return body.code ? `${body.error} (${body.code})` : body.error
  } catch { /* non-JSON body */ }
  return `HTTP ${res.status}`
}

function relativeTime(iso: string | null | undefined, t: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const mins = Math.floor((Date.now() - ms) / 60000)
  if (mins < 2) return t('lm.pixel.rel.now')
  if (mins < 60) return t('lm.pixel.rel.min', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('lm.pixel.rel.hour', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('lm.pixel.rel.day', { n: days })
  return t('lm.pixel.rel.month', { n: Math.floor(days / 30) })
}

// ─── Small shared pieces ──────────────────────────────────────────────────────

function Notice({ tone, children }: { tone: 'error' | 'ok' | 'warn'; children: React.ReactNode }) {
  const cls =
    tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200'
    : tone === 'ok'  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
    :                  'border-amber-400/25 bg-amber-400/10 text-amber-200'
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch { /* clipboard blocked — the text is on screen to select */ }
      }}
      className={buttonClass('secondary', 'sm')}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? t('lm.pixel.copied') : t('lm.pixel.copy')}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PixelPage() {
  const t = useT()

  const [loading, setLoading]           = useState(true)
  const [pixels, setPixels]             = useState<MetaPixel[]>([])
  const [capiPixelId, setCapiPixelId]   = useState<string | null>(null)
  const [conversions, setConversions]   = useState<MetaCustomConversion[]>([])
  const [tracking, setTracking]         = useState(EMPTY_TRACKING)
  const [configError, setConfigError]   = useState<string | null>(null)
  const [loadError, setLoadError]       = useState<string | null>(null)

  const [selectedId, setSelectedId]     = useState('')

  // Create pixel
  const [newName, setNewName]           = useState('')
  const [creating, setCreating]         = useState(false)
  const [createErr, setCreateErr]       = useState<string | null>(null)
  const [createOk, setCreateOk]         = useState<string | null>(null)

  // Deploy
  const [deploying, setDeploying]       = useState(false)
  const [deployErr, setDeployErr]       = useState<string | null>(null)
  const [deployOk, setDeployOk]         = useState<string | null>(null)

  // Install snippet
  const [snippetOpen, setSnippetOpen]   = useState(false)
  const [snippet, setSnippet]           = useState<string | null>(null)
  const [snippetFor, setSnippetFor]     = useState('')
  const [snippetBusy, setSnippetBusy]   = useState(false)
  const [snippetErr, setSnippetErr]     = useState<string | null>(null)

  // Conversion form
  const [convBasis, setConvBasis]       = useState<'event' | 'url'>('event')
  const [convEventKey, setConvEventKey] = useState('lead')
  const [convUrl, setConvUrl]           = useState(LANDING_PAGE_URL_FRAGMENT)
  const [convName, setConvName]         = useState('')
  const [convBusy, setConvBusy]         = useState(false)
  const [convErr, setConvErr]           = useState<string | null>(null)
  const [convOk, setConvOk]             = useState<string | null>(null)

  // Suggestions
  const [suggestions, setSuggestions]   = useState<PixelSuggestion[] | null>(null)
  const [sugBusyKey, setSugBusyKey]     = useState<string | null>(null)
  const [sugErr, setSugErr]             = useState<string | null>(null)

  // ── Load everything real ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setConfigError(null)
    try {
      const [pxRes, trRes, cvRes] = await Promise.all([
        fetch('/api/meta/pixels', { cache: 'no-store' }),
        fetch('/api/freehold/integrations/tracking', { cache: 'no-store' }),
        fetch('/api/meta/custom-conversions', { cache: 'no-store' }),
      ])

      const px = (await pxRes.json().catch(() => ({}))) as PixelsResponse
      if (!pxRes.ok) setLoadError(px.error ?? `HTTP ${pxRes.status}`)
      if (px.configError) setConfigError(px.configError)
      const list = Array.isArray(px.pixels) ? px.pixels : []
      setPixels(list)
      setCapiPixelId(px.capiPixelId ?? null)

      const tr = (await trRes.json().catch(() => ({}))) as TrackingResponse
      const global = tr.pixels ?? EMPTY_TRACKING
      setTracking(global)

      const cv = (await cvRes.json().catch(() => ({}))) as ConversionsResponse
      if (!cvRes.ok && cv.error) setLoadError((prev) => prev ?? cv.error!)
      if (cv.configError && !px.configError) setConfigError(cv.configError)
      setConversions(Array.isArray(cv.conversions) ? cv.conversions : [])

      // Default selection: the deployed pixel, else the first one.
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev
        if (global.metaPixelId && list.some((p) => p.id === global.metaPixelId)) return global.metaPixelId
        return list[0]?.id ?? ''
      })
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected     = useMemo(() => pixels.find((p) => p.id === selectedId) ?? null, [pixels, selectedId])
  const deployedId   = tracking.metaPixelId
  const isDeployed   = !!selected && selected.id === deployedId

  // ── Real actions ───────────────────────────────────────────────────────────

  /** POST /api/meta/pixels → POST /{adAccountId}/adspixels. */
  const createPixel = useCallback(async (name: string): Promise<string | null> => {
    setCreating(true); setCreateErr(null); setCreateOk(null)
    try {
      const res = await fetch('/api/meta/pixels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { setCreateErr(await readError(res)); return null }
      const body = (await res.json()) as { pixel: MetaPixel }
      setCreateOk(t('lm.pixel.create.ok', { name: body.pixel.name, id: body.pixel.id }))
      setNewName('')
      await load()
      setSelectedId(body.pixel.id)
      return body.pixel.id
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Unexpected error')
      return null
    } finally {
      setCreating(false)
    }
  }, [load, t])

  /**
   * PUT /api/freehold/integrations/tracking with metaPixelId set — the SAME
   * global the landing pages already resolve (lib/landing-pages.ts), so no code
   * ships and no snippet is pasted anywhere. Google/TikTok ids are carried
   * through untouched because the endpoint writes the whole record.
   */
  const deployPixel = useCallback(async (pixelId: string): Promise<boolean> => {
    setDeploying(true); setDeployErr(null); setDeployOk(null)
    try {
      const res = await fetch('/api/freehold/integrations/tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tracking, metaPixelId: pixelId }),
      })
      if (!res.ok) { setDeployErr(await readError(res)); return false }
      const body = (await res.json()) as TrackingResponse
      const saved = body.pixels ?? { ...tracking, metaPixelId: pixelId }
      setTracking(saved)
      const name = pixels.find((p) => p.id === pixelId)?.name ?? pixelId
      setDeployOk(t('lm.pixel.deploy.ok', { name }))
      setSelectedId(pixelId)
      return true
    } catch (err) {
      setDeployErr(err instanceof Error ? err.message : 'Unexpected error')
      return false
    } finally {
      setDeploying(false)
    }
  }, [pixels, t, tracking])

  /** POST /api/meta/custom-conversions → POST /{adAccountId}/customconversions. */
  const createConversion = useCallback(async (args: {
    pixelId: string; customEventType: string; rule: string; name: string
  }): Promise<boolean> => {
    setConvBusy(true); setConvErr(null); setConvOk(null)
    try {
      const res = await fetch('/api/meta/custom-conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args.name,
          eventSourceId: args.pixelId,
          customEventType: args.customEventType,
          rule: args.rule,
        }),
      })
      if (!res.ok) { setConvErr(await readError(res)); return false }
      setConvOk(t('lm.pixel.conv.ok'))
      setConvName('')
      await load()
      return true
    } catch (err) {
      setConvErr(err instanceof Error ? err.message : 'Unexpected error')
      return false
    } finally {
      setConvBusy(false)
    }
  }, [load, t])

  // GET /api/meta/pixels/{id} → GET /{pixelId}?fields=id,name,code,last_fired_time
  const loadSnippet = useCallback(async (pixelId: string) => {
    setSnippetBusy(true); setSnippetErr(null); setSnippet(null)
    try {
      const res = await fetch(`/api/meta/pixels/${encodeURIComponent(pixelId)}`, { cache: 'no-store' })
      if (!res.ok) { setSnippetErr(await readError(res)); return }
      const body = (await res.json()) as { pixel: { code: string | null } }
      setSnippet(body.pixel?.code ?? null)
      setSnippetFor(pixelId)
    } catch (err) {
      setSnippetErr(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSnippetBusy(false)
    }
  }, [])

  // ── Conversion rule, always shown before it is sent ────────────────────────
  const convEvent = findPixelEvent(convEventKey)
  const convRule  = convBasis === 'url'
    ? urlContainsRule(convUrl.trim() || LANDING_PAGE_URL_FRAGMENT)
    : standardEventRule(convEvent?.metaEvent ?? 'Lead')
  const convEventType = convBasis === 'url' ? 'OTHER' : (convEvent?.customEventType ?? 'OTHER')

  const startConversionFromEvent = (eventKey: string) => {
    const ev = findPixelEvent(eventKey)
    setConvBasis('event')
    setConvEventKey(eventKey)
    if (!convName.trim() && ev) setConvName(t(ev.labelKey))
    setConvErr(null); setConvOk(null)
    document.getElementById('lm-pixel-new-conversion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ── Suggestions: deterministic, from the loaded real state ─────────────────
  const runSuggest = () => {
    setSugErr(null)
    setSuggestions(recommendPixelActions({
      pixels: pixels.map((p) => ({ id: p.id, name: p.name, lastFiredTime: p.lastFiredTime })),
      globalPixelId: tracking.metaPixelId,
      capiPixelId,
      conversions: conversions.map((c) => ({
        id: c.id, name: c.name, customEventType: c.customEventType,
        rule: c.rule, eventSourceId: c.eventSourceId, isArchived: c.isArchived,
      })),
    }))
  }

  const applySuggestion = async (s: PixelSuggestion) => {
    setSugBusyKey(s.key); setSugErr(null)
    try {
      const name = t(s.nameKey)
      if (s.action.type === 'create-pixel') {
        const id = await createPixel(name)
        if (id) await deployPixel(id)
      } else if (s.action.type === 'deploy') {
        await deployPixel(s.action.pixelId)
      } else {
        await createConversion({
          pixelId: s.action.pixelId,
          customEventType: s.action.customEventType,
          rule: s.action.rule,
          name,
        })
      }
      // Re-derive from the state the actions just refreshed rather than
      // assuming the suggestion is now resolved.
      setSuggestions(null)
    } catch (err) {
      setSugErr(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSugBusyKey(null)
    }
  }

  const firing    = PIXEL_EVENT_CATALOGUE.filter((e) => e.firedByPlatform)
  const available = PIXEL_EVENT_CATALOGUE.filter((e) => !e.firedByPlatform)

  const sevClass = (s: PixelSuggestion['severity']) =>
    s === 'critical'    ? 'border-red-500/30 bg-red-500/10 text-red-200'
    : s === 'recommended' ? 'border-gold/30 bg-gold/10 text-gold'
    :                       'border-line-strong bg-surface-2 text-slate-300'
  const sevLabel = (s: PixelSuggestion['severity']) =>
    s === 'critical' ? t('lm.pixel.sug.sevCritical')
    : s === 'recommended' ? t('lm.pixel.sug.sevRecommended')
    : t('lm.pixel.sug.sevImprovement')

  return (
    <div className="space-y-8 p-5 sm:p-6 lg:p-8">

      <PageHeader
        Icon={RadioTower}
        eyebrow={t('lm.pixel.eyebrow')}
        title={t('lm.pixel.title')}
        subtitle={t('lm.pixel.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            {t('lm.pixel.refresh')}
          </Button>
        }
      />

      {/* Not connected: Meta's own sentence, naming the missing env var. */}
      {configError && (
        <Notice tone="warn">
          <div className="font-semibold">{t('lm.pixel.notConnected')}</div>
          <div className="mt-1 text-amber-100/80">{configError}</div>
        </Notice>
      )}
      {loadError && (
        <Notice tone="error">
          <div className="font-semibold">{t('lm.pixel.metaError')}</div>
          <div className="mt-1 break-words text-red-100/80">{loadError}</div>
        </Notice>
      )}

      {/* ── 1. Your pixels ─────────────────────────────────────────────────── */}
      <Section title={t('lm.pixel.list.title')} description={t('lm.pixel.list.desc')}>
        {loading && pixels.length === 0 ? (
          <Panel className="flex items-center gap-2.5 px-5 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lm.pixel.loading')}
          </Panel>
        ) : pixels.length === 0 ? (
          <EmptyState Icon={RadioTower} title={t('lm.pixel.list.empty')} description={t('lm.pixel.list.emptyDesc')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pixels.map((p) => {
              const active   = p.id === deployedId
              const isCapi   = !!capiPixelId && p.id === capiPixelId
              const rel      = relativeTime(p.lastFiredTime, t)
              const chosen   = p.id === selectedId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    'rounded-xl border p-4 text-start transition',
                    chosen ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface hover:border-line-strong',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {t('lm.pixel.list.id')} {p.id}
                      </div>
                    </div>
                    {chosen && (
                      <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                        {t('lm.pixel.list.selected')}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-[12px] text-slate-400">
                    {rel
                      ? <>{t('lm.pixel.list.lastFired')} · <span className="text-slate-300">{rel}</span></>
                      : <span className="text-amber-300/80">{t('lm.pixel.list.neverFired')}</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('lm.pixel.list.badgeActive')}
                      </span>
                    )}
                    {isCapi && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300">
                        {t('lm.pixel.list.badgeCapi')}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── 2. Create a pixel ──────────────────────────────────────────────── */}
      <Section title={t('lm.pixel.create.title')} description={t('lm.pixel.create.desc')}>
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="lm-pixel-name" className="mb-1.5 block text-xs font-medium text-slate-400">
                {t('lm.pixel.create.name')}
              </label>
              <input
                id="lm-pixel-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('lm.pixel.create.placeholder')}
                className={fieldClass('md')}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => void createPixel(newName.trim())}
              disabled={creating || !newName.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? t('lm.pixel.create.busy') : t('lm.pixel.create.btn')}
            </Button>
          </div>
          {(createErr || createOk) && (
            <div className="mt-3">
              {createErr && <Notice tone="error">{createErr}</Notice>}
              {createOk && !createErr && <Notice tone="ok">{createOk}</Notice>}
            </div>
          )}
        </Panel>
      </Section>

      {/* ── 3. Deploy — the differentiator ─────────────────────────────────── */}
      <Section title={t('lm.pixel.deploy.title')} description={t('lm.pixel.deploy.desc')}>
        <Panel>
          <div className="border-b border-line bg-gold/[0.04] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
                <Rocket className="h-4 w-4 text-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{t('lm.pixel.deploy.headline')}</div>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">{t('lm.pixel.deploy.body')}</p>
                <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-slate-500">{t('lm.pixel.deploy.override')}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => selected && void deployPixel(selected.id)}
                disabled={!selected || deploying || isDeployed}
              >
                {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {deploying ? t('lm.pixel.deploy.busy') : isDeployed ? t('lm.pixel.deploy.current') : t('lm.pixel.deploy.btn')}
              </Button>
              <span className="text-[12px] text-slate-500">
                {!selected
                  ? t('lm.pixel.deploy.pick')
                  : deployedId
                    ? <>{t('lm.pixel.list.badgeActive')} · <span className="font-mono text-slate-400">{deployedId}</span></>
                    : t('lm.pixel.deploy.none')}
              </span>
            </div>

            {(deployErr || deployOk) && (
              <div className="mt-3">
                {deployErr && <Notice tone="error">{deployErr}</Notice>}
                {deployOk && !deployErr && <Notice tone="ok">{deployOk}</Notice>}
              </div>
            )}
          </div>

          {/* Collapsible raw install snippet — for sites we do NOT host. */}
          <div className="p-5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-start text-sm font-medium text-slate-300 transition hover:text-white"
              onClick={() => {
                const next = !snippetOpen
                setSnippetOpen(next)
                if (next && selected && snippetFor !== selected.id) void loadSnippet(selected.id)
              }}
              disabled={!selected}
            >
              {snippetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {snippetOpen ? t('lm.pixel.deploy.snippetHide') : t('lm.pixel.deploy.snippetShow')}
            </button>
            <p className="mt-1.5 ms-6 max-w-2xl text-[12px] leading-relaxed text-slate-500">
              {t('lm.pixel.deploy.snippetDesc')}
            </p>

            {snippetOpen && (
              <div className="mt-3 ms-6 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('lm.pixel.deploy.snippetTitle')}
                </div>
                {snippetBusy && (
                  <div className="flex items-center gap-2 text-[13px] text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.pixel.deploy.snippetBusy')}
                  </div>
                )}
                {snippetErr && <Notice tone="error">{snippetErr}</Notice>}
                {!snippetBusy && !snippetErr && !snippet && (
                  <Notice tone="warn">{t('lm.pixel.deploy.snippetNone')}</Notice>
                )}
                {snippet && (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3">
                      <pre className="whitespace-pre text-left font-mono text-[11px] leading-relaxed text-slate-300" dir="ltr">
                        {snippet}
                      </pre>
                    </div>
                    <CopyButton value={snippet} />
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>
      </Section>

      {/* ── 4. Events ──────────────────────────────────────────────────────── */}
      <Section title={t('lm.pixel.events.title')} description={t('lm.pixel.events.desc')}>
        <div className="grid gap-4 lg:grid-cols-2">

          <Panel>
            <PanelHeader
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              title={t('lm.pixel.events.firingTitle')}
            />
            <div className="space-y-3 p-5">
              <p className="text-[12px] leading-relaxed text-slate-500">{t('lm.pixel.events.firingDesc')}</p>
              {firing.map((ev) => (
                <div key={ev.key} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-white">{t(ev.labelKey)}</span>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      {t('lm.pixel.events.badgeLive')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{t(ev.descriptionKey)}</p>
                  <button
                    type="button"
                    onClick={() => startConversionFromEvent(ev.key)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold transition hover:text-gold-bright"
                  >
                    <Target className="h-3.5 w-3.5" />
                    {t('lm.pixel.events.build')}
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<Target className="h-4 w-4 text-slate-400" />}
              title={t('lm.pixel.events.availableTitle')}
            />
            <div className="space-y-3 p-5">
              <p className="text-[12px] leading-relaxed text-slate-500">{t('lm.pixel.events.availableDesc')}</p>
              {available.map((ev) => (
                <div key={ev.key} className="rounded-lg border border-line bg-surface-2/60 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-slate-200">{t(ev.labelKey)}</span>
                    <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      {t('lm.pixel.events.badgeAvailable')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{t(ev.descriptionKey)}</p>
                  <button
                    type="button"
                    onClick={() => startConversionFromEvent(ev.key)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 transition hover:text-slate-200"
                  >
                    <Target className="h-3.5 w-3.5" />
                    {t('lm.pixel.events.build')}
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      {/* ── 5. Conversions ─────────────────────────────────────────────────── */}
      <Section title={t('lm.pixel.conv.title')} description={t('lm.pixel.conv.desc')}>
        <div className="space-y-4">

          {conversions.length === 0 ? (
            <EmptyState Icon={Target} title={t('lm.pixel.conv.empty')} description={t('lm.pixel.conv.emptyDesc')} />
          ) : (
            <div className="space-y-2.5">
              {conversions.map((c) => {
                const rel = relativeTime(c.lastFiredTime, t)
                return (
                  <Panel key={c.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{c.name}</span>
                          {c.customEventType && (
                            <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                              {c.customEventType}
                            </span>
                          )}
                          {c.isArchived && (
                            <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {t('lm.pixel.conv.archived')}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{c.id}</div>
                      </div>
                      <div className="shrink-0 text-end text-[11px] text-slate-500">
                        <div>
                          {t('lm.pixel.conv.source')} ·{' '}
                          <span className="font-mono text-slate-400">
                            {c.eventSourceId ?? t('lm.pixel.conv.sourceUnknown')}
                          </span>
                        </div>
                        {rel && <div className="mt-0.5">{t('lm.pixel.conv.lastFired')} · {rel}</div>}
                      </div>
                    </div>
                    {c.rule && (
                      <div className="mt-3">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {t('lm.pixel.conv.rule')}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-3 py-2">
                          <code className="whitespace-pre font-mono text-[11px] text-slate-400" dir="ltr">{c.rule}</code>
                        </div>
                      </div>
                    )}
                  </Panel>
                )
              })}
            </div>
          )}

          {/* Create */}
          <div id="lm-pixel-new-conversion">
          <Panel>
            <PanelHeader icon={<Plus className="h-4 w-4 text-gold" />} title={t('lm.pixel.conv.newTitle')} />
            <div className="space-y-4 p-5">

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="lm-conv-pixel" className="mb-1.5 block text-xs font-medium text-slate-400">
                    {t('lm.pixel.conv.fPixel')}
                  </label>
                  <select
                    id="lm-conv-pixel"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className={fieldClass('md')}
                  >
                    {pixels.length === 0 && <option value="">{t('lm.pixel.conv.needPixel')}</option>}
                    {pixels.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="lm-conv-basis" className="mb-1.5 block text-xs font-medium text-slate-400">
                    {t('lm.pixel.conv.fBasis')}
                  </label>
                  <select
                    id="lm-conv-basis"
                    value={convBasis}
                    onChange={(e) => setConvBasis(e.target.value === 'url' ? 'url' : 'event')}
                    className={fieldClass('md')}
                  >
                    <option value="event">{t('lm.pixel.conv.basisEvent')}</option>
                    <option value="url">{t('lm.pixel.conv.basisUrl')}</option>
                  </select>
                </div>

                {convBasis === 'event' ? (
                  <div>
                    <label htmlFor="lm-conv-event" className="mb-1.5 block text-xs font-medium text-slate-400">
                      {t('lm.pixel.conv.fEvent')}
                    </label>
                    <select
                      id="lm-conv-event"
                      value={convEventKey}
                      onChange={(e) => setConvEventKey(e.target.value)}
                      className={fieldClass('md')}
                    >
                      {PIXEL_EVENT_CATALOGUE.map((ev) => (
                        <option key={ev.key} value={ev.key}>{t(ev.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="lm-conv-url" className="mb-1.5 block text-xs font-medium text-slate-400">
                      {t('lm.pixel.conv.fUrl')}
                    </label>
                    <input
                      id="lm-conv-url"
                      value={convUrl}
                      onChange={(e) => setConvUrl(e.target.value)}
                      placeholder={t('lm.pixel.conv.fUrlPlaceholder')}
                      className={fieldClass('md')}
                      dir="ltr"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="lm-conv-name" className="mb-1.5 block text-xs font-medium text-slate-400">
                    {t('lm.pixel.conv.fName')}
                  </label>
                  <input
                    id="lm-conv-name"
                    value={convName}
                    onChange={(e) => setConvName(e.target.value)}
                    placeholder={t('lm.pixel.conv.fNamePlaceholder')}
                    className={fieldClass('md')}
                  />
                </div>
              </div>

              {/* The exact rule that will be sent — no hidden translation. */}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {t('lm.pixel.conv.rulePreview')}
                </div>
                <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <code className="whitespace-pre font-mono text-[11px] text-slate-400" dir="ltr">{convRule}</code>
                </div>
              </div>

              {convBasis === 'event' && convEvent && !convEvent.firedByPlatform && (
                <Notice tone="warn">{t('lm.pixel.conv.warnNotFired')}</Notice>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void createConversion({
                    pixelId: selectedId,
                    customEventType: convEventType,
                    rule: convRule,
                    name: convName.trim(),
                  })}
                  disabled={convBusy || !selectedId || !convName.trim()}
                >
                  {convBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  {convBusy ? t('lm.pixel.conv.busy') : t('lm.pixel.conv.create')}
                </Button>
                {!selectedId && <span className="text-[12px] text-slate-500">{t('lm.pixel.conv.needPixel')}</span>}
              </div>

              {convErr && <Notice tone="error">{convErr}</Notice>}
              {convOk && !convErr && <Notice tone="ok">{convOk}</Notice>}
            </div>
          </Panel>
          </div>
        </div>
      </Section>

      {/* ── 6. Suggest what to track ───────────────────────────────────────── */}
      <Section title={t('lm.pixel.sug.title')} description={t('lm.pixel.sug.desc')}>
        <Panel className="p-5">
          <Button variant="gold-soft" size="md" onClick={runSuggest} disabled={loading}>
            <Sparkles className="h-4 w-4" />
            {t('lm.pixel.sug.btn')}
          </Button>

          {sugErr && (
            <div className="mt-3">
              <Notice tone="error">
                <div className="font-semibold">{t('lm.pixel.actionFailed')}</div>
                <div className="mt-1 break-words text-red-100/80">{sugErr}</div>
              </Notice>
            </div>
          )}

          {suggestions !== null && (
            <div className="mt-4 space-y-2.5">
              {suggestions.length === 0 ? (
                <Notice tone="ok">{t('lm.pixel.sug.none')}</Notice>
              ) : suggestions.map((s) => (
                <div key={s.key} className="rounded-xl border border-line bg-surface-2/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sevClass(s.severity)}`}>
                          {sevLabel(s.severity)}
                        </span>
                        <span className="text-sm font-semibold text-white">{t(s.titleKey)}</span>
                      </div>
                      <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t(s.bodyKey)}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void applySuggestion(s)}
                      disabled={sugBusyKey !== null}
                    >
                      {sugBusyKey === s.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                      {sugBusyKey === s.key ? t('lm.pixel.sug.busy') : t(s.actionLabelKey)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Section>
    </div>
  )
}
