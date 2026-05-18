import { KeyRound, PlugZap, ShieldCheck } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { getHubSpotStatus } from "@/src/lib/hubspot/client"

export default function SettingsPage() {
  const hubspot = getHubSpotStatus()
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Settings</p>
          <h1 className="fh-title">Connections, verification, and production readiness controls.</h1>
          <p className="fh-copy">No fake production sync. Missing services are clearly shown as not connected.</p>
        </section>
        <section className="fh-grid three">
          <MetricCard icon={PlugZap} label="HubSpot" value={hubspot.label} note={hubspot.message} />
          <MetricCard icon={KeyRound} label="Gemini" value={process.env.GEMINI_API_KEY ? "Configured" : "Local engine"} note="Server-side only. No client key exposure." />
          <MetricCard icon={ShieldCheck} label="Storage" value="Local Index" note="External storage is not claimed until credentials are connected." />
        </section>
        <section className="fh-panel fh-panel-pad">
          <p className="fh-eyebrow">Free UAE Real Estate Market Data Access</p>
          <h2 className="m-0 mt-2 text-2xl font-bold">Request Free Access</h2>
          <p className="fh-copy mt-3">
            Market data is free for verified real estate companies. Includes 5,000+ UAE projects and 10 essential
            public columns. The full system contains 125 intelligence columns, CRM workflows, Ads Studio, and Market
            Notebook. Company verification required. No payment. No subscription. The data is free. The intelligence
            system is paid.
          </p>
          <button className="fh-btn primary mt-5">Request Free Access</button>
        </section>
      </div>
    </CommandShell>
  )
}
