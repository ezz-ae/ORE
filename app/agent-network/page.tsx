import { Network, PackageCheck, Share2, Users } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { campaigns } from "@/src/data/campaigns"

export default function AgentNetworkPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Freehold Agent Network</p>
          <h1 className="fh-title">Campaign packs for partner agents without losing company intelligence.</h1>
          <p className="fh-copy">The network view turns market data and Ads Studio outputs into controlled partner-ready sales material.</p>
        </section>
        <section className="fh-grid four">
          <MetricCard icon={Network} label="Partner Agents" value="42" note="Partner network coverage" />
          <MetricCard icon={PackageCheck} label="Campaign Packs Ready" value="7" note="Shareable project briefs" />
          <MetricCard icon={Users} label="Partner Leads" value="26" note="Attribution-ready opportunities" />
          <MetricCard icon={Share2} label="Co-broker Signals" value="9" note="Manager review queue" />
        </section>
        <section className="fh-grid three">
          {campaigns.slice(0, 6).map((campaign) => (
            <article className="fh-card" key={campaign.id}>
              <p className="fh-eyebrow">{campaign.platform}</p>
              <h2 className="m-0 mt-2 text-lg font-bold">{campaign.projectName}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#aab8ad]">{campaign.angle}</p>
              <p className="mt-4 text-xs text-[#dcd0ad]">Pack: ad copy, WhatsApp opener, lead form, objection handling.</p>
            </article>
          ))}
        </section>
      </div>
    </CommandShell>
  )
}
