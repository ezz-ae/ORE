import { CommandShell } from "@/src/components/command/CommandShell"
import { AdsStudioClient } from "@/src/components/ads/AdsStudioClient"

export default async function AdsStudioPage({ searchParams }: { searchParams: Promise<{ projectId?: string; buyerType?: string }> }) {
  const params = await searchParams
  return (
    <CommandShell>
      <AdsStudioClient initialProjectId={params.projectId} initialBuyerType={params.buyerType} />
    </CommandShell>
  )
}
