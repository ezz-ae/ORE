"use client"

import Link from "next/link"
import type { Lead, LeadStage } from "@/src/types/lead"
import { formatAED } from "@/src/lib/freehold-format"
import { StatusBadge } from "@/src/components/command/StatusBadge"

export const leadStages: LeadStage[] = ["New", "Contacted", "Qualified", "Viewing", "Negotiation", "Closed", "Lost"]

const temperatureTone = {
  Cold: "blue",
  Warm: "gold",
  Hot: "green",
  Priority: "red",
} as const

export function PipelineBoard({
  leads,
  onStageChange,
}: {
  leads: Lead[]
  onStageChange: (leadId: string, stage: LeadStage) => void
}) {
  return (
    <section className="fh-panel">
      <div className="fh-panel-header">
        <div>
          <h2 className="fh-panel-title">Live Pipeline Board</h2>
          <p className="fh-panel-copy">Move opportunities between stages. State is local until production storage is connected.</p>
        </div>
      </div>
      <div className="fh-pipeline">
        {leadStages.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.stage === stage)
          return (
            <div className="fh-pipeline-column" key={stage}>
              <div className="flex items-center justify-between gap-3 border-b border-[rgba(220,203,145,0.18)] p-3">
                <h3 className="m-0 text-xs uppercase tracking-[0.08em] text-[#dcd0ad]">{stage}</h3>
                <span className="fh-status gold">{stageLeads.length}</span>
              </div>
              {stageLeads.map((lead) => (
                <article className="fh-lead-card" key={lead.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="m-0 text-sm font-bold">{lead.leadName}</h4>
                      <p className="m-0 text-xs text-[#aab8ad]">{lead.interestedProjectName}</p>
                    </div>
                    <StatusBadge tone={temperatureTone[lead.leadTemperature]}>{lead.leadTemperature}</StatusBadge>
                  </div>
                  <p className="m-0 text-xs text-[#aab8ad]">
                    <span className="fh-strong">{formatAED(lead.budget)}</span> · {lead.source}
                  </p>
                  <p className="m-0 text-xs leading-relaxed text-[#aab8ad]">{lead.nextAction}</p>
                  <div className="fh-button-row">
                    <Link className="fh-btn" href={`/crm/${lead.id}`}>
                      Open
                    </Link>
                    <select className="fh-select" value={lead.stage} onChange={(event) => onStageChange(lead.id, event.target.value as LeadStage)}>
                      {leadStages.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
