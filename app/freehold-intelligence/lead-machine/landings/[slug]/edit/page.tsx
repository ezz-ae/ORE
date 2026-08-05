import { redirect } from 'next/navigation'

// Landing Pages moved to Inventory — old editor links keep working, slug intact.
export default async function LegacyLandingEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/freehold-intelligence/inventory/landings/${encodeURIComponent(slug)}/edit`)
}
