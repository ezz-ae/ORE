"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Sparkles, Copy, Check, Send } from "lucide-react"

interface LeadAiComposerProps {
  leadId: string
  phone: string
  email?: string | null
}

interface DraftPayload {
  whatsapp: string
  emailSubject: string
  emailBody: string
  nextSteps: string[]
}

export function LeadAiComposer({ leadId, phone, email }: LeadAiComposerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState<DraftPayload | null>(null)
  const [waDraft, setWaDraft] = useState("")
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  const cleanPhone = phone.replace(/[^0-9]/g, "")

  const generate = async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/leads/ai-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to generate drafts.")
      setDrafts(data)
      setWaDraft(data.whatsapp)
    } catch (err: any) {
      setError(err?.message || "Failed to generate drafts.")
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-generate on first render
  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (value: string) => {
    if (!navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendOnWhatsApp = async () => {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waDraft)}`
    window.open(url, "_blank", "noreferrer")
    setSent(true)

    // Log activity
    try {
      await fetch("/api/leads/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          activityType: "whatsapp_sent",
          note: `WhatsApp message sent: "${waDraft.slice(0, 120)}${waDraft.length > 120 ? "…" : ""}"`,
          markContacted: true,
        }),
      })
    } catch {
      // non-critical — don't block the send
    }
  }

  return (
    <Card className="rounded-[2rem] border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-0.5">
          <CardTitle className="font-serif text-xl font-bold text-primary">AI Follow-Up Composer</CardTitle>
          <p className="text-[10px] uppercase font-bold tracking-widest text-primary/50">
            Draft · Edit · Send
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl ore-gradient shadow-lg shadow-primary/20">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
            AI is drafting your follow-up messages…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
            <button className="ml-2 underline" onClick={generate}>Retry</button>
          </div>
        )}

        {drafts && (
          <Tabs defaultValue="whatsapp" className="space-y-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="steps">Next Steps</TabsTrigger>
            </TabsList>

            {/* ─── WhatsApp tab ─── */}
            <TabsContent value="whatsapp" className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Edit the message below, then hit <strong>Send on WhatsApp</strong> — it opens WhatsApp Web with the text pre-filled.
              </p>
              <Textarea
                value={waDraft}
                onChange={(e) => setWaDraft(e.target.value)}
                className="min-h-[160px] rounded-xl font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="ore-gradient rounded-xl gap-2 font-bold shadow-md shadow-primary/20"
                  onClick={sendOnWhatsApp}
                  disabled={!waDraft.trim()}
                >
                  <Send className="h-4 w-4" />
                  {sent ? "Opened · Send again?" : "Send on WhatsApp"}
                </Button>
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => copy(waDraft)}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="ghost" className="rounded-xl text-xs" onClick={generate} disabled={isLoading}>
                  Regenerate
                </Button>
              </div>
            </TabsContent>

            {/* ─── Email tab ─── */}
            <TabsContent value="email" className="space-y-3">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                defaultValue={drafts.emailSubject}
                readOnly
              />
              <Textarea value={drafts.emailBody} readOnly className="min-h-[220px] rounded-xl" />
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => copy(`${drafts.emailSubject}\n\n${drafts.emailBody}`)}>
                  <Copy className="h-3.5 w-3.5" /> Copy Email
                </Button>
                {email && (
                  <Button variant="outline" className="rounded-xl" asChild>
                    <a href={`mailto:${email}?subject=${encodeURIComponent(drafts.emailSubject)}&body=${encodeURIComponent(drafts.emailBody)}`}>
                      Open in Mail
                    </a>
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* ─── Next Steps tab ─── */}
            <TabsContent value="steps" className="space-y-3">
              <div className="space-y-2">
                {drafts.nextSteps.map((step) => (
                  <div key={step} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-sm">
                    <span className="mt-0.5 text-primary">›</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => copy(drafts.nextSteps.join("\n"))}>
                <Copy className="h-3.5 w-3.5" /> Copy Steps
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
