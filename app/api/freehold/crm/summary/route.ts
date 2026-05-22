import { NextResponse } from "next/server"
import { crmLeads } from "@/src/features/freehold-intelligence/server-session"

export async function GET() {
  return NextResponse.json({
    summary: {
      hotLeads: crmLeads.filter((lead) => lead.intentScore >= 85).length,
      urgentFollowUps: crmLeads.filter((lead) => lead.urgency === "critical" || lead.urgency === "high").length,
      duplicateRisks: crmLeads.filter((lead) => lead.duplicateRisk).length,
      wrongNumberRisks: crmLeads.filter((lead) => lead.wrongNumberRisk).length,
      source: "mock-hubspot-shaped-v1",
    },
  })
}
