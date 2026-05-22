import Link from "next/link"
import { notFound } from "next/navigation"
import { CommandShell } from "@/src/components/command/CommandShell"
import { StatusBadge } from "@/src/components/command/StatusBadge"
import { projects } from "@/src/data/projects"
import { formatAED } from "@/src/lib/freehold-format"

export default async function ControlRoomMarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = projects.find((item) => item.id === id)
  if (!project) notFound()

  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Control Room / Project Intelligence</p>
          <h1 className="fh-title">{project.projectName}</h1>
          <p className="fh-copy">{project.salesAngle}</p>
          <div className="fh-button-row mt-5">
            <Link className="fh-btn primary" href={`/ads-studio?projectId=${project.id}`}>Send to Ads Studio</Link>
            <Link className="fh-btn" href={`/crm?projectId=${project.id}`}>Create CRM Opportunity</Link>
            <Link className="fh-btn" href={`/notebook?projectId=${project.id}`}>Save to Notebook</Link>
          </div>
        </section>

        <section className="fh-grid three">
          <Info label="Starting price" value={formatAED(project.startingPrice)} />
          <Info label="Payment plan" value={project.paymentPlan} />
          <Info label="Handover" value={project.handover} />
          <Info label="Campaign readiness" value={`${project.campaignReadiness}%`} />
          <Info label="Confidence" value={`${project.confidence}%`} />
          <Info label="Status" value={project.status} />
        </section>

        <section className="fh-grid two">
          <article className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">Buyer Profile</h2>
            <p className="fh-copy mt-3">{project.buyerProfile}</p>
          </article>
          <article className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">Ad Angle</h2>
            <p className="fh-copy mt-3">{project.adAngle}</p>
          </article>
        </section>

        <section className="fh-panel fh-panel-pad">
          <h2 className="fh-panel-title">Operational Signals</h2>
          <div className="fh-grid four mt-5">
            <Info label="Developer" value={project.developer} />
            <Info label="Area" value={project.area} />
            <Info label="Unit types" value={project.unitTypes.join(", ")} />
            <Info label="Confidence" value={<StatusBadge tone="green">{project.confidence}%</StatusBadge>} />
          </div>
        </section>
      </div>
    </CommandShell>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fh-card">
      <p className="fh-muted">{label}</p>
      <div className="mt-2 text-lg font-semibold text-[var(--fh-ink)]">{value}</div>
    </div>
  )
}
