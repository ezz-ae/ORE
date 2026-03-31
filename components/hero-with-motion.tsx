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
  { value: "3,500+", label: "Dubai projects mapped" },
  { value: "45,000+", label: "Units tracked" },
  { value: "19 yrs", label: "Market expertise" },
  { value: "AED 72B", label: "Capital under review" },
]

const marketSignals = [
  { label: "Transaction velocity", value: "138", note: "launches this week" },
  { label: "Average ROI", value: "8.6%", note: "on tracked releases" },
  { label: "Golden Visa ready", value: "72%", note: "of available stock" },
]

export function HeroWithMotion({ heroPrompts }: HeroWithMotionProps) {
  return (
    <section className="relative overflow-x-clip bg-[#020c08] text-white">
      {/* Background imagery and moving light beams keep the skyline alive without making the hero noisy. */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/hero-bg.png"
          alt="Dubai skyline at twilight"
          fill
          priority
          className="object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020c08] via-[#02120c]/70 to-[#020c08]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_75%,rgba(250,222,164,0.12),transparent_35%),radial-gradient(circle_at_72%_34%,rgba(255,255,255,0.12),transparent_24%)]" />
        <motion.div
          animate={{ rotate: [0, 45, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-16 h-[420px] w-[420px] rounded-[50%] bg-[#C5A059]/10 blur-[140px]"
        />
        <motion.div
          animate={{ rotate: [0, -30, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-20 h-[360px] w-[360px] rounded-[50%] bg-[#163327]/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: ["-10%", "8%", "-6%"], opacity: [0.16, 0.28, 0.18] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] left-[8%] h-[150%] w-28 rotate-[14deg] bg-[linear-gradient(180deg,rgba(255,244,212,0.42),rgba(255,244,212,0))] blur-3xl mix-blend-screen"
        />
        <motion.div
          animate={{ x: ["8%", "-4%", "10%"], opacity: [0.1, 0.22, 0.12] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute -top-[18%] right-[12%] h-[165%] w-24 -rotate-[18deg] bg-[linear-gradient(180deg,rgba(230,250,255,0.3),rgba(230,250,255,0))] blur-3xl mix-blend-screen"
        />
        <motion.div
          animate={{ opacity: [0.18, 0.4, 0.2], scaleX: [0.92, 1.06, 0.96] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[22%] left-[10%] h-px w-[80%] bg-gradient-to-r from-transparent via-[#f4cc7a] to-transparent blur-sm"
        />
        <motion.div
          animate={{ opacity: [0.12, 0.22, 0.14], y: [0, -6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          className="absolute bottom-[10%] left-[18%] h-28 w-28 rounded-full bg-[#f0c26a]/20 blur-[80px]"
        />
      </div>

      <div className="container relative z-10 py-20 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70 sm:text-[11px] sm:tracking-[0.4em]">
                Dubai Market Intelligence
              </span>
              <span className="hidden text-[10px] uppercase tracking-[0.4em] text-white/40 md:block">ORE Collective</span>
            </div>

            <div>
              <h1 className="font-serif text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
                Investment <span className="ore-text-gradient">Intelligence</span> for Dubai Real Estate
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/72 sm:hidden">
                Search Dubai opportunities faster, compare pricing clearly, and move with verified market signals.
              </p>
              <p className="mt-6 hidden max-w-2xl text-base text-white/70 md:text-lg sm:block">
                Scan every Dubai corridor, compare live pricing, and validate risk before you invest. Our AI desk keeps you ahead of market-moving launches and captures every Golden Path opportunity.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left shadow-[0_24px_48px_-28px_rgba(0,0,0,0.5)] sm:px-5"
                >
                  <p className="text-xl font-semibold text-white md:text-2xl">{metric.value}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs sm:tracking-[0.3em]">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/10 px-4 py-4 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-3xl sm:px-6 sm:py-5">
                <AISearchBar
                  placeholder="Search Dubai opportunities, ROI, or Golden Visa projects"
                  showSuggestions={false}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 sm:gap-3 sm:tracking-[0.35em]">
                <span>Golden Path</span>
                <div className="h-0.5 w-10 rounded-full bg-white/40" />
                {heroPrompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/chat?q=${encodeURIComponent(prompt)}`}
                    className="rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white transition hover:border-primary hover:text-primary sm:text-[11px] sm:tracking-[0.35em]"
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Button size="lg" className="ore-gradient h-12 w-full rounded-full px-6 text-[10px] font-bold uppercase tracking-[0.2em] sm:h-14 sm:w-auto sm:px-10 sm:text-[11px] sm:tracking-[0.3em]" asChild>
                <Link href="/chat">Ask the AI Desk</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-full border-white/40 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white sm:h-14 sm:w-auto sm:px-10 sm:text-[11px] sm:tracking-[0.3em]"
                asChild
              >
                <Link href="/market">View Dubai Market Map</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 sm:hidden">
              <span>Licensed Dubai intelligence desk</span>
            </div>
            <div className="hidden flex-wrap gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 sm:flex sm:gap-6 sm:tracking-[0.3em]">
              <span>Trusted by licensed brokers</span>
              <span>Media City HQ · 24/7 concierge</span>
              <span>Instant Golden Visa assessments</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative hidden md:block lg:pl-4"
          >
            <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-3xl md:rounded-[2.5rem] md:p-8">
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">Dubai Snapshot</p>
              <h3 className="mt-3 text-3xl font-bold text-white">Market Signals</h3>
              <div className="mt-6 grid gap-4 md:gap-6">
                {marketSignals.map((signal) => (
                  <div key={signal.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-2xl font-semibold text-white">{signal.value}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">{signal.label}</p>
                    <p className="mt-1 text-sm text-white/60">{signal.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
                <span className="inline-flex h-3 w-3 rounded-full bg-[#16a34a]" />
                Live data refreshed every 24 minutes · Tier-gated insights
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
