'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * Scope note pointing at the Team app — the one dashboard that now consolidates
 * every agent/broker control (roster, pipeline, performance, credits, ad
 * permissions, roles).
 *
 * The surfaces it sits on still work exactly as before; this only tells people
 * where the consolidated view lives, in the same idiom as the landing-pages
 * consolidation note.
 */
export function TeamSignpost({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-xs text-slate-300 ${className}`}>
      <Info className="h-3.5 w-3.5 shrink-0 text-gold" />
      <span>{t('team.signpost.note')}</span>
      <Link href="/freehold-intelligence/team" className="font-semibold text-gold transition hover:text-gold-bright">
        {t('team.signpost.link')}
      </Link>
    </div>
  )
}
