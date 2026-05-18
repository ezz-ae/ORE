import { CommandShell } from "@/src/components/command/CommandShell"
import { CRMClient } from "@/src/components/crm/CRMClient"

export default async function CRMPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const params = await searchParams
  return (
    <CommandShell>
      <CRMClient projectId={params.projectId} />
    </CommandShell>
  )
}
