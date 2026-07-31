'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Megaphone, Sparkles, FileText, Clapperboard, Wand2, Workflow, Presentation,
  NotebookPen, FolderOpen, Image as ImageIcon, FileType, Plus, Loader2,
  RectangleVertical, Square, Smartphone, Film,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import { DraftsShelf } from '@/components/freehold/drive/drafts-shelf'
import { TemplateThumb } from '@/components/freehold/drive/template-thumb'
import {
  SUITE_TEMPLATES, SUITE_LANGS, DOC_TEMPLATE_KEYS, templateHref, templateOverlay,
  type SuiteLang,
} from '@/lib/freehold/creative-suite'
import { loadImage, type FormatKey } from '@/lib/freehold/ad-compose'
import { useLiveProjects } from '@/lib/freehold/use-live-projects'

/**
 * CREATIVE SUITE — the one front door for everything that gets made.
 * Template-first (Adobe Express model): live template previews rendered by the
 * real ad engine, quick starts per format, document starters, and every tool
 * in one row. Templates deep-link into the Ad Designer preconfigured; doc
 * starters create the document and open it pre-filled.
 */

type FormatFilter = 'all' | FormatKey

const QUICK: { key: string; href: string; Icon: React.ElementType; labelKey: string; accent: string }[] = [
  { key: 'feed',   href: '/freehold-intelligence/drive/ad-designer?format=feed',   Icon: RectangleVertical, labelKey: 'adz.format.feed',   accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'square', href: '/freehold-intelligence/drive/ad-designer?format=square', Icon: Square,            labelKey: 'adz.format.square', accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'story',  href: '/freehold-intelligence/drive/ad-designer?format=story',  Icon: Smartphone,        labelKey: 'adz.format.story',  accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'reel',   href: '/freehold-intelligence/drive/reel',                       Icon: Clapperboard,      labelKey: 'suite.quick.reel',  accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'video',  href: '/freehold-intelligence/drive/editor/video/new',          Icon: Film,              labelKey: 'suite.quick.video', accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'ai',     href: '/freehold-intelligence/creative-studio',                 Icon: Sparkles,          labelKey: 'suite.quick.ai',    accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.06]' },
]

const TOOLS: { key: string; href?: string; Icon: React.ElementType; accent: string }[] = [
  { key: 'addesigner', href: '/freehold-intelligence/drive/ad-designer',        Icon: Megaphone,    accent: 'text-gold' },
  { key: 'reel',       href: '/freehold-intelligence/drive/reel',               Icon: Clapperboard, accent: 'text-violet-300' },
  { key: 'image',      href: '/freehold-intelligence/drive/editor/image/new',   Icon: ImageIcon,    accent: 'text-violet-300' },
  { key: 'doc',                                                                 Icon: FileText,     accent: 'text-sky-300' },
  { key: 'video',      href: '/freehold-intelligence/drive/editor/video/new',   Icon: Film,         accent: 'text-emerald-300' },
  { key: 'pdf',        href: '/freehold-intelligence/drive/files',              Icon: FileType,     accent: 'text-rose-300' },
  { key: 'quick',      href: '/freehold-intelligence/creative-studio',          Icon: Wand2,        accent: 'text-violet-300' },
  { key: 'canvas',     href: '/freehold-intelligence/creative-studio/canvas',   Icon: Workflow,     accent: 'text-teal-300' },
  { key: 'roadshow',   href: '/freehold-intelligence/lead-machine/roadshow',    Icon: Presentation, accent: 'text-emerald-300' },
  { key: 'notebook',   href: '/freehold-intelligence/notebook',                 Icon: NotebookPen,  accent: 'text-sky-300' },
  { key: 'library',    href: '/freehold-intelligence/drive/library',            Icon: FolderOpen,   accent: 'text-slate-300' },
]

export default function CreativeSuitePage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [filter, setFilter] = useState<FormatFilter>('all')
  // The AD's language — defaults to the dashboard locale, but an agent
  // working in English still sells to Arabic and Russian buyers, so it switches.
  const [lang, setLang] = useState<SuiteLang>(() => (SUITE_LANGS as string[]).includes(locale) ? (locale as SuiteLang) : 'en')
  const [docBusy, setDocBusy] = useState<string | null>(null)

  // The gallery previews compose with the user's REAL inventory photos when
  // there are any — each template gets a hero image from a live project,
  // rotating across the set. Load failures (missing CORS headers, dead URLs)
  // fall back silently to the engine's styled ghost.
  const { projects } = useLiveProjects()
  const [heroes, setHeroes] = useState<HTMLImageElement[]>([])
  useEffect(() => {
    let alive = true
    const urls = projects.filter((p) => !!p.heroImage).slice(0, 6).map((p) => p.heroImage as string)
    if (urls.length === 0) return
    Promise.all(urls.map((u) => loadImage(u, !u.startsWith('data:')).catch(() => null)))
      .then((imgs) => { if (alive) setHeroes(imgs.filter((i): i is HTMLImageElement => i !== null)) })
    return () => { alive = false }
  }, [projects])

  const templates = SUITE_TEMPLATES.filter(
    (tpl) => tpl.lang === lang && (filter === 'all' || tpl.format === filter),
  )

  /** Create a fresh document (optionally seeded with a starter) and open it.
   *  busyKey distinguishes buttons that share a template (quick-start vs the
   *  starter card) so only the clicked one spins. */
  async function newDoc(tplKey?: string, busyKey?: string) {
    if (docBusy) return
    setDocBusy(busyKey ?? tplKey ?? '_blank')
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', title: tplKey ? t(`ed.doc.tpl.${tplKey}`) : t('suite.docs.untitled'), content: '' }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.item?.id) { toast.error(t('suite.err.doc')); return }
      router.push(`/freehold-intelligence/drive/editor/doc/${d.item.id}${tplKey ? `?tpl=${tplKey}` : ''}`)
    } catch { toast.error(t('suite.err.doc')) } finally { setDocBusy(null) }
  }

  const filterChip = (key: FormatFilter, label: string) => (
    <button key={key} type="button" onClick={() => setFilter(key)}
      className={['rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        filter === key ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:border-line-strong hover:text-slate-200'].join(' ')}>
      {label}
    </button>
  )

  return (
    <>
      <DraftsShelf />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('suite.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{t('suite.sub')}</p>

        {/* Quick start */}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK.map(({ key, href, Icon, labelKey, accent }) => (
            <Link key={key} href={href}
              className={`flex min-w-[132px] shrink-0 flex-col gap-2.5 rounded-xl border p-3.5 transition hover:brightness-110 ${accent}`}>
              <Icon className="h-5 w-5" />
              <span className="text-[13px] font-semibold text-white">{t(labelKey)}</span>
            </Link>
          ))}
          <button type="button" onClick={() => newDoc('brochure', 'quick:brochure')} disabled={docBusy !== null}
            className="flex min-w-[132px] shrink-0 flex-col gap-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5 text-sky-300 transition hover:brightness-110 disabled:opacity-60">
            {docBusy === 'quick:brochure' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            <span className="text-start text-[13px] font-semibold text-white">{t('suite.quick.doc')}</span>
          </button>
        </div>

        {/* Templates — live previews from the real engine */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">{t('suite.tpl.title')}</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">{t('suite.tpl.sub')}</p>
          </div>
          <div className="flex gap-1.5">
            {filterChip('all', t('suite.tpl.all'))}
            {filterChip('feed', t('adz.format.feed'))}
            {filterChip('square', t('adz.format.square'))}
            {filterChip('story', t('adz.format.story'))}
          </div>
        </div>
        {/* The AD's language — the copy and the layout direction, not the UI's */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('suite.tpl.lang')}</span>
          {SUITE_LANGS.map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={['rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                lang === l ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:border-line-strong hover:text-slate-200'].join(' ')}
              dir={l === 'ar' ? 'rtl' : 'ltr'}>
              {t(`suite.tpl.lang.${l}`)}
            </button>
          ))}
        </div>
        <div className="mt-4 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <Link href="/freehold-intelligence/drive/ad-designer"
            className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-slate-400 transition hover:border-gold/40 hover:text-gold">
            <Plus className="h-6 w-6" />
            <span className="px-3 text-center text-xs font-medium">{t('suite.tpl.blank')}</span>
          </Link>
          {templates.map((tpl, i) => (
            <Link key={tpl.id} href={templateHref(tpl)} className="group block">
              <div className="overflow-hidden rounded-lg ring-1 ring-line transition group-hover:ring-2 group-hover:ring-gold/50">
                <TemplateThumb layout={tpl.layout} palette={tpl.palette} format={tpl.format} overlay={templateOverlay(tpl)}
                  img={heroes.length > 0 ? heroes[i % heroes.length] : null} index={i} />
              </div>
              <div className="mt-1.5 flex items-center justify-between px-0.5">
                <span className="truncate text-[11px] font-medium text-slate-300">{t(`adz.layout.${tpl.layout}`)} · {t(`adz.pal.${tpl.palette}`)}</span>
                <span className="shrink-0 text-[10px] text-slate-500">{t(`adz.format.${tpl.format}`)}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Document starters */}
        <h2 className="mt-10 text-base font-semibold text-white">{t('suite.docs.title')}</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">{t('suite.docs.sub')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {DOC_TEMPLATE_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => newDoc(key)} disabled={docBusy !== null}
              className="flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/40 p-4 text-start transition hover:border-line-strong hover:bg-surface-2 disabled:opacity-60">
              {docBusy === key
                ? <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                : <FileText className="h-5 w-5 text-sky-300" />}
              <span className="text-[13px] font-semibold text-white">{t(`ed.doc.tpl.${key}`)}</span>
            </button>
          ))}
        </div>

        {/* All tools */}
        <h2 className="mt-10 text-base font-semibold text-white">{t('suite.tools.title')}</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">{t('suite.tools.sub')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TOOLS.map(({ key, href, Icon, accent }) => {
            const busy = !href && docBusy === '_blank'
            const inner = (
              <>
                {busy ? <Loader2 className={`h-5 w-5 animate-spin ${accent}`} /> : <Icon className={`h-5 w-5 ${accent}`} />}
                <span className="text-[13px] font-semibold text-white">{t(`suite.tool.${key}`)}</span>
                <span className="text-[11px] leading-snug text-slate-500">{t(`suite.tool.${key}Desc`)}</span>
              </>
            )
            const cls = 'flex flex-col items-start gap-1.5 rounded-xl border border-line bg-surface-2/40 p-4 text-start transition hover:border-line-strong hover:bg-surface-2'
            return href
              ? <Link key={key} href={href} className={cls}>{inner}</Link>
              : (
                <button key={key} type="button" onClick={() => newDoc()} disabled={docBusy !== null} className={`${cls} disabled:opacity-60`}>
                  {inner}
                </button>
              )
          })}
        </div>
      </div>
    </>
  )
}
