'use client'

/**
 * THE LITE LAUNCHER — pick a project or drop a design, press Run.
 *
 * Everything else is DERIVED, from the same rails the full wizard uses:
 *
 *   objective   a lead form exists → instant-form leads; none → the
 *               project's landing page
 *   audience    the broad UAE residents ready-buyer — the honest default
 *               for Dubai inventory
 *   caption     read off the uploaded design by the vision extractor, or
 *               built from the project's name — never invented numbers
 *   budget      the same 3-leads-per-day arithmetic the wizard recommends,
 *               from the audience's expected cost per lead
 *   safety      residents-only geo, explicit placements, no Advantage, no
 *               cost cap, permit end-time from the project — all enforced
 *               by the launch route, not repeated here
 *   status      PAUSED, always. The lite path optimises for speed of
 *               setup, never for skipping the human look before money.
 *
 * ── AUTOMATED, NOT SKIPPED ───────────────────────────────────────────────
 *
 * The first version derived everything and ran. The operator's verdict on it
 * was exact: "it's rocket but it should finalize with me the ad — the idea of
 * rocket is not skipping the steps but automate it in smart way." They were
 * right. A launcher that hands back a half-made ad and says "go edit it on the
 * campaign page" has not saved anybody a step; it has moved the work somewhere
 * with less context and no preview.
 *
 * So Rocket now does the deriving AND shows the result: the picture as it will
 * appear, the words as they will read, both editable in place. Three written
 * angles rather than one template, a generated backdrop when there is no
 * design to hand, and Run underneath — pressed on an ad somebody has actually
 * seen.
 *
 * The full wizard remains one link away for every detailed decision. This
 * page exists because "next next next" should not require the nexts.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Zap, Upload, CheckCircle2, ArrowRight, Sparkles, Wand2, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { getBrandSiteUrl } from '@/lib/freehold/brand'
import { READY_BUYERS } from '@/lib/freehold/ready-buyers'
import { composeProjectAd } from '@/lib/freehold/project-ad'
import {
  IMAGE_STYLES, STYLE_PROMPT, imagePromptFor, HEADLINE_MAX, PRIMARY_MAX,
  type CopyFacts, type WrittenCopy, type ImageStyle,
} from '@/lib/freehold/campaign-copy'

interface Project {
  id: string
  projectName: string
  heroImage?: string | null
  area?: string
  developer?: string
  startingPriceAED?: number | null
  paymentPlan?: string | null
  handoverYear?: number | null
}
interface FormLite { id: string; name: string; page_id?: string }

const PRESET = 'allArabicUAE'

export default function QuickLaunchPage() {
  const t = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [forms, setForms] = useState<FormLite[]>([])
  const [projectId, setProjectId] = useState('')
  const [imageHash, setImageHash] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [caption, setCaption] = useState<{ headline: string; primaryText: string; description: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ campaignId: string } | null>(null)
  const designDataUrl = useRef('')
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null)
  // THE FINISHING STEP. Copy the operator can read and change before it runs,
  // rather than after, on another screen.
  const [options, setOptions] = useState<WrittenCopy[] | null>(null)
  const [writing, setWriting] = useState(false)
  const [brief, setBrief] = useState('')
  const [lang, setLang] = useState<'en' | 'ar' | 'ru'>('en')
  const [genStyle, setGenStyle] = useState<ImageStyle>('golden')
  const [generating, setGenerating] = useState(false)

  // The Rocket handoff from the ads home: the budget the operator set there.
  useEffect(() => {
    const b = Number(new URLSearchParams(window.location.search).get('budget'))
    if (Number.isFinite(b) && b >= 50) setBudgetOverride(b)
  }, [])

  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = Array.isArray(d?.properties) ? d.properties : []
        setProjects(items.map((x: Record<string, unknown>) => ({
          id: String(x.id ?? x.slug ?? ''),
          projectName: String(x.projectName ?? x.name ?? ''),
          heroImage: (x.heroImage as string) ?? null,
          area: (x.area as string) ?? '',
          developer: (x.developer as string) ?? '',
          startingPriceAED: typeof x.startingPriceAED === 'number' ? x.startingPriceAED : null,
          paymentPlan: (x.paymentPlan as string) ?? null,
          handoverYear: typeof x.handoverYear === 'number' ? x.handoverYear : null,
        })).filter((p: Project) => p.id && p.projectName))
      }).catch(() => {})
    fetch('/api/meta/forms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.forms)) setForms(d.forms) })
      .catch(() => {})
  }, [])

  async function onUpload(file: File | null) {
    if (!file) return
    setUploading(true); setError('')
    try {
      // Same shrink discipline as the wizard: the wire has a ceiling and
      // Meta renders nothing above 2048px anyway.
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const shrunk = file.size > 900_000 ? await shrink(dataUrl) : dataUrl
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: shrunk }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('lm.quick.uploadFailed')); return }
      designDataUrl.current = shrunk
      setImageHash(d.hash); setImagePreview(shrunk)
      fetch('/api/freehold/ads/design-caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: shrunk }),
      }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (c?.headline) setCaption(c) }).catch(() => {})
    } catch { setError(t('lm.quick.uploadFailed')) } finally { setUploading(false) }
  }

  /** Compose from the project, upload it, and show it — the moment a project
   *  is chosen, so the operator SEES the ad before pressing Run. The composer
   *  itself is shared with the campaign page's creative pool (see
   *  lib/freehold/project-ad.ts), so both screens build the same ad from the
   *  same project rather than drifting apart. */
  async function buildFromProject(p: Project) {
    setUploading(true); setError('')
    try {
      const dataUrl = await composeProjectAd(p, {
        from: t('lm.quick.compose.from'),
        total: t('lm.quick.compose.total'),
        handover: (y) => t('lm.quick.compose.handover', { y }),
      })
      if (!dataUrl) return
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('lm.quick.uploadFailed')); return }
      designDataUrl.current = dataUrl
      setImageHash(d.hash); setImagePreview(dataUrl)
    } finally { setUploading(false) }
  }

  /** The listing's real facts, and only those — see lib/freehold/campaign-copy.ts. */
  function factsOf(p: Project | null): CopyFacts {
    return {
      projectName: p?.projectName ?? null,
      area: p?.area ?? null,
      developer: p?.developer ?? null,
      // FORMATTED HERE, never asked of the model. The price belongs to the
      // listing record; a model that returns one has invented it.
      priceText: typeof p?.startingPriceAED === 'number' && p.startingPriceAED > 0
        ? `AED ${p.startingPriceAED.toLocaleString('en-US')}` : null,
      paymentPlan: p?.paymentPlan ?? null,
      handoverYear: p?.handoverYear ?? null,
    }
  }

  /** Write three angles from the facts. Never blocks Run — copy already on
   *  screen stays exactly as it is if the writer cannot be reached. */
  async function writeCopy() {
    setWriting(true); setError('')
    try {
      const res = await fetch('/api/freehold/ads/write-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts: factsOf(project), language: lang, brief }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error === 'noFacts' ? t('lm.quick.write.noFacts') : t('lm.quick.write.failed'))
        return
      }
      const opts: WrittenCopy[] = Array.isArray(d?.options) ? d.options : []
      setOptions(opts)
      // The first angle is applied so the preview is never empty after a
      // write — and every one stays one click away.
      if (opts[0]) setCaption({ headline: opts[0].headline, primaryText: opts[0].primaryText, description: opts[0].description })
    } catch { setError(t('lm.quick.write.failed')) } finally { setWriting(false) }
  }

  /**
   * Generate a backdrop when there is no design to hand.
   *
   * The prompt asks for a PLACE and forbids text, prices, logos and badges —
   * every one of those is a claim, and a claim a model drew is a claim nobody
   * approved. The words go on separately, above, where they can be read.
   */
  async function generateImage() {
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/freehold/creative-studio/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePromptFor(factsOf(project), STYLE_PROMPT[genStyle]),
          aspectRatio: '1:1',
          title: `${project?.projectName ?? 'Ad'} — ${genStyle}`,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.url) { setError(d?.error || t('lm.quick.gen.failed')); return }
      // Straight into Meta, so the generated picture is a real ad image with a
      // hash rather than a URL that has to survive to launch time.
      const up = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: d.url }),
      })
      const u = await up.json().catch(() => ({}))
      if (up.ok && u?.hash) { setImageHash(u.hash); setImagePreview(d.url); designDataUrl.current = '' }
      else { setImagePreview(d.url); setError(t('lm.quick.gen.notUploaded')) }
    } catch { setError(t('lm.quick.gen.failed')) } finally { setGenerating(false) }
  }

  async function shrink(dataUrl: string): Promise<string> {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl })
    const long = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = Math.min(1, 2048 / long)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.88)
  }

  const project = projects.find((p) => p.id === projectId) ?? null
  const canRun = !!(project || imageHash)
  const band = READY_BUYERS.find((r) => r.id === PRESET)?.cplAed ?? [120, 250]
  // The derived budget — the audience's expected cost per lead, aimed at the
  // ~3 leads/day that clear learning — unless Rocket Ad carried the operator's
  // own number, which outranks the derivation because they chose it.
  const budget = budgetOverride ?? Math.max(150, Math.ceil((band[1] * 3) / 50) * 50)
  const form = forms[0] ?? null

  async function run() {
    if (!canRun || running) return
    setRunning(true); setError('')
    try {
      const name = project?.projectName ?? t('lm.quick.defaultName')
      const site = getBrandSiteUrl()
      const landingUrl = project ? `${site}/lp/${encodeURIComponent(project.id)}` : site
      const payload = {
        campaignName: `${name} — Quick`,
        objective: 'LEAD_GENERATION',
        listingId: project?.id ?? undefined,
        listingName: project?.projectName ?? undefined,
        dailyBudgetAED: budget,
        presetId: PRESET,
        destination: form ? 'form' : 'landing',
        leadFormId: form?.id,
        pageId: form?.page_id || undefined,
        launchStatus: 'PAUSED',
        creative: {
          headline: caption?.headline || name,
          primaryText: caption?.primaryText || t('lm.quick.defaultText', { name }),
          description: caption?.description || '',
          landingUrl,
          cta: 'LEARN_MORE',
          imageHash: imageHash || undefined,
          imageUrl: !imageHash && project?.heroImage ? project.heroImage : undefined,
        },
      }
      const res = await fetch('/api/meta/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('lm.quick.failed')); return }
      setDone({ campaignId: String(d.campaignId ?? '') })
    } catch { setError(t('lm.quick.failed')) } finally { setRunning(false) }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-4 text-[22px] font-semibold text-white">{t('lm.quick.done.title')}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{t('lm.quick.done.sub')}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/freehold-intelligence/ads-live/meta/${encodeURIComponent(done.campaignId)}`}
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
            {t('lm.quick.done.open')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-white"><Zap className="h-5 w-5 text-gold" /> {t('lm.quick.title')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{t('lm.quick.sub')}</p>
      </div>

      <div className="space-y-4 rounded-[20px] border border-line bg-surface-2 p-5">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('lm.quick.project')}</label>
          <select value={projectId} onChange={(e) => {
            setProjectId(e.target.value)
            const p = projects.find((x) => x.id === e.target.value)
            // An uploaded design is the operator's own and outranks anything
            // the system would compose.
            if (p && !designDataUrl.current) void buildFromProject(p)
          }}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-white outline-none focus:border-gold/40">
            <option value="">{t('lm.quick.projectNone')}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
          </select>
        </div>

        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">{t('lm.quick.or')}</div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center transition hover:border-gold/40">
          {imagePreview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imagePreview} alt="" className="max-h-40 rounded-lg" />
            : <Upload className="h-5 w-5 text-slate-500" />}
          <span className="text-[13px] font-medium text-slate-300">
            {uploading ? (projectId && !designDataUrl.current ? t('lm.quick.composing') : t('lm.quick.uploading'))
              : imageHash ? t('lm.quick.replaceDesign') : t('lm.quick.dropDesign')}
          </span>
          {caption && <span className="text-[11px] text-gold">{t('lm.quick.captionRead')}</span>}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { void onUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </label>

        {/* ── GENERATE A BACKDROP, when there is no design to hand ──────────
            Prompted for a PLACE and never a claim — no text, no price, no
            badge. A price a model drew is a price nobody approved. */}
        {!designDataUrl.current && (
          <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              <Sparkles className="h-3 w-3 text-gold" /> {t('lm.quick.gen.title')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={genStyle} onChange={(e) => setGenStyle(e.target.value as ImageStyle)}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-gold/40">
                {IMAGE_STYLES.map((k) => <option key={k} value={k}>{t(`lm.quick.gen.style.${k}`)}</option>)}
              </select>
              <button type="button" onClick={() => void generateImage()} disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-3 py-1.5 text-[12px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {t('lm.quick.gen.action')}
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">{t('lm.quick.gen.note')}</p>
          </div>
        )}

        {/* ── THE WORDS, BEFORE THEY RUN ────────────────────────────────────
            This is the whole difference between automating a step and
            skipping it. The ad is written here, shown here, and changed here
            — not handed over half-made with "go edit it on the campaign
            page", which moves the work somewhere with less context. */}
        {canRun && (
          <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                {t('lm.quick.write.title')}
              </span>
              <div className="flex items-center gap-2">
                <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'ar' | 'ru')}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-white outline-none focus:border-gold/40">
                  <option value="en">EN</option><option value="ar">AR</option><option value="ru">RU</option>
                </select>
                <button type="button" onClick={() => void writeCopy()} disabled={writing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40">
                  {writing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {options ? t('lm.quick.write.again') : t('lm.quick.write.action')}
                </button>
              </div>
            </div>

            {/* The operator's own steer, passed to the writer as MATERIAL —
                never as instructions that could outrank the grounding rules. */}
            <input value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder={t('lm.quick.write.briefPh')}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />

            {/* THREE ANGLES, not one. A single suggestion gets accepted out of
                politeness; three make somebody choose, and choosing is when
                they read it. */}
            {options && options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <button key={o.angle} type="button"
                    onClick={() => setCaption({ headline: o.headline, primaryText: o.primaryText, description: o.description })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      caption?.headline === o.headline
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-line text-slate-400 hover:text-white'
                    }`}>
                    {t(`lm.quick.write.angle.${o.angle}`)}
                  </button>
                ))}
              </div>
            )}

            <label className="block">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-500">{t('lm.quick.write.headline')}</span>
              <input value={caption?.headline ?? ''} maxLength={HEADLINE_MAX}
                onChange={(e) => setCaption((c) => ({ headline: e.target.value, primaryText: c?.primaryText ?? '', description: c?.description ?? '' }))}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-white outline-none focus:border-gold/40" />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-wider text-slate-500">{t('lm.quick.write.body')}</span>
              <textarea value={caption?.primaryText ?? ''} rows={3} maxLength={PRIMARY_MAX}
                onChange={(e) => setCaption((c) => ({ headline: c?.headline ?? '', primaryText: e.target.value, description: c?.description ?? '' }))}
                className="mt-1 w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-white outline-none focus:border-gold/40" />
            </label>
          </div>
        )}

        {/* What Run will actually do — said before the press, in plain words. */}
        <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-400">
          {t('lm.quick.planLine', {
            dest: form ? t('lm.quick.destForm') : t('lm.quick.destLanding'),
            budget: budget.toLocaleString(),
          })}
        </div>

        {error && <p className="text-[13px] text-rose-300">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <Link href="/freehold-intelligence/lead-machine/campaigns/new"
            className="text-[12px] text-slate-500 underline transition hover:text-white">{t('lm.quick.detailed')}</Link>
          <button type="button" onClick={() => void run()} disabled={!canRun || running}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {t('lm.quick.run')}
          </button>
        </div>
      </div>
    </div>
  )
}
