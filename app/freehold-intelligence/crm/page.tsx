import { Bot, MessageSquareText, PhoneCall, ShieldAlert, TimerReset } from "lucide-react"
import { crmLeads } from "@/src/features/freehold-intelligence/server-session"

const tabs = ["Today", "Leads", "Pipeline", "Agents", "Sources", "Follow-ups", "AI Summary", "Tasks"]

export default function FreeholdCrmPage() {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">CRM Intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">HubSpot-refined sales workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">V1 uses mock lead intelligence shaped for future HubSpot API data. The CRM view prioritizes urgency, quality, duplicates, agent delay and next-best action rather than mirroring raw CRM tables.</p>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
        {tabs.map((tab) => (
          <button key={tab} className="shrink-0 border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55 first:border-[#D4AF37]/35 first:text-white">
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-3">
          {crmLeads.map((lead) => (
            <article key={lead.id} className="border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{lead.name}</h2>
                    <span className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#F8E7AE]">{lead.stage}</span>
                    <span className="border border-white/10 bg-black/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/55">Intent {lead.intentScore}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/55">{lead.aiSummary}</p>
                </div>
                <div className="text-right text-xs text-white/45">
                  <div>{lead.assignedAgent}</div>
                  <div>{lead.source}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white"><TimerReset className="h-3.5 w-3.5 text-[#D4AF37]" />Next best action</div>
                  <p className="mt-2 text-xs leading-5 text-white/60">{lead.nextBestAction}</p>
                </div>
                <div className="border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white"><MessageSquareText className="h-3.5 w-3.5 text-[#D4AF37]" />Suggested WhatsApp</div>
                  <p className="mt-2 text-xs leading-5 text-white/60">{lead.suggestedMessage}</p>
                </div>
                <div className="border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldAlert className="h-3.5 w-3.5 text-[#D4AF37]" />Risks</div>
                  <p className="mt-2 text-xs leading-5 text-white/60">Duplicate: {lead.duplicateRisk ? "Review" : "No"} / Wrong number: {lead.wrongNumberRisk ? "Risk" : "No"}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-[#D4AF37]" />
            CRM AI Summary
          </div>
          <p className="mt-3 text-sm leading-6 text-white/70">Three leads need attention. Rami should be called first, Sara needs duplicate review before assignment, and Michael needs a comparison sent before the day ends.</p>
          <div className="mt-4 grid gap-2">
            {["Which leads need urgent follow-up?", "Which agent is delayed?", "Draft a follow-up message.", "Compare lead quality by source."].map((prompt) => (
              <button key={prompt} className="border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/60 hover:border-[#D4AF37]/35 hover:text-white">{prompt}</button>
            ))}
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-[#07110D]">
            <PhoneCall className="h-4 w-4" />
            Build today sales queue
          </button>
        </aside>
      </div>
    </div>
  )
}
