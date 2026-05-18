import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { ProjectTable } from "@/src/components/market/ProjectTable"
import { projects, projectDisclaimer } from "@/src/data/projects"
import { Database, KeyRound, TableProperties, Unlock } from "lucide-react"

export default function MarketPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Freehold Market Database</p>
          <h1 className="fh-title">A market database built to trigger ads, CRM opportunities, and company memory.</h1>
          <p className="fh-copy">
            The market table includes 35 UAE-style project records. Platform positioning shows the paid system around the
            full intelligence layer.
          </p>
        </section>
        <section className="fh-grid four">
          <MetricCard icon={Database} label="Projects Indexed" value="5,000+" note="Platform-level UAE market coverage" />
          <MetricCard icon={TableProperties} label="Full Intelligence Columns" value="125" note="Inside the operating system" />
          <MetricCard icon={Unlock} label="Public Free Columns" value="10" note="Available to verified real estate companies" />
          <MetricCard icon={KeyRound} label="Verification" value="Required" note="Free data access is not instant download" />
        </section>
        <section className="fh-panel">
          <div className="fh-panel-header">
            <div>
              <h2 className="fh-panel-title">Market Intelligence Table</h2>
              <p className="fh-panel-copy">{projectDisclaimer}</p>
            </div>
          </div>
          <ProjectTable projects={projects} />
        </section>
      </div>
    </CommandShell>
  )
}
