"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AISearchBar } from "@/components/ai-search-bar"

interface HeroWithMotionProps {
  heroPrompts: string[]
}

const trustMetrics = [
  { value: "3,500+", label: "Projects mapped" },
  { value: "45,000+", label: "Units tracked" },
  { value: "19 yrs", label: "Market expertise" },
  { value: "AED 72B", label: "Capital reviewed" },
]

const marketSignals = [
  { label: "Transaction velocity", value: "138", note: "launches this week", color: "text-emerald-400" },
  { label: "Average ROI", value: "8.6%", note: "on tracked releases", color: "text-[#D4AC50]" },
  { label: "Golden Visa ready", value: "72%", note: "of available stock", color: "text-sky-400" },
]

export function HeroWithMotion({ heroPrompts }: HeroWithMotionProps) {
  return (
    <section className="relative overflow-x-clip bg-[#0A1F17] text-white min-h-[90vh] flex items-center">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/hero-bg.png"
          alt="Dubai skyline at twilight"
          fill
          priority
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1F17]/80 via-[#0A1F17]/40 to-[#0A1F17]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(198,155,62,0.08),transparent)]" />

        {/* Subtle animated accents */}
        <motion.div
          animate={{ opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[15%] h-[500px] w-[500px] rounded-full bg-[#C69B3E]/10 blur-[160px]"
        />
        <motion.div
          animate={{ opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[5%] right-[10%] h-[400px] w-[400px] rounded-full bg-[#152E24]/30 blur-[120px]"
        />
      </div>

      <div className="container relative z-10 py-24 md:py-32 lg:py-36">
        <div className="grid gap-12 lg:grid-cols-[1.15fr,0.85fr] lg:gap-16 items-center">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-10"
          >
            {/* Badge */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#C69B3E]/30 bg-[#C69B3E]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AC50]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4AC50] animate-pulse" />
                Live Intelligence
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-6">
              <h1 className="font-serif text-[2.5rem] font-bold leading-[1.08] text-white sm:text-5xl md:text-6xl lg:text-[4.25rem]">
                Dubai Real Estate{" "}
                <span className="ore-text-gradient">Intelligence</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-white/55 md:text-lg md:leading-relaxed">
                Scan every corridor, compare live pricing, and validate risk before you invest.
                Our AI desk captures market-moving launches and Golden Path opportunities.
              </p>
            </div>

            {/* Search */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-3 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-4">
                <AISearchBar
                  placeholder="Search opportunities, ROI, or Golden Visa projects..."
                  showSuggestions={false}
                />
              </div>

              {/* Prompt chips */}
              <div className="flex flex-wrap items-center gap-2 pl-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">Try:</span>
                {heroPrompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/chat?q=${encodeURIComponent(prompt)}`}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium text-white/50 transition-all hover:border-[#C69B3E]/40 hover:bg-[#C69B3E]/10 hover:text-[#D4AC50]"
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="lg" className="ore-gradient h-13 w-full rounded-full px-8 text-[11px] font-bold uppercase tracking-[0.15em] sm:h-14 sm:w-auto sm:px-10" asChild>
                <Link href="/chat">Ask the AI Desk</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-13 w-full rounded-full border-white/15 bg-white/[0.04] px-8 text-[11px] font-bold uppercase tracking-[0.15em] text-white hover:bg-white/10 hover:border-white/25 sm:h-14 sm:w-auto sm:px-10"
                asChild
              >
                <Link href="/market">Market Intelligence</Link>
              </Button>
            </div>

            {/* Trust metrics */}
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 sm:gap-4">
              {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 backdrop-blur-sm"
                >
                  <p className="text-lg font-bold text-white sm:text-xl">{metric.value}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">{metric.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right column — Market Signals */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.05] p-8 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Dubai Snapshot</p>
                  <h3 className="mt-1 text-2xl font-bold text-white">Market Signals</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-400">Live</span>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {marketSignals.map((signal) => (
                  <div key={signal.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
                    <div className="flex items-baseline justify-between">
                      <p className={`text-3xl font-bold ${signal.color}`}>{signal.value}</p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">{signal.note}</p>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-white/50">{signal.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-5 text-[11px] text-white/35">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Updated every 24 minutes
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A1F17] to-transparent" />
    </section>
  )
}
