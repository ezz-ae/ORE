'use client'

import Link from 'next/link'
import {
  Megaphone, Clapperboard, Image as ImageIcon, Film, Users, FileUp,
  FolderOpen, Workflow, LayoutTemplate, ArrowRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { StudioHomeHeader } from './_home-header'

// Creative Suite home — the standalone design suite. Every design app lives
// HERE (moved out of Drive): the Ad Designer, Photo Reel, image & video
// editors, the Presenters smart-form and the node canvas. The Media Library
// tile opens the Drive library view — the library data is shared, so anything
// made here lands there too.
const TOOLS: { key: string; titleKey: string; descKey: string; href: string; Icon: React.ElementType; accent: string }[] = [
  { key: 'addesigner',  titleKey: 'suite.tool.addesigner',  descKey: 'suite.tool.addesignerDesc',  href: '/freehold-intelligence/creative-studio/ad-designer', Icon: Megaphone,      accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'reel',        titleKey: 'suite.tool.reel',        descKey: 'suite.tool.reelDesc',        href: '/freehold-intelligence/creative-studio/reel',        Icon: Clapperboard,   accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'image',       titleKey: 'suite.tool.image',       descKey: 'suite.tool.imageDesc',       href: '/freehold-intelligence/creative-studio/image/new',   Icon: ImageIcon,      accent: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.06]' },
  { key: 'video',       titleKey: 'suite.tool.video',       descKey: 'suite.tool.videoDesc',       href: '/freehold-intelligence/creative-studio/video/new',   Icon: Film,           accent: 'text-teal-300 border-teal-400/25 bg-teal-400/[0.06]' },
  { key: 'presenters',  titleKey: 'suite.tool.presenters',  descKey: 'suite.tool.presentersDesc',  href: '/freehold-intelligence/creative-studio/presenters',  Icon: Users,          accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.06]' },
  { key: 'brochureSet', titleKey: 'suite.tool.brochureSet', descKey: 'suite.tool.brochureSetDesc', href: '/freehold-intelligence/creative-studio/ad-designer', Icon: FileUp,         accent: 'text-rose-300 border-rose-400/25 bg-rose-400/[0.06]' },
  { key: 'canvas',      titleKey: 'suite.tool.canvas',      descKey: 'suite.tool.canvasDesc',      href: '/freehold-intelligence/creative-studio/canvas',      Icon: Workflow,       accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'templates',   titleKey: 'suite.tool.templates',   descKey: 'suite.tool.templatesDesc',   href: '/freehold-intelligence/drive/create',                Icon: LayoutTemplate, accent: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.06]' },
  { key: 'library',     titleKey: 'suite.tool.library',     descKey: 'suite.tool.libraryDesc',     href: '/freehold-intelligence/drive/library',               Icon: FolderOpen,     accent: 'text-slate-300 border-white/[0.12] bg-white/[0.04]' },
]

export default function CreativeStudioHome() {
  const t = useT()
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <StudioHomeHeader />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ key, titleKey, descKey, href, Icon, accent }) => (
          <Link
            key={key}
            href={href}
            className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-gold/30"
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${accent}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                {t(titleKey)}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100 group-hover:text-gold rtl:rotate-180" />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{t(descKey)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
