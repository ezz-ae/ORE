"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { PropertyCard } from "@/components/property-card"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { useAIChat } from "@/hooks/use-ai-chat"
import type { Property } from "@/lib/types/project"
import { ArrowLeft, Sparkles, ShieldCheck, Zap } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { EvidenceDrawer } from "@/components/evidence-drawer"

export default function ChatPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q")
  
  const { messages, sendMessage, isLoading, lastProperties, error } = useAIChat()
  const [isMobileView, setIsMobileView] = useState(false)
  const [viewportHeight, setViewportHeight] = useState("100dvh")
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const resultProperties = useMemo(() => lastProperties || [], [lastProperties])

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

  const formatShortPrice = (value: number) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(value)

  const shortlistStats = useMemo(() => {
    if (!resultProperties.length) return null
    const prices = resultProperties.map((property) => property.price).filter((price) => Number.isFinite(price))
    const minPrice = prices.length ? Math.min(...prices) : 0
    const maxPrice = prices.length ? Math.max(...prices) : 0
    const avgRoi =
      resultProperties.reduce((sum, property) => sum + (property.investmentMetrics?.roi || 0), 0) /
      Math.max(resultProperties.length, 1)
    const areaCounts = resultProperties.reduce<Record<string, number>>((acc, property) => {
      const area = property.location?.area || "Dubai"
      acc[area] = (acc[area] || 0) + 1
      return acc
    }, {})
    const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Dubai"
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

  const handleSendMessage = useCallback(async (content: string) => {
    await sendMessage(content, { isMobile: isMobileView })
  }, [isMobileView, sendMessage])

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
    "Show me 2BR apartments in Dubai Marina under AED 2M",
    "What are the best ROI projects right now?",
    "Which properties qualify for Golden Visa?",
    "Compare off-plan vs secondary market",
    "Best areas for families in Dubai",
  ]

  return (
    <div 
      className="flex flex-col bg-background overflow-hidden overscroll-none"
      style={{ height: viewportHeight }}
    >
       {/* Header */}
       <header className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
          <div className="container flex h-14 items-center justify-between px-4">
            <div className="flex items-center">
                <Button variant="ghost" size="sm" className="mr-2 text-muted-foreground hover:text-foreground rounded-full h-8 w-8 p-0 sm:w-auto sm:px-3 sm:mr-4" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Back</span>
                    </Link>
                </Button>
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/10 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </span>
                    <div>
                        <h1 className="text-xs sm:text-sm font-semibold leading-none">AI Assistant</h1>
                        <p className="text-[10px] text-muted-foreground mt-0.5">ORE Intelligence</p>
                    </div>
                </div>
            </div>
          </div>
       </header>

       {/* Main Chat Area */}
       <main className="flex-1 flex flex-col overflow-hidden relative">
            {/* Background Effects */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-30">
                <div className="absolute -top-[10%] -right-[5%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute top-[30%] -left-[10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <section
                className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col sm:rounded-2xl md:rounded-[2rem] sm:border border-border bg-card/80 sm:shadow-2xl backdrop-blur-xl overflow-hidden touch-pan-y sm:my-4 md:my-8"
              >
                <div
                    ref={scrollViewportRef}
                    className="flex-1 overflow-y-auto px-4 py-4 md:px-6 overscroll-contain scroll-smooth"
                >
                    <div className="space-y-10 pb-6">
                      {messages.length === 0 ? (
                        <div className="flex min-h-full flex-col items-center justify-center text-center space-y-8 py-12">
                          <div className="space-y-4">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 ring-8 ring-primary/5">
                              <Sparkles className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">How can I help you today?</h2>
                            <p className="text-muted-foreground max-w-md mx-auto px-4">
                              I can help you find properties, analyze market trends, and calculate ROI for your investments in Dubai.
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 w-full px-2 md:px-4">
                            {suggestedQuestions.map((question, index) => (
                              <button
                                key={index}
                                onClick={() => handleSendMessage(question)}
                                className="flex items-center gap-3 rounded-xl border bg-background/50 p-4 text-sm text-left transition-all hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                  <Zap className="h-4 w-4 text-primary" />
                                </div>
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
                            <ChatMessage
                              role="assistant"
                              content="Thinking..."
                            />
                          )}
                          <div ref={listEndRef} />

                          {resultProperties.length > 0 && (
                            <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
                              <div className="border-b bg-muted/30 px-6 py-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="font-semibold">Featured Properties</h3>
                                    <p className="text-xs text-muted-foreground">Based on your preferences</p>
                                  </div>
                                  {shortlistStats && (
                                    <div className="hidden sm:flex gap-2">
                                      <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                        {shortlistStats.topArea}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                        ROI: {shortlistStats.avgRoi.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="p-4 md:p-6 bg-muted/10">
                                <Carousel opts={{ align: "start" }} className="w-full">
                                  <CarouselContent>
                                    {resultProperties.map((property) => (
                                      <CarouselItem key={property.id} className="basis-[74%] sm:basis-[58%] md:basis-[44%] lg:basis-[36%] xl:basis-[32%] pl-4">
                                        <PropertyCard property={property} compact />
                                      </CarouselItem>
                                    ))}
                                  </CarouselContent>
                                  <CarouselPrevious className="-left-3" />
                                  <CarouselNext className="-right-3" />
                                </Carousel>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                </div>

                <div className="flex-none border-t border-border bg-background/95 px-2 py-2 sm:px-4 sm:py-4 backdrop-blur pb-[env(safe-area-inset-bottom,16px)]">
                  <div className="mx-auto w-full max-w-4xl space-y-2">
                    {error && (
                      <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                        {error}
                      </div>
                    )}
                    <ChatInput
                      onSend={handleSendMessage}
                      disabled={isLoading}
                      placeholder="Ask about Dubai properties, ROI, or Golden Visa eligibility"
                      suggestedQuestions={suggestedQuestions}
                    />
                  </div>
                </div>
              </section>
            </div>
        </main>

    </div>
  )
}
