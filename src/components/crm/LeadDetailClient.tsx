"use client"

import { useState } from "react"
import Link from "next/link"
import { BookMarked, CircleDollarSign, MessageSquareText, RefreshCw, Send, UploadCloud } from "lucide-react"
import type { Lead, LeadStage } from "@/src/types/lead"
import type { Project } from "@/src/types/project"
import type { AIJsonResponse, AISource, LeadSummaryOutput } from "@/src/lib/ai/schemas"
import { formatAED } from "@/src/lib/freehold-format"
import { AISourceBadge } from "@/src/components/ai/AISourceBadge"
import { StatusBadge } from "@/src/components/command/StatusBadge"
import { leadStages } from "@/src/components/crm/PipelineBoard"

export function LeadDetailClient({
  lead,
  project,
  hubspotConnected,
}: {
  lead: Lead
  project?: Project
  hubspotConnected: boolean
}) {
  const [summary, setSummary] = useState<LeadSummaryOutput>({
    leadSummary: lead.aiSummary,
    likelyIntent: lead.buyerType,
    budgetFit: lead.budget ? `${formatAED(lead.budget)} target budget` : "Owner-side opportunity",
    urgency: lead.leadTemperature,
    recommendedNextAction: lead.nextAction,
    whatsappMessage: `Hi ${lead.leadName.split(" ")[0]}, this is Freehold. Should I send the ${lead.interestedProjectName} brief or book a quick call?`,
    callScript: "Confirm intent, budget, timeline, and the objection that could block the next step.",
    objectionToExpect: "Payment plan, area comparison, or timing.",
    managerNote: "Save the outcome to the Market Notebook after follow-up.",
  })
  const [source, setSource] = useState<AISource>("Local engine")
  const [stage, setStage] = useState<LeadStage>(lead.stage)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState("")

  async function runAi(endpoint: "summarize-lead" | "recommend-followup") {
    setIsLoading(true)
    setToast("")
    try {
      const response = await fetch(`/api/ai/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      })
      const payload = (await response.json()) as AIJsonResponse<LeadSummaryOutput>
      setSummary(payload.data)
      setSource(payload.source)
    } catch {
      setToast("Local engine stayed active. The workflow remains usable without external services.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fh-page">
      {toast ? <div className="fh-toast">{toast}</div> : null}
      <section>
        <p className="fh-eyebrow">CRM opportunity</p>
        <h1 className="fh-title">{lead.leadName}</h1>
        <p className="fh-copy">Lead profile, source context, AI summary, follow-up scripts, project bridge, and company memory actions.</p>
      </section>

      <div className="fh-split">
        <aside className="fh-panel fh-panel-pad">
          <div className="grid gap-3">
            <Profile label="Contact" value={lead.phone} detail={lead.email} />
            <Profile label="Source" value={lead.source} />
            <Profile label="Interested project" value={lead.interestedProjectName} />
            <Profile label="Budget" value={formatAED(lead.budget)} />
            <div className="fh-field">
              <label>Stage</label>
              <select className="fh-select" value={stage} onChange={(event) => setStage(event.target.value as LeadStage)}>
                {leadStages.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="fh-muted text-xs">Temperature</span>
              <div className="mt-2">
                <StatusBadge tone={lead.leadTemperature === "Hot" || lead.leadTemperature === "Priority" ? "green" : "gold"}>{lead.leadTemperature}</StatusBadge>
              </div>
            </div>
          </div>
        </aside>

        <section className="fh-panel">
          <div className="fh-panel-header">
            <div>
              <h2 className="fh-panel-title">AI Sales Command</h2>
              <p className="fh-panel-copy">Generated summary, WhatsApp, call script, objection, and manager note.</p>
            </div>
            <AISourceBadge source={source} />
          </div>
          <div className="fh-output-grid p-[18px]">
            <Output title="AI summary">{summary.leadSummary}</Output>
            <Output title="Likely intent">{summary.likelyIntent}</Output>
            <Output title="Budget fit">{summary.budgetFit}</Output>
            <Output title="Urgency">{summary.urgency}</Output>
            <Output title="Suggested WhatsApp">{summary.whatsappMessage}</Output>
            <Output title="Call script">{summary.callScript}</Output>
            <Output title="Objection to expect">{summary.objectionToExpect}</Output>
            <Output title="Manager note">{summary.managerNote}</Output>
          </div>
          <div className="fh-panel-header">
            <div className="fh-button-row">
              <button className="fh-btn primary" onClick={() => runAi("summarize-lead")} disabled={isLoading}>
                <RefreshCw size={15} aria-hidden="true" />
                Generate AI Summary
              </button>
              <button className="fh-btn" onClick={() => runAi("recommend-followup")} disabled={isLoading}>
                <MessageSquareText size={15} aria-hidden="true" />
                Generate Follow-up
              </button>
              <Link className="fh-btn" href={`/ads-studio?projectId=${lead.interestedProjectId}&buyerType=${encodeURIComponent(lead.buyerType)}`}>
                <Send size={15} aria-hidden="true" />
                Create Ad from Lead Interest
              </Link>
              <button className="fh-btn" onClick={() => setToast("Saved to Market Notebook for the current workspace session.")}>
                <BookMarked size={15} aria-hidden="true" />
                Save to Notebook
              </button>
              <button className="fh-btn" disabled title={hubspotConnected ? "Approve HubSpot field mapping before syncing" : "Connect HUBSPOT_ACCESS_TOKEN to enable mapping review"}>
                <UploadCloud size={15} aria-hidden="true" />
                {hubspotConnected ? "HubSpot Mapping Pending" : "Sync to HubSpot Disabled"}
              </button>
              <button className="fh-btn" onClick={() => setToast(`Stage moved to ${stage} for the current workspace view.`)}>
                <CircleDollarSign size={15} aria-hidden="true" />
                Move Stage
              </button>
            </div>
          </div>
        </section>
      </div>

      {project ? (
        <section className="fh-panel fh-panel-pad">
          <h2 className="fh-panel-title">Interested Project Intelligence</h2>
          <div className="fh-grid three mt-4">
            <Output title="Campaign readiness">{project.campaignReadiness}%</Output>
            <Output title="Ad angle">{project.adAngle}</Output>
            <Output title="ROI note">{project.roiNote}</Output>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Profile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-b border-[rgba(220,203,145,0.18)] pb-3">
      <span className="fh-muted text-xs">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
      {detail ? <span className="fh-muted text-xs">{detail}</span> : null}
    </div>
  )
}

function Output({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="fh-output-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}
