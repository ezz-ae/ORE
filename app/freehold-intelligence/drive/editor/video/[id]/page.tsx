import { redirect } from 'next/navigation'

// The video editor is a design app — it lives in the Creative Suite now.
// Old Drive editor links keep working, id intact.
export default async function LegacyVideoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/freehold-intelligence/creative-studio/video/${encodeURIComponent(id)}`)
}
