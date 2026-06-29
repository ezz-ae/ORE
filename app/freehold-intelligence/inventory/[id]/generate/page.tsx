import Link from 'next/link'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { getServerT } from '@/lib/i18n/server'
import { GenerateClient } from './_client'

export default async function GenerateLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  return <GenerateClient prop={prop} />
}
