import Link from 'next/link'
import { Workflow, ArrowRight, Users } from 'lucide-react'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import QuickClient from './quick/_client'
import { StudioHomeHeader, StudioRowText } from './_home-header'

export const dynamic = 'force-dynamic'

// Creative Studio home — REDESIGNED front door. The friendly smart-form
// creator (presenter · property · format · brief → generate) is the primary
// surface; the ReactFlow node canvas moved to /canvas as the advanced mode.
export default async function CreativeStudioHome() {
  const properties = await getInventoryPropertiesFromDB()
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <StudioHomeHeader />
      <QuickClient properties={properties} embedded />
      <StudioAdvancedRow />
    </div>
  )
}

function StudioAdvancedRow() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Link
        href="/freehold-intelligence/creative-studio/canvas"
        className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-gold/30"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-400/25 bg-violet-400/10 text-violet-300">
          <Workflow className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <StudioRowText kind="canvas" />
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold rtl:rotate-180" />
      </Link>
      <Link
        href="/freehold-intelligence/drive/create"
        className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-gold/30"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <Users className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <StudioRowText kind="drive" />
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold rtl:rotate-180" />
      </Link>
    </div>
  )
}

