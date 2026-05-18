"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bot, CircleDollarSign, Flame, ListChecks, MessageSquareWarning, Search, Users } from "lucide-react"
import { leads as seedLeads } from "@/src/data/leads"
import { projects } from "@/src/data/projects"
import type { Lead, LeadStage } from "@/src/types/lead"
import { formatAED } from "@/src/lib/freehold-format"
import { buildMarketOpportunity } from "@/src/lib/crm/opportunities"
import { MetricCard } from "@/src/components/command/MetricCard"
import { StatusBadge } from "@/src/components/command/StatusBadge"
import { PipelineBoard } from "@/src/components/crm/PipelineBoard"

export function CRMClient({ projectId }: { projectId?: string }) {
  const [leads, setLeads] = useState<Lead[]>(() => {
    if (!projectId) return seedLeads
    const project = projects.find((item) => item.id === projectId)
    if (!project) return seedLeads
    const projectLead = buildMarketOpportunity(project)
    return [projectLead, ...seedLeads]
  })
  const [stage, setStage] = useState("All")
  const [source, setSource] = useState("All")
  const [buyerType, setBuyerType] = useState("All")
  const [temperature, setTemperature] = useState("All")
  const [search, setSearch] = useState("")

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesSearch = `${lead.leadName} ${lead.interestedProjectName} ${lead.assignedAgent}`.toLowerCase().includes(search.toLowerCase())
        return (
          matchesSearch &&
          (stage === "All" || lead.stage === stage) &&
          (source === "All" || lead.source === source) &&
          (buyerType === "All" || lead.buyerType === buyerType) &&
          (temperature === "All" || lead.leadTemperature === temperature)
        )
      }),
    [leads, stage, source, buyerType, temperature, search],
  )

  function moveStage(leadId: string, nextStage: LeadStage) {
    setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, stage: nextStage } : lead)))
  }

  const qualified = leads.filter((lead) => ["Qualified", "Viewing", "Negotiation", "Closed"].includes(lead.stage)).length
  const hot = leads.filter((lead) => lead.leadTemperature === "Hot" || lead.leadTemperature === "Priority").length
  const pipelineValue = leads.reduce((total, lead) => total + lead.budget, 0)

  return (
    <div className="fh-page">
      <section>
        <p className="fh-eyebrow">Freehold CRM Core</p>
        <h1 className="fh-title">A real estate sales command board, not a generic contact table.</h1>
        <p className="fh-copy">
          Track buyer intent, project interest, campaign source, assigned agent, next action, and the market learning
          each opportunity creates.
        </p>
      </section>

      <section className="fh-grid six">
        <MetricCard icon={Users} label="New Leads" value={String(leads.filter((lead) => lead.stage === "New").length)} note="Fresh inquiries needing first response" />
        <MetricCard icon={ListChecks} label="Qualified Leads" value={String(qualified)} note="Budget and project fit confirmed" />
        <MetricCard icon={MessageSquareWarning} label="Follow-ups Due" value="19" note="Today across WhatsApp and calls" />
        <MetricCard icon={Flame} label="Hot Opportunities" value={String(hot)} note="Manager action required" />
        <MetricCard icon={CircleDollarSign} label="Estimated Pipeline Value" value={formatAED(pipelineValue)} note="Weighted opportunity value" />
        <MetricCard icon={Bot} label="AI Action Required" value="8" note="Summaries or follow-ups pending" />
      </section>

      <section className="fh-panel fh-panel-pad">
        <div className="fh-form-grid">
          <div className="fh-field">
            <label>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#aab8ad]" />
              <input className="fh-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Lead, project, agent" />
            </div>
          </div>
          <Filter label="Stage" value={stage} onChange={setStage} options={["All", "New", "Contacted", "Qualified", "Viewing", "Negotiation", "Closed", "Lost"]} />
          <Filter label="Source" value={source} onChange={setSource} options={["All", ...Array.from(new Set(leads.map((lead) => lead.source)))]} />
          <Filter label="Budget" value="All" onChange={() => undefined} options={["All", "Under AED 1M", "AED 1M-2.5M", "AED 2.5M+"]} />
          <Filter label="Buyer type" value={buyerType} onChange={setBuyerType} options={["All", ...Array.from(new Set(leads.map((lead) => lead.buyerType)))]} />
          <Filter label="Lead temperature" value={temperature} onChange={setTemperature} options={["All", "Cold", "Warm", "Hot", "Priority"]} />
        </div>
      </section>

      <PipelineBoard leads={filteredLeads} onStageChange={moveStage} />

      <section className="fh-panel">
        <div className="fh-panel-header">
          <div>
            <h2 className="fh-panel-title">Lead Command Table</h2>
            <p className="fh-panel-copy">Compact sales view under the pipeline for scanning and manager review.</p>
          </div>
        </div>
        <div className="fh-table-wrap">
          <table className="fh-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Project</th>
                <th>Budget</th>
                <th>Stage</th>
                <th>Temperature</th>
                <th>Next action</th>
                <th>Source</th>
                <th>Agent</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td className="fh-strong">{lead.leadName}</td>
                  <td>{lead.interestedProjectName}</td>
                  <td>{formatAED(lead.budget)}</td>
                  <td>{lead.stage}</td>
                  <td>
                    <StatusBadge tone={lead.leadTemperature === "Hot" || lead.leadTemperature === "Priority" ? "green" : "gold"}>{lead.leadTemperature}</StatusBadge>
                  </td>
                  <td>{lead.nextAction}</td>
                  <td>{lead.source}</td>
                  <td>{lead.assignedAgent}</td>
                  <td>
                    <Link className="fh-btn" href={`/crm/${lead.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="fh-field">
      <label>{label}</label>
      <select className="fh-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}
