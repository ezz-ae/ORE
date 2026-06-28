"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { BookMarked, ClipboardCopy, Download, PlusCircle, Wand2 } from "lucide-react"
import { projects } from "@/src/data/projects"
import { buildAdFallback } from "@/src/lib/ai/fallbacks"
import type { AIJsonResponse, AISource, AdGenerationOutput } from "@/src/lib/ai/schemas"
import { CampaignOutput } from "@/src/components/ads/CampaignOutput"

const buyerTypeOptions = ["investor", "end-user", "first-time buyer", "high-net-worth", "overseas buyer", "tenant"]

function normalizeBuyerType(value?: string) {
  const normalized = value?.toLowerCase() || "investor"
  if (buyerTypeOptions.includes(normalized)) return normalized
  if (normalized.includes("owner") || normalized.includes("end")) return "end-user"
  if (normalized.includes("high")) return "high-net-worth"
  if (normalized.includes("overseas")) return "overseas buyer"
  if (normalized.includes("tenant")) return "tenant"
  return "investor"
}

export function AdsStudioClient({ initialProjectId, initialBuyerType }: { initialProjectId?: string; initialBuyerType?: string }) {
  const [projectId, setProjectId] = useState(initialProjectId || projects[0].id)
  const [objective, setObjective] = useState("off-plan inquiry")
  const [platform, setPlatform] = useState("Meta")
  const [buyerType, setBuyerType] = useState(normalizeBuyerType(initialBuyerType))
  const [budgetBand, setBudgetBand] = useState("AED 800K-1.5M")
  const [tone, setTone] = useState("premium")
  const [source, setSource] = useState<AISource>("Local engine")
  const [output, setOutput] = useState<AdGenerationOutput>(() => buildAdFallback(projects.find((project) => project.id === projectId) || projects[0]))
  const [toast, setToast] = useState("")
  const [loading, setLoading] = useState(false)
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) || projects[0], [projectId])

  async function generateCampaign() {
    setLoading(true)
    setToast("")
    try {
      const response = await fetch("/api/ai/generate-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, objective, platform, buyerType, budgetBand, tone }),
      })
      const payload = (await response.json()) as AIJsonResponse<AdGenerationOutput>
      setOutput(payload.data)
      setSource(payload.source)
    } catch {
      setOutput(buildAdFallback(selectedProject, { objective, platform, buyerType, budgetBand, tone }))
      setSource("Local engine")
      setToast("Local engine generated the campaign because the external AI call was unavailable.")
    } finally {
      setLoading(false)
    }
  }

  const allCopy = JSON.stringify(output, null, 2)

  return (
    <div className="fh-page">
      <section>
        <p className="fh-eyebrow">Freehold Ads Studio</p>
        <h1 className="fh-title">Turn property intelligence into ads, lead forms, and follow-up scripts.</h1>
        <p className="fh-copy">
          Select a project from the Freehold Market Database, generate campaign assets, then create a CRM opportunity
          or save the learning to company memory.
        </p>
      </section>

      {toast ? <div className="fh-toast">{toast}</div> : null}

      <section className="fh-panel fh-panel-pad">
        <div className="fh-form-grid">
          <Field label="Project">
            <select className="fh-select" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objective">
            <select className="fh-select" value={objective} onChange={(event) => setObjective(event.target.value)}>
              {["sell", "rent", "off-plan inquiry", "investor lead", "owner session", "valuation request"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Platform">
            <select className="fh-select" value={platform} onChange={(event) => setPlatform(event.target.value)}>
              {["Meta", "Instagram", "Google Search", "WhatsApp", "TikTok"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Buyer type">
            <select className="fh-select" value={buyerType} onChange={(event) => setBuyerType(event.target.value)}>
              {buyerTypeOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Budget band">
            <select className="fh-select" value={budgetBand} onChange={(event) => setBudgetBand(event.target.value)}>
              {["AED 500K-900K", "AED 800K-1.5M", "AED 1.5M-2.5M", "AED 2.5M-5M", "AED 5M+"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Tone">
            <select className="fh-select" value={tone} onChange={(event) => setTone(event.target.value)}>
              {["premium", "direct", "investor-focused", "urgent", "educational"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="fh-button-row mt-4">
          <button className="fh-btn primary" onClick={generateCampaign} disabled={loading}>
            <Wand2 size={15} aria-hidden="true" />
            {loading ? "Generating" : "Generate Campaign"}
          </button>
          <button className="fh-btn" onClick={() => navigator.clipboard.writeText(allCopy).then(() => setToast("Campaign copied to clipboard."))}>
            <ClipboardCopy size={15} aria-hidden="true" />
            Copy all
          </button>
          <Link className="fh-btn" href={`/crm?projectId=${projectId}`}>
            <PlusCircle size={15} aria-hidden="true" />
            Create CRM Opportunity
          </Link>
          <button className="fh-btn" onClick={() => {
            if (!allCopy.trim()) { setToast("Generate a campaign first."); return }
            try {
              const key = 'fh_market_notebook'
              const existing = JSON.parse(localStorage.getItem(key) || '[]')
              existing.unshift({ projectId, savedAt: new Date().toISOString(), content: allCopy })
              localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)))
              setToast("Campaign saved to your Market Notebook.")
            } catch { setToast("Could not save to notebook.") }
          }}>
            <BookMarked size={15} aria-hidden="true" />
            Save to Notebook
          </button>
          <button className="fh-btn" onClick={() => {
            if (!allCopy.trim()) { setToast("Generate a campaign first."); return }
            try {
              const blob = new Blob([allCopy], { type: 'text/markdown' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `campaign-brief-${projectId || 'freehold'}.md`
              document.body.appendChild(a); a.click(); a.remove()
              URL.revokeObjectURL(url)
              setToast("Campaign brief downloaded.")
            } catch { setToast("Could not export brief.") }
          }}>
            <Download size={15} aria-hidden="true" />
            Export Campaign Brief
          </button>
        </div>
      </section>

      <CampaignOutput output={output} source={source} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fh-field">
      <label>{label}</label>
      {children}
    </div>
  )
}
