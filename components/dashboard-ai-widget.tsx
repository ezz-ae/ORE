"use client"

import { useEffect, useRef } from "react"
import { useAIChat } from "@/hooks/use-ai-chat"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Flame, TrendingUp, MessageSquare, Users } from "lucide-react"

const QUICK_ACTIONS = [
  { label: "ORE hot leads", prompt: "Show me ORE's hottest leads today and explain the priority order", icon: Flame },
  { label: "ORE ROI shortlist", prompt: "Build an ORE shortlist of projects in inventory with 8% or more expected ROI", icon: TrendingUp },
  { label: "ORE WhatsApp", prompt: "Draft an ORE WhatsApp follow-up for a lead who viewed a Dubai Marina project", icon: MessageSquare },
  { label: "ORE unassigned", prompt: "Show me all unassigned ORE leads from the last 7 days", icon: Users },
]

export function DashboardAIWidget() {
  const { messages, sendMessage, isLoading, error } = useAIChat("broker")
  const recentMessages = messages.slice(-6)
  const hasMessages = recentMessages.length > 0
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages or loading state changes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [recentMessages.length, isLoading])

  return (
    <Card className="rounded-[2rem] border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-0.5">
          <CardTitle className="font-serif text-2xl font-bold text-primary">ORE Broker AI</CardTitle>
          <p className="text-[10px] uppercase font-bold tracking-widest text-primary/50">
            ORE Sales Copilot
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl ore-gradient shadow-lg shadow-primary/20">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick action chips — only show when chat is empty */}
        {!hasMessages && (
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl border border-primary/15 bg-card/70 px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-all hover:border-primary/35 hover:bg-primary/8 disabled:opacity-50 touch-manipulation"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="max-h-[340px] space-y-3 overflow-y-auto overscroll-contain rounded-[1.5rem] border border-primary/10 bg-card/60 px-4 py-4 shadow-inner"
        >
          {!hasMessages ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Use the quick actions above or ask ORE AI for the next best buyer move.
            </div>
          ) : (
            recentMessages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
              />
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
              <span>ORE AI is thinking...</span>
            </div>
          )}
          {/* Scroll anchor */}
          <div aria-hidden />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Ask ORE AI who to call, what to send, or which project fits..."
        />
      </CardContent>
    </Card>
  )
}
