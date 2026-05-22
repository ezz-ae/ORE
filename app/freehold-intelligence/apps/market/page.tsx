import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { ProjectTable } from "@/src/components/market/ProjectTable"
import { projects, projectDisclaimer } from "@/src/data/projects"
import { Database, KeyRound, TableProperties, Unlock } from "lucide-react"

export default function ControlRoomMarketAppPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Control Room / Market App</p>
          <h1 className="fh-title">Internal market database for ads, CRM opportunities and company memory.</h1>
          <p className="fh-copy">
            This market surface now lives inside the Freehold control room. It is an operator app, not a public
            marketing page.
          </p>
        </section>
        <section className="fh-grid four">
          <MetricCard icon={Database} label="Projects Indexed" value="5,000+" note="Platform-level UAE market coverage" />
          <MetricCard icon={TableProperties} label="Full Intelligence Columns" value="125" note="Inside the operating system" />
          <MetricCard icon={Unlock} label="Public Free Columns" value="10" note="Available only through approved flows" />
          <MetricCard icon={KeyRound} label="Control Room" value="Private" note="Routed from /freehold-intelligence" />
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
