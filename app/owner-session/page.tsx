import { CommandShell } from "@/src/components/command/CommandShell"
import { OwnerSessionClient } from "@/src/components/owner-session/OwnerSessionClient"

export default function OwnerSessionPage() {
  return (
    <CommandShell>
      <OwnerSessionClient />
    </CommandShell>
  )
}
