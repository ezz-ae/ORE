"use client"

import { useState } from "react"
import { Wand2 } from "lucide-react"
import { AISourceBadge } from "@/src/components/ai/AISourceBadge"
import type { AIJsonResponse, AISource, OwnerSessionOutput } from "@/src/lib/ai/schemas"
import { buildOwnerSessionFallback } from "@/src/lib/ai/fallbacks"

export function OwnerSessionClient() {
  const [form, setForm] = useState({
    propertyType: "Apartment",
    location: "Dubai Marina",
    price: "AED 2.2M",
    transactionType: "sale",
    ownerGoal: "Sell with qualified buyer inquiries",
    photosStatus: "Needs professional photos",
    budget: "AED 5K-10K",
    sellingPoints: "Vacant, partial marina view, near tram, upgraded kitchen",
    contactMethod: "WhatsApp",
  })
  const [source, setSource] = useState<AISource>("Local engine")
  const [output, setOutput] = useState<OwnerSessionOutput>(() => buildOwnerSessionFallback(form))
  const [loading, setLoading] = useState(false)

  async function buildSession() {
    setLoading(true)
    try {
      const response = await fetch("/api/ai/build-owner-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = (await response.json()) as AIJsonResponse<OwnerSessionOutput>
      setOutput(payload.data)
      setSource(payload.source)
    } catch {
      setOutput(buildOwnerSessionFallback(form))
      setSource("Local engine")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fh-page">
      <section>
        <p className="fh-eyebrow">Paid owner session product</p>
        <h1 className="fh-title">We do not sell leads. We build the advertising system around the property.</h1>
        <p className="fh-copy">A sellable standalone service for owners who need campaign angle, lead filter, WhatsApp script, and launch plan before spend.</p>
      </section>

      <section className="fh-panel fh-panel-pad">
        <div className="fh-form-grid">
          {Object.entries(form).map(([key, value]) => (
            <div className="fh-field" key={key}>
              <label>{key.replace(/([A-Z])/g, " $1")}</label>
              <input className="fh-input" value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
            </div>
          ))}
        </div>
        <button className="fh-btn primary mt-4" onClick={buildSession} disabled={loading}>
          <Wand2 size={15} aria-hidden="true" />
          {loading ? "Building" : "Build Owner Session"}
        </button>
      </section>

      <section className="fh-panel">
        <div className="fh-panel-header">
          <div>
            <h2 className="fh-panel-title">Owner Campaign System</h2>
            <p className="fh-panel-copy">Ready to present to the owner as a paid strategy output.</p>
          </div>
          <AISourceBadge source={source} />
        </div>
        <div className="fh-output-grid p-[18px]">
          <Output title="Property angle">{output.propertyAngle}</Output>
          <Output title="Target audience">{output.targetAudience}</Output>
          <Output title="Meta copy">{output.metaAdCopy}</Output>
          <Output title="Instagram caption">{output.instagramCaption}</Output>
          <Output title="WhatsApp script">{output.whatsappScript}</Output>
          <Output title="Follow-up script">{output.followUpScript}</Output>
          <List title="Lead form" items={output.leadForm} />
          <List title="Launch checklist" items={output.launchChecklist} />
          <List title="Mistakes to avoid" items={output.mistakesToAvoid} />
        </div>
      </section>
    </div>
  )
}

function Output({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="fh-output-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
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
