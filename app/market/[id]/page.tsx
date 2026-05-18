import Link from "next/link"
import { notFound } from "next/navigation"
import { CommandShell } from "@/src/components/command/CommandShell"
import { StatusBadge } from "@/src/components/command/StatusBadge"
import { projects } from "@/src/data/projects"
import { formatAED } from "@/src/lib/freehold-format"

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = projects.find((item) => item.id === id)
  if (!project) notFound()

  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Project intelligence</p>
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
          <article className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">ROI Note</h2>
            <p className="fh-copy mt-3">{project.roiNote}</p>
          </article>
          <article className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">Recommended Platforms</h2>
            <div className="fh-button-row mt-3">
              {["Meta", "Google Search", "WhatsApp", "Instagram"].map((item) => (
                <StatusBadge key={item} tone="gold">{item}</StatusBadge>
              ))}
            </div>
          </article>
        </section>

        <section className="fh-panel fh-panel-pad">
          <h2 className="fh-panel-title">Recommended Lead Form Questions</h2>
          <ul className="fh-list mt-4">
            <li>Are you buying to live, invest, or compare options?</li>
            <li>What budget band should the advisor stay within?</li>
            <li>Do you prefer ready property or off-plan payment flexibility?</li>
            <li>Is {project.area} your first choice or one of several areas?</li>
          </ul>
        </section>
      </div>
    </CommandShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="fh-card">
      <p className="fh-muted m-0 text-xs uppercase tracking-[0.08em]">{label}</p>
      <p className="m-0 mt-2 text-xl font-bold">{value}</p>
    </article>
  )
}
