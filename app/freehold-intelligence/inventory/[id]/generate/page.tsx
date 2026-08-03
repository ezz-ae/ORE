import Link from 'next/link'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { getServerT } from '@/lib/i18n/server'
import { GenerateClient } from './_client'

export default async function GenerateLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  // Path memory: when the operator arrived from Ads → Landing Pages, back
  // must return THERE — not strand them in Inventory (the reported loop:
  // "landing pages are on ads, opening takes you to inventory, back gets you
  // there"). Inventory arrivals keep the inventory back path.
  const fromLandings = sp.from === 'landings'
  const { t } = await getServerT()

  // Real DB inventory only — no seed fallback.
  const prop = await getInventoryPropertyBySlug(id)

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-20 text-center">
        <p className="text-slate-500">{t('inv.gen.notFound')}</p>
        <Link href="/freehold-intelligence/inventory" className="mt-4 inline-block text-amber-400">
          ← {t('inv.gen.backToInventory')}
        </Link>
      </div>
    )
  }

  return <GenerateClient prop={prop} fromLandings={fromLandings} />
}
