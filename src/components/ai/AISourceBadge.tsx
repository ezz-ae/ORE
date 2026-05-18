import { Bot, ServerCog } from "lucide-react"
import { StatusBadge } from "@/src/components/command/StatusBadge"
import type { AISource } from "@/src/lib/ai/schemas"

export function AISourceBadge({ source }: { source: AISource }) {
  const Icon = source === "Gemini" ? Bot : ServerCog
  return (
    <StatusBadge tone={source === "Gemini" ? "green" : "blue"}>
      <Icon size={13} aria-hidden="true" />
      {source}
    </StatusBadge>
  )
}
