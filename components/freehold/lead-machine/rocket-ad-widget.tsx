'use client'

/**
 * ROCKET AD — one source in, one campaign out.
 *
 * The doctrine, in the operator's own words: give the system a SOURCE — a
 * brochure PDF, a landing page, an image, a video, text, a link — plus a
 * budget, and it reads the source, tells you what it found, and builds the
 * rest. One screen, one action, loading between.
 *
 * What this widget is TODAY: the door and the source picker. It carries the
 * source and the budget into the quick launcher, which already derives the
 * objective, the audience, the caption (read off the design by the vision
 * extractor), the placements and the paused launch. The confirm-screens that
 * make it a full sequence — "here is what the source says about the project,
 * the price, the payment plan; confirm" — are the next build, and this door
 * is deliberately shaped so they slot in behind it rather than beside it.
 *
 * WHY THIS IS NOT THE ADS MACHINE, said once so the two never blur: Rocket is
 * ONE source becoming ONE campaign, by hand, now. The Machine runs many
 * projects on a budget it manages itself, and is where programmatic, YouTube
 * and Google belong.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Rocket, FileText, Image as ImageIcon, Video, Link2, Type, Globe } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const SOURCES = [
  { id: 'pdf', icon: FileText },
  { id: 'landing', icon: Globe },
  { id: 'image', icon: ImageIcon },
  { id: 'video', icon: Video },
  { id: 'text', icon: Type },
  { id: 'link', icon: Link2 },
] as const

export default function RocketAdWidget() {
  const t = useT()
  const router = useRouter()
  const [source, setSource] = useState<(typeof SOURCES)[number]['id'] | null>(null)
  const [budget, setBudget] = useState(300)

  function launch() {
    // The quick launcher is the engine; the source kind and budget ride as
    // intent so it opens on the right foot instead of a blank form.
    const q = new URLSearchParams({ budget: String(budget), ...(source ? { source } : {}) })
    router.push(`/freehold-intelligence/lead-machine/campaigns/quick?${q.toString()}`)
  }

  return (
    <div className="rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Rocket className="h-4 w-4 text-gold" /> {t('lm.w.rocket.title')}
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t('lm.w.rocket.sub')}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {SOURCES.map(({ id, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setSource(source === id ? null : id)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-medium transition ${
              source === id ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:border-white/15'
            }`}>
            <Icon className="h-4 w-4" />
            {t(`lm.w.rocket.src.${id}`)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{t('lm.w.rocket.budget')}</label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">AED</span>
          <input type="number" min={50} step={50} value={budget}
            onChange={(e) => setBudget(Math.max(50, Math.round(Number(e.target.value) || 0)))}
            className="w-full rounded-xl border border-line bg-surface ps-12 pe-3 py-2 text-sm text-white outline-none focus:border-gold/40" />
        </div>
      </div>

      <button type="button" onClick={launch}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
        <Rocket className="h-4 w-4" /> {t('lm.w.rocket.go')}
      </button>
      <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">{t('lm.w.rocket.note')}</p>
    </div>
  )
}
