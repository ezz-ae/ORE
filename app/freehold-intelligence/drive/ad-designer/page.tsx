import { redirect } from 'next/navigation'

// The Ad Designer is a design app — it lives in the Creative Suite now. Old
// Drive links keep working, query intact (format/layout template deep links).
export default async function LegacyAdDesignerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') sp.set(k, v)
    else if (Array.isArray(v)) v.forEach((x) => sp.append(k, x))
  }
  const q = sp.toString()
  redirect(`/freehold-intelligence/creative-studio/ad-designer${q ? `?${q}` : ''}`)
}
