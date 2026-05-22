"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { PropertyCard } from "@/components/property-card"
import { useAIChat } from "@/hooks/use-ai-chat"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function ChatPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q")

  const { messages, sendMessage, isLoading, lastProperties, error } = useAIChat()
  const [isMobileView, setIsMobileView] = useState(false)
  const [viewportHeight, setViewportHeight] = useState("100dvh")
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const resultProperties = useMemo(() => lastProperties || [], [lastProperties])

  // Mobile viewport height fix (keyboard push)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`)
      }
    }

    window.visualViewport.addEventListener("resize", handleResize)
    window.visualViewport.addEventListener("scroll", handleResize)
    handleResize()

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize)
      window.visualViewport?.removeEventListener("scroll", handleResize)
    }
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  }, [])

  const shortlistStats = useMemo(() => {
    if (!resultProperties.length) return null
    const prices = resultProperties.map((p: any) => p.price).filter((v: unknown): v is number => Number.isFinite(v as number))
    const minPrice = prices.length ? Math.min(...prices) : 0
    const maxPrice = prices.length ? Math.max(...prices) : 0
    const avgRoi =
      resultProperties.reduce((sum: number, p: any) => sum + (p.investmentMetrics?.roi || 0), 0) /
      Math.max(resultProperties.length, 1)
    const areaCounts = resultProperties.reduce<Record<string, number>>((acc: Record<string, number>, p: any) => {
      const area = p.location?.area || "Dubai"
      acc[area] = (acc[area] || 0) + 1
      return acc
    }, {})
    const topArea = Object.entries(areaCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "Dubai"
    return {
      minPrice,
      maxPrice,
      avgRoi: Number.isFinite(avgRoi) ? avgRoi : 0,
      topArea,
    }
  }, [resultProperties])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const update = () => setIsMobileView(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  const handleSendMessage = useCallback(
    async (content: string) => {
      await sendMessage(content, { isMobile: isMobileView })
    },
    [isMobileView, sendMessage]
  )

  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      handleSendMessage(initialQuery)
    }
  }, [handleSendMessage, initialQuery, messages.length])

  useEffect(() => {
    const behavior: ScrollBehavior = messages.length <= 1 ? "auto" : "smooth"
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(behavior)
      listEndRef.current?.scrollIntoView({ behavior, block: "end" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isLoading, messages.length, resultProperties.length, scrollToBottom])

  const suggestedQuestions = [
    "Build me a shortlist of 2BR apartments in Dubai Marina under AED 2M",
    "What are the strongest ROI projects right now?",
    "Which projects qualify for Golden Visa?",
    "Give me a brief on off-plan vs secondary market",
    "Which family areas would you shortlist in Dubai?",
  ]

  return (
    <div
      className="flex overflow-hidden bg-white lg:bg-[#0A0D10] lg:h-[100dvh]"
      style={{ height: isMobileView ? viewportHeight : undefined }}
    >
      {/* ── Main chat column ── */}
      <div className="flex flex-1 flex-col min-w-0 h-[100dvh] lg:h-auto">

        {/* Slim header */}
        <header className="flex-none border-b border-[#152E24]/10 lg:border-white/[0.06] bg-white/95 lg:bg-[#06080A]/80 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-[#152E24]/60 lg:text-white/40 hover:text-[#152E24] lg:hover:text-white/70 transition-colors text-base leading-none"
                aria-label="Back to home"
              >
                ←
              </Link>
              <div className="h-5 w-px bg-white/10" />
              <span className="text-[13px] font-medium text-[#152E24] lg:text-white/80">Freehold AI</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </div>
            <span className="text-[11px] text-[#152E24]/30 lg:text-white/30">Dubai Real Estate Intelligence</span>
          </div>
        </header>

        {/* Messages area */}
        <div
          ref={scrollViewportRef}
          className="flex-1 overflow-y-auto overscroll-contain scroll-smooth bg-[#FAF8F5] lg:bg-transparent"
        >
          <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6 pb-8">

            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-8 py-12">
                <div className="space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[#D4AF37]/10 ring-8 ring-[#D4AF37]/5">
                    <Sparkles className="h-8 w-8 text-[#D4AF37]" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#152E24] lg:text-white">
                    How can Freehold guide you?
                  </h2>
                  <p className="mx-auto max-w-sm text-sm text-[#152E24]/55 lg:text-white/50">
                    Build shortlists, compare Dubai opportunities, decode market signals, and frame the right next step for your brief.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 w-full">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(question)}
                      className="rounded-2xl border border-[#152E24]/10 lg:border-white/[0.06] bg-white lg:bg-[#0E1216] p-4 text-left text-[13px] text-[#152E24]/70 lg:text-white/60 transition-all hover:border-[#C69B3E]/25 lg:hover:border-[#D4AF37]/25 hover:text-[#152E24] lg:hover:text-white/80 lg:hover:bg-[#0E1216]/80"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                    properties={message.properties}
                    projects={message.projects}
                  />
                ))}
                {isLoading && (
                  <ChatMessage role="assistant" content="Thinking..." />
                )}
                <div ref={listEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-none border-t border-[#152E24]/[0.06] lg:border-white/[0.06] bg-white lg:bg-[#06080A] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-2xl space-y-2">
            {error && (
              <div className="rounded-xl border border-red-200 lg:border-red-500/30 bg-red-50 lg:bg-red-500/10 px-4 py-2 text-xs text-red-600 lg:text-red-400">
                {error}
              </div>
            )}
            <ChatInput
              onSend={handleSendMessage}
              disabled={isLoading}
              placeholder="Ask Freehold about Dubai properties, ROI, or Golden Visa eligibility"
              suggestedQuestions={suggestedQuestions}
            />
          </div>
        </div>
      </div>

      {/* ── Right sidebar — desktop only ── */}
      <aside className="hidden lg:flex lg:w-[280px] xl:w-[320px] flex-col border-l border-white/[0.06] bg-[#06080A]">
        {/* Sidebar header */}
        <div className="flex-none border-b border-white/[0.06] px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
            {resultProperties.length > 0
              ? `${resultProperties.length} match${resultProperties.length !== 1 ? "es" : ""}`
              : "Project panel"}
          </div>
          {shortlistStats && resultProperties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/40">
                {shortlistStats.topArea}
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/40">
                ROI {shortlistStats.avgRoi.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Sidebar body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {resultProperties.length > 0 ? (
            resultProperties.map((property) => (
              <PropertyCard key={property.id} property={property} compact />
            ))
          ) : (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] text-white/25 px-1 pb-2">Try asking about…</p>
              {suggestedQuestions.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  className="w-full text-left rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-[12px] text-white/50 transition hover:border-white/[0.1] hover:text-white/70"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
