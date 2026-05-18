import { CommandShell } from "@/src/components/command/CommandShell"
import { NotebookClient } from "@/src/components/notebook/NotebookClient"

export default async function NotebookPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const params = await searchParams
  return (
    <CommandShell>
      <NotebookClient projectId={params.projectId} />
    </CommandShell>
  )
}
