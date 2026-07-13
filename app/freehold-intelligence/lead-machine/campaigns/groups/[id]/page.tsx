import GroupDetailClient from './_client'

export const dynamic = 'force-dynamic'

export default async function CampaignGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GroupDetailClient id={id} />
}
