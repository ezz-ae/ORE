import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { SystemModule } from "../types"
import { StatusPill } from "./status-pill"

export function SystemCard({ system }: { system: SystemModule }) {
  const progress = Number(system.progress_pct ?? 0)
  return (
    <Link href={`/freehold-intelligence/systems/${system.module_id}`} className="group block h-full">
      <Card className="h-full border-white/10 bg-white/[0.04] text-white shadow-none transition hover:border-[#D4AF37]/50 hover:bg-white/[0.06]">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">{system.layer}</p>
              <CardTitle className="mt-2 text-xl">{system.module_name}</CardTitle>
            </div>
            <ArrowUpRight className="h-5 w-5 text-white/40 transition group-hover:text-[#D4AF37]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pb-6">
          <p className="min-h-12 text-sm leading-6 text-white/65">{system.description}</p>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={system.status} />
            <StatusPill value={system.health} />
            {system.milestone_code ? <StatusPill value={system.milestone_code} className="normal-case" /> : null}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>Build progress</span><span>{progress}%</span>
            </div>
            <Progress value={progress} className="bg-white/10 [&>div]:bg-[#D4AF37]" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
