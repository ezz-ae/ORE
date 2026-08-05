import { redirect } from 'next/navigation'

// The Photo Reel is a design app — it lives in the Creative Suite now. Old
// Drive links keep working, query intact (?project=…&auto=1 autopilot links).
export default async function LegacyReelPage({
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
  redirect(`/freehold-intelligence/creative-studio/reel${q ? `?${q}` : ''}`)
}
