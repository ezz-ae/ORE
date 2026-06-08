"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { AISearchBar } from "@/components/ai-search-bar"

interface HeroWithMotionProps {
  heroPrompts: string[]
}

const trustMetrics = [
  { value: "3,500+",  label: "Projects mapped",   suffix: "" },
  { value: "8.6%",   label: "Avg rental yield",   suffix: "" },
  { value: "72%",    label: "Golden Visa ready",  suffix: "" },
  { value: "19 yrs", label: "Market expertise",   suffix: "" },
]

const StarIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

export function HeroWithMotion({ heroPrompts }: HeroWithMotionProps) {
  return (
    <section className="relative flex min-h-[90vh] items-center overflow-x-clip bg-[#0A1F17] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/hero-bg.png"
          alt="Dubai skyline at dusk"
          fill
          priority
          className="object-cover opacity-30"
        />
        {/* Layered gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1F17]/85 via-[#0A1F17]/40 to-[#0A1F17]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_25%,rgba(198,155,62,0.09),transparent)]" />

        {/* Animated glows */}
        <motion.div
          animate={{ opacity: [0.06, 0.13, 0.06], scale: [1, 1.08, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[5%] top-[10%] h-[700px] w-[700px] rounded-full bg-[#C69B3E]/10 blur-[200px]"
        />
        <motion.div
          animate={{ opacity: [0.04, 0.08, 0.04], scale: [1, 1.05, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute bottom-[5%] right-[5%] h-[500px] w-[500px] rounded-full bg-emerald-900/30 blur-[180px]"
        />
      </div>

      <div className="container relative z-10 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">

          {/* Social proof pill */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.06] px-4 py-2 backdrop-blur-sm"
          >
            <div className="flex items-center gap-0.5 text-[#D4AC50]">
              {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
            </div>
            <span className="text-[11px] font-medium text-white/50">
              Trusted by <span className="text-white/80 font-semibold">2,400+</span> investors worldwide
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-serif text-[2.9rem] font-bold leading-[1.04] text-white sm:text-5xl md:text-[4.2rem] lg:text-[5rem]">
              Invest smarter in<br />
              <span className="freehold-text-gradient">Dubai real estate.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/45 md:text-[1.05rem]">
              AI-powered market intelligence, curated projects, and expert advisory — from search to handover.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.07] p-3 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
              <AISearchBar
                placeholder="Try: 2BR Marina under AED 2M, Golden Visa projects, DAMAC Lagoons…"
                showSuggestions={false}
              />
            </div>

            {/* Prompt chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">Try:</span>
              {heroPrompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/chat?q=${encodeURIComponent(prompt)}`}
                  className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-[#C69B3E]/40 hover:bg-[#C69B3E]/10 hover:text-[#D4AC50]"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Trust metrics */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.38 }}
            className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.06] sm:grid-cols-4"
          >
            {trustMetrics.map((metric, i) => (
              <div
                key={metric.label}
                className="bg-[#0A1F17]/80 px-5 py-4 backdrop-blur-sm"
              >
                <p className="text-xl font-bold text-white sm:text-2xl">{metric.value}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/28">
                  {metric.label}
                </p>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A1F17] to-transparent" />
    </section>
  )
}
