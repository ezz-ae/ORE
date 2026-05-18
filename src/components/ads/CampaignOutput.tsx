import type { AdGenerationOutput, AISource } from "@/src/lib/ai/schemas"
import { AISourceBadge } from "@/src/components/ai/AISourceBadge"

export function CampaignOutput({ output, source }: { output: AdGenerationOutput; source: AISource }) {
  return (
    <section className="fh-panel">
      <div className="fh-panel-header">
        <div>
          <h2 className="fh-panel-title">Campaign Output</h2>
          <p className="fh-panel-copy">Property data translated into platform-ready campaign assets and CRM follow-up.</p>
        </div>
        <AISourceBadge source={source} />
      </div>
      <div className="fh-output-grid p-[18px]">
        <OutputCard title="Campaign angle">{output.campaignAngle}</OutputCard>
        <OutputCard title="Headline">{output.headline}</OutputCard>
        <OutputCard title="Meta ad">{output.shortAdCopy}</OutputCard>
        <OutputCard title="Long ad copy">{output.longAdCopy}</OutputCard>
        <OutputCard title="Instagram caption">{output.instagramCaption}</OutputCard>
        <OutputCard title="WhatsApp opener">{output.whatsappOpener}</OutputCard>
        <OutputList title="Google headlines" items={output.googleSearchHeadlines} />
        <OutputList title="Google descriptions" items={output.googleSearchDescriptions} />
        <OutputList title="Lead form questions" items={output.leadFormQuestions} />
        <OutputCard title="Follow-up message">{output.followUpMessage}</OutputCard>
        <OutputList title="Objection handling" items={output.salesObjections} />
        <OutputCard title="Landing section">{output.landingPageSection}</OutputCard>
        <OutputCard title="CTA">{output.ctaRecommendation}</OutputCard>
        <OutputList title="Campaign risk notes" items={output.campaignRiskNotes} />
      </div>
    </section>
  )
}

function OutputCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="fh-output-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

function OutputList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="fh-output-card">
      <h3>{title}</h3>
      <ul className="m-0 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  )
}
