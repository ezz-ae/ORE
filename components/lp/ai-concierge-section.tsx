import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionShell } from "@/components/lp/section-shell"
import { Sparkles, MessageSquare, ArrowRight } from "lucide-react"

interface AiConciergeSectionProps {
  data: Record<string, unknown>
  landingSlug: string
  projectSlug: string
}

const DEFAULT_PROMPTS = [
  "What is the expected ROI for this project?",
  "How does the payment plan work?",
  "Is this eligible for the Golden Visa?",
  "What similar projects are in this area?",
]

export function AiConciergeSection({ data, landingSlug, projectSlug }: AiConciergeSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Ask ORE AI"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Get instant answers about this project — AI qualifies your brief before the broker follows up."
  const prompts = Array.isArray(data.prompts)
    ? data.prompts.map((item) => (typeof item === "string" ? item : "")).filter(Boolean)
    : []

  const displayPrompts = prompts.length ? prompts : DEFAULT_PROMPTS
  const query = encodeURIComponent(
    prompts[0] || `Tell me about ${projectSlug} and whether it fits an investment buyer.`,
  )
  const chatHref = `/chat?q=${query}&source=lp&landing=${landingSlug}&project=${projectSlug}`

  return (
    <SectionShell id="ai-concierge" title={title} subtitle={subtitle}>
      <div className="overflow-hidden rounded-3xl border border-[#C9A961]/20 bg-[radial-gradient(ellipse_at_top_left,rgba(201,169,97,0.15),transparent_50%),linear-gradient(135deg,#0f172a,#111827)] text-white">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">

          {/* Left: headline + CTA */}
          <div className="flex flex-col justify-center gap-6 p-8 md:p-10 lg:border-r lg:border-white/8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#C9A961]/30 bg-[#C9A961]/10">
              <Sparkles className="h-6 w-6 text-[#C9A961]" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Progressive Qualification
              </p>
              <p className="font-serif text-3xl font-bold leading-tight text-white md:text-4xl">
                AI starts the investment conversation before the broker joins.
              </p>
            </div>
            <p className="text-sm leading-relaxed text-white/60">
              Ask anything — ROI, payment plan, area comparison, visa eligibility. The AI draws on live data from 3,500+ Dubai projects.
            </p>
            <Button
              asChild
              size="lg"
              className="ore-gradient w-fit rounded-xl px-8 font-bold shadow-lg shadow-[#C9A961]/20 text-primary-foreground"
            >
              <Link href={chatHref}>
                Open AI Assistant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Right: sample prompts */}
          <div className="flex flex-col justify-center gap-3 p-8 md:p-10">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
              Sample questions
            </p>
            {displayPrompts.map((prompt, idx) => (
              <Link
                key={prompt}
                href={`/chat?q=${encodeURIComponent(prompt)}&source=lp&landing=${landingSlug}&project=${projectSlug}`}
                className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-5 py-3.5 text-sm text-white/80 transition-all hover:border-[#C9A961]/30 hover:bg-[#C9A961]/8 hover:text-white"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-[#C9A961]/60 transition-colors group-hover:text-[#C9A961]" />
                <span>{prompt}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
