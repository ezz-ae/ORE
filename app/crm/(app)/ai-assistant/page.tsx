"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { useAIChat } from "@/hooks/use-ai-chat"
import { Sparkles, FileSpreadsheet, FileText, Pin, Share2 } from "lucide-react"

const suggestions = [
  "Show me all projects in Dubai Marina with 8%+ ROI",
  "Which leads should I follow up with today?",
  "Draft a follow-up email for a lead who viewed 3 properties",
  "Compare Project A vs Project B",
  "Add a new listing called ORE Marina Edge in Dubai Marina by Select Group starting from AED 1,850,000 with 8.4% ROI",
  "Create a branded offer for a lead interested in Dubai Hills",
]

export default function DashboardAIAssistantPage() {
  const { messages, sendMessage, isLoading, error } = useAIChat("broker")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<Array<{ id: string; title?: string | null; pinned: boolean; updated_at: string }>>(
    [],
  )

  const latestAttachment = useMemo(() => {
    const reversed = [...messages].reverse()
    return reversed.find((message) => message.data)?.data
  }, [messages])

  const exportRows = useMemo(() => {
    if (!latestAttachment) return []
    if (latestAttachment.type === "leads") {
      return latestAttachment.data.map((lead: any) => ({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || "",
        source: lead.source || "",
        project: lead.project_slug || "",
      }))
    }
    if (latestAttachment.type === "project-action") {
      return [latestAttachment.data]
    }
    if (latestAttachment.type === "offer") {
      return [
        {
          title: latestAttachment.data.title,
          content: latestAttachment.data.content,
        },
      ]
    }
    return latestAttachment.data.map((project: any) => ({
      title: project.title,
      area: project.area,
      roi: project.roi,
      priceFrom: project.priceFrom || 0,
    }))
  }, [latestAttachment])

  const maybeFetchConversations = async () => {
    const response = await fetch("/api/ai/history")
    if (!response.ok) return []
    const data = await response.json()
    if (!Array.isArray(data?.conversations)) return []
    return data.conversations
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const conversations = await maybeFetchConversations()
      if (active && conversations.length) {
        setHistory(conversations)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!messages.length) return
    let active = true
    const load = async () => {
      const conversations = await maybeFetchConversations()
      if (active && conversations.length) {
        setHistory(conversations)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [messages.length])

  // Auto-scroll chat to bottom on new messages or loading change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages.length, isLoading])

  const togglePin = async (id: string, pinned: boolean) => {
    await fetch("/api/ai/conversations/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned }),
    })
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned } : item)),
    )
  }

  const shareConversation = (title: string) => {
    const text = `ORE AI Insight: ${title}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    }
  }

  const downloadFile = (content: string, filename: string, type = "text/plain") => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    if (!exportRows.length) return
    const headers = Object.keys(exportRows[0])
    const lines = [
      headers.join(","),
      ...exportRows.map((row: Record<string, any>) =>
        headers
          .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ]
    downloadFile(lines.join("\n"), "dashboard-export.csv", "text/csv")
  }

  const handleExportSummary = () => {
    if (!latestAttachment) return
    const header =
      latestAttachment.type === "leads" ? "Lead Summary" : "Project Shortlist Summary"
    const lines = exportRows.map((row: Record<string, any>) =>
      Object.values(row)
        .map((value) => String(value ?? ""))
        .join(" · "),
    )
    downloadFile([header, "", ...lines].join("\n"), "dashboard-summary.txt")
  }

  const handleFileUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/ai/upload-brochure", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload brochure")
      }

      const { text } = await response.json()
      sendMessage(`Create a new project from the following brochure text: ${text}`)
    } catch (error) {
      console.error("Error uploading brochure:", error)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/40 p-6 shadow-sm md:p-8">
        <Badge className="mb-3 ore-gradient border-none px-3" variant="secondary">
          AI Workspace
        </Badge>
        <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">Your Real Estate AI Assistant</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ask for follow-up ideas, shortlist the right property, prepare client messages, or update listings without leaving the CRM.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="overflow-hidden rounded-[2rem] border-border bg-card/50 shadow-md backdrop-blur-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20 p-5 pb-6 md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl ore-gradient shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="font-serif text-xl font-bold">Ask the Assistant</CardTitle>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-0.5">
                  Lead follow-up, stock support, and campaign help
                </p>
              </div>
            </div>
            <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {suggestions.map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-full border-border/60 text-[10px] font-bold uppercase tracking-tight touch-manipulation hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                  onClick={() => sendMessage(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-8">
            <div ref={scrollRef} className="max-h-[65dvh] space-y-4 overflow-y-auto overscroll-contain rounded-3xl border border-border/40 bg-card/40 p-4 shadow-inner md:max-h-[580px] md:p-6">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Start with a buyer question, a listing task, or a follow-up request.
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                  />
                ))
              )}
              {isLoading && <ChatMessage role="assistant" content="Preparing the best answer for you..." />}
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              onFileUpload={handleFileUpload}
              disabled={isLoading}
              placeholder="Ask about buyers, listings, offers, or project comparisons..."
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Latest Result</CardTitle>
              <p className="text-xs text-muted-foreground">
                The most recent answer, shortlist, or draft prepared by the assistant.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!latestAttachment ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nothing saved here yet. Ask for leads, projects, or a client message.
                </div>
              ) : latestAttachment.type === "offer" ? (
                <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm whitespace-pre-wrap">
                  <div className="font-semibold mb-2">{latestAttachment.data.title}</div>
                  {latestAttachment.data.content}
                </div>
              ) : latestAttachment.type === "project-action" ? (
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-3 text-sm">
                  <div className="font-semibold">{latestAttachment.data.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {latestAttachment.data.slug} · {latestAttachment.data.area || "Dubai"} · {latestAttachment.data.status || "selling"}
                  </div>
                </div>
              ) : latestAttachment.type === "leads" ? (
                <div className="space-y-2">
                  {latestAttachment.data.map((lead: any) => (
                    <div
                      key={lead.id}
                      className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                    >
                      <div className="font-semibold">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.phone} · {lead.email || "No email"} · {lead.source || "Unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {latestAttachment.data.map((project: any) => (
                    <div
                      key={project.id}
                      className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                    >
                      <div className="font-semibold">{project.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.area} · ROI {project.roi}% · From AED {project.priceFrom?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export & Share</CardTitle>
              <p className="text-xs text-muted-foreground">Turn AI answers into deliverables.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleExportCsv}
                disabled={!exportRows.length}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export latest results to CSV
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleExportSummary}
                disabled={!exportRows.length}
              >
                <FileText className="h-4 w-4" />
                Download shortlist summary
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <p className="text-xs text-muted-foreground">Pin and share key AI insights.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No conversations saved yet.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold">{item.title || "AI Conversation"}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(item.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => togglePin(item.id, !item.pinned)}
                        aria-label="Pin conversation"
                      >
                        <Pin className={`h-4 w-4 ${item.pinned ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => shareConversation(item.title || "AI Conversation")}
                        aria-label="Share conversation"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
