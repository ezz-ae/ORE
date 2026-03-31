import { SectionShell } from "@/components/lp/section-shell"
import { Sparkles, CheckCircle2 } from "lucide-react"

interface MarketIntelligenceSectionProps {
  data: Record<string, unknown>
}

export function MarketIntelligenceSection({ data }: MarketIntelligenceSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "AI Market Read"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "A concise commercial narrative generated from the live listing."
  const summary = (typeof data.summary === "string" && data.summary) || ""
  const bullets = Array.isArray(data.bullets)
    ? data.bullets.map((item) => (typeof item === "string" ? item : "")).filter(Boolean)
    : []

  if (!summary && !bullets.length) return null

  return (
    <SectionShell
      id="market-intelligence"
      title={title}
      subtitle={subtitle}
      className="bg-[linear-gradient(180deg,rgba(201,169,97,0.07),transparent_60%)]"
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

        {/* Pull-quote card */}
        {summary && (
          <div className="relative overflow-hidden rounded-3xl border border-[#C9A961]/25 bg-gradient-to-br from-[#C9A961]/8 to-transparent p-8 md:p-10">
            <Sparkles className="absolute right-6 top-6 h-5 w-5 text-[#C9A961]/40" />
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A961]/70">
              AI Intelligence · Entrestate
            </div>
            <blockquote className="font-serif text-2xl font-semibold leading-snug text-foreground md:text-3xl">
              &ldquo;{summary}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Bullet list */}
        {bullets.length > 0 && (
          <div className="flex flex-col gap-3">
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 px-5 py-4 text-sm font-medium transition-colors hover:border-primary/30"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A961]" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
