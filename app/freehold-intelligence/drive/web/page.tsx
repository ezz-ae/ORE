'use client'

import { Monitor, Globe } from 'lucide-react'
import { HubGrid, type HubApp } from '@/components/freehold/drive/hub-grid'

// Web Designer — the room for anything that renders as a live web page: the
// landing-page editor + manager, and project microsites.
const APPS: HubApp[] = [
  { key: 'landings',   href: '/freehold-intelligence/lead-machine/landings', Icon: Monitor, accent: 'text-teal-300 border-teal-400/25 bg-teal-400/[0.06]' },
  { key: 'microsites', href: '/freehold-intelligence/ai-manager/microsites', Icon: Globe,   accent: 'text-indigo-300 border-indigo-400/25 bg-indigo-400/[0.06]' },
]

export default function WebDesignerPage() {
  return <HubGrid nsPrefix="drive.web" apps={APPS} />
}
