"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { useAIChat } from "@/hooks/use-ai-chat"
import { Sparkles, FileSpreadsheet, FileText } from "lucide-react"

const suggestions = [
  "Show me all projects in Dubai Marina with 8%+ ROI",
  "Which leads should I follow up with today?",
  "Draft a follow-up email for a lead who viewed 3 properties",
  "Compare Project A vs Project B",
]

export default function DashboardAIAssistantPage() {
  const { messages, sendMessage, isLoading, error } = useAIChat("broker")

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
    return latestAttachment.data.map((project: any) => ({
      title: project.title,
      area: project.area,
      roi: project.roi,
      priceFrom: project.priceFrom || 0,
    }))
  }, [latestAttachment])

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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          AI Assistant
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Broker AI Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Query projects, analyze leads, and craft sales responses with Gemini-backed intelligence.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-card/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl ore-gradient">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>Ask the AI</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Database queries, CRM intelligence, and sales coaching.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Start a conversation to see project lists, lead insights, and AI coaching.
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
              {isLoading && (
                <ChatMessage role="assistant" content="Analyzing the latest data..." />
              )}
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder="Ask about ROI, leads, follow-ups, or comparisons..."
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Latest AI Data</CardTitle>
              <p className="text-xs text-muted-foreground">
                Results returned from your most recent request.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!latestAttachment ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No attached data yet. Ask for leads, projects, or ROI rankings.
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
        </div>
      </div>
    </div>
  )
}
