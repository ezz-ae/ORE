import Link from 'next/link'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import { GenerateClient } from './_client'

export default async function GenerateLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Try DB first (covers all real projects), then fall back to static data
  let prop = await getInventoryPropertyBySlug(id)
  if (!prop) {
    prop = inventoryProperties.find((p) => p.id === id || p.slug === id) ?? null
  }

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-20 text-center">
        <p className="text-slate-500">Property not found.</p>
        <Link href="/freehold-intelligence/inventory" className="mt-4 inline-block text-amber-400">
          ← Back to Inventory
        </Link>
      </div>
    )
  }

  return <GenerateClient prop={prop} />
}
