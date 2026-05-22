"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { AISearchBar } from "@/components/ai-search-bar"

interface HeroWithMotionProps {
  heroPrompts: string[]
}

const trustMetrics = [
  { value: "3,500+", label: "Projects mapped" },
  { value: "8.6%", label: "Avg rental yield" },
  { value: "72%", label: "Golden Visa ready" },
  { value: "19 yrs", label: "Market expertise" },
]

export function HeroWithMotion({ heroPrompts }: HeroWithMotionProps) {
  return (
    <section className="relative overflow-x-clip bg-[#0A1F17] text-white min-h-[88vh] flex items-center">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/hero-bg.png"
          alt="Dubai skyline"
          fill
          priority
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1F17]/90 via-[#0A1F17]/50 to-[#0A1F17]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(198,155,62,0.07),transparent)]" />
        <motion.div
          animate={{ opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[8%] left-[10%] h-[600px] w-[600px] rounded-full bg-[#C69B3E]/8 blur-[180px]"
        />
      </div>

      <div className="container relative z-10 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">

          {/* Headline — tight and focused */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-serif text-[2.75rem] font-bold leading-[1.06] text-white sm:text-5xl md:text-[4rem] lg:text-[4.5rem]">
              Find your next<br />
              <span className="freehold-text-gradient">Dubai property.</span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/50 md:text-base">
              Ask Freehold AI — get a curated shortlist, compare ROI, or start an investment brief.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-3 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <AISearchBar
                placeholder="Try: damac lagoons, 2BR marina under 2M, golden visa projects..."
                showSuggestions={false}
              />
            </div>

            {/* Prompt chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25">Try:</span>
              {heroPrompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/chat?q=${encodeURIComponent(prompt)}`}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-white/45 transition-all hover:border-[#C69B3E]/35 hover:bg-[#C69B3E]/10 hover:text-[#D4AC50]"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Metrics strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {trustMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-4 py-3 backdrop-blur-sm"
              >
                <p className="text-lg font-bold text-white sm:text-xl">{metric.value}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/30">{metric.label}</p>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A1F17] to-transparent" />
    </section>
  )
}
