'use client'

import { Sparkles, Wand2, NotebookPen, Presentation, Megaphone } from 'lucide-react'
import { HubGrid, type HubApp } from '@/components/freehold/drive/hub-grid'

// Generative Studio — the room where everything is GENERATED. Each app is
// standalone: the node canvas, the one-screen quick form, the notebook
// (documents/reports), and the roadshow builder.
const APPS: HubApp[] = [
  { key: 'addesigner', href: '/freehold-intelligence/drive/ad-designer',   Icon: Megaphone,    accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'canvas',   href: '/freehold-intelligence/creative-studio',       Icon: Sparkles,     accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'quick',    href: '/freehold-intelligence/creative-studio/quick', Icon: Wand2,        accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'notebook', href: '/freehold-intelligence/notebook',              Icon: NotebookPen,  accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.06]' },
  { key: 'roadshow', href: '/freehold-intelligence/lead-machine/roadshow', Icon: Presentation, accent: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.06]' },
]

export default function GenerativeStudioPage() {
  return <HubGrid nsPrefix="drive.studio" apps={APPS} />
}
