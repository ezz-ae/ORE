import { cnCommand } from "@/src/lib/freehold-format"

export function StatusBadge({
  children,
  tone = "gold",
}: {
  children: React.ReactNode
  tone?: "green" | "gold" | "red" | "blue"
}) {
  return <span className={cnCommand("fh-status", tone)}>{children}</span>
}
