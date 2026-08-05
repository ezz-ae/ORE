import { redirect } from 'next/navigation'

// The image editor is a design app — it lives in the Creative Suite now.
// Old Drive editor links keep working, id intact.
export default async function LegacyImageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/freehold-intelligence/creative-studio/image/${encodeURIComponent(id)}`)
}
