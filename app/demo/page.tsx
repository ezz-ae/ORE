import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"

const steps = [
  { title: "Market data", href: "/market", show: "Open the 35-row market table and pick JVC Parkline or Business Bay Canal.", value: "Freehold starts from structured project intelligence, not random listings." },
  { title: "Campaign generation", href: "/ads-studio?projectId=p-002", show: "Click Send to Ads Studio and generate Meta, Google, WhatsApp, and lead-form copy.", value: "Property data becomes advertising execution in seconds." },
  { title: "CRM opportunity", href: "/crm?projectId=p-002", show: "Create or attach the campaign to a CRM opportunity.", value: "Ad interest is captured into the pipeline with source, project, and next action." },
  { title: "AI follow-up", href: "/crm/l-001", show: "Open Amina Rahman and generate summary plus follow-up.", value: "The salesperson gets WhatsApp, call script, objection, and manager note." },
  { title: "Notebook memory", href: "/notebook?projectId=p-002", show: "Save the insight or ask the notebook about the campaign angle.", value: "The company gets smarter after each lead and campaign." },
  { title: "Company command dashboard", href: "/dashboard", show: "Return to the dashboard and show follow-up risk, campaign readiness, and market shifts.", value: "Management sees the operating system, not a website." },
]

export default function OperatingFlowPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Operating flow</p>
          <h1 className="fh-title">Freehold Intelligence Command Center, complete operating workflow.</h1>
          <p className="fh-copy">Use this page to run the system as a finished Freehold workflow, from market data to company memory.</p>
        </section>
        <section className="fh-grid two">
          {steps.map((step, index) => (
            <article className="fh-panel fh-panel-pad" key={step.title}>
              <p className="fh-eyebrow">Step {index + 1}</p>
              <h2 className="m-0 mt-2 text-xl font-bold">{step.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#aab8ad]"><span className="fh-strong">What to show: </span>{step.show}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#dcd0ad]"><span className="fh-strong">Business value: </span>{step.value}</p>
              <Link className="fh-btn primary mt-5" href={step.href}>
                Open step
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
        <section className="fh-panel fh-panel-pad">
          <p className="fh-eyebrow">Free UAE Real Estate Market Data Access</p>
          <h2 className="m-0 mt-2 text-2xl font-bold">The data is free. The intelligence system is paid.</h2>
          <p className="fh-copy mt-3">
            Market data is free for verified real estate companies: 5,000+ UAE projects, 10 essential public columns,
            company verification required, no payment, and no subscription. The paid product is the command center
            that turns data into CRM, ads, follow-up, and company memory.
          </p>
          <Link className="fh-btn primary mt-5" href="/settings">
            Request Free Access
          </Link>
        </section>
      </div>
    </CommandShell>
  )
}
