"use client"

import { useState } from "react"
import { BookMarked, Save, Search } from "lucide-react"
import { notes } from "@/src/data/notes"
import type { AIJsonResponse, AISource, NotebookAnswerOutput } from "@/src/lib/ai/schemas"
import { buildNotebookFallback } from "@/src/lib/ai/fallbacks"
import { AISourceBadge } from "@/src/components/ai/AISourceBadge"
import { StatusBadge } from "@/src/components/command/StatusBadge"

const categories = ["Areas", "Developers", "Campaign Angles", "Buyer Objections", "Payment Plans", "Owner Sessions", "Sales Scripts", "Meta Ads", "Google Ads"]

export function NotebookClient({ projectId }: { projectId?: string }) {
  const [question, setQuestion] = useState("Which project angle should Freehold push for mid-budget buyers this week?")
  const [category, setCategory] = useState("Campaign Angles")
  const [source, setSource] = useState<AISource>("Local engine")
  const [answer, setAnswer] = useState<NotebookAnswerOutput>(() => buildNotebookFallback({ question, category, projectId }))
  const [toast, setToast] = useState("")
  const [loading, setLoading] = useState(false)

  async function askNotebook() {
    setLoading(true)
    setToast("")
    try {
      const response = await fetch("/api/ai/ask-notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category, projectId }),
      })
      const payload = (await response.json()) as AIJsonResponse<NotebookAnswerOutput>
      setAnswer(payload.data)
      setSource(payload.source)
    } catch {
      setAnswer(buildNotebookFallback({ question, category, projectId }))
      setSource("Local engine")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fh-page">
      <section>
        <p className="fh-eyebrow">Freehold Market Notebook</p>
        <h1 className="fh-title">Company memory for market signals, campaign angles, objections, and sales scripts.</h1>
        <p className="fh-copy">This is not a blog or document list. It is the thinking layer that makes every lead and campaign improve the company.</p>
      </section>

      {toast ? <div className="fh-toast">{toast}</div> : null}

      <div className="fh-split">
        <section className="fh-panel fh-panel-pad">
          <div className="fh-form-grid">
            <div className="fh-field">
              <label>Ask Notebook</label>
              <input className="fh-input" value={question} onChange={(event) => setQuestion(event.target.value)} />
            </div>
            <div className="fh-field">
              <label>Category</label>
              <select className="fh-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="fh-field">
              <label>Action</label>
              <button className="fh-btn primary" onClick={askNotebook} disabled={loading}>
                <Search size={15} aria-hidden="true" />
                Ask Notebook
              </button>
            </div>
          </div>

          <div className="fh-panel mt-4">
            <div className="fh-panel-header">
              <div>
                <h2 className="fh-panel-title">Notebook Answer</h2>
                <p className="fh-panel-copy">Reasoning tied to market data, CRM, and ads.</p>
              </div>
              <AISourceBadge source={source} />
            </div>
            <div className="fh-output-grid p-[18px]">
              <Output title="Answer">{answer.answer}</Output>
              <Output title="Market reasoning">{answer.marketReasoning}</Output>
              <Output title="Recommended action">{answer.recommendedAction}</Output>
              <Output title="Risk notes">{answer.riskNotes.join(" ")}</Output>
            </div>
            <div className="fh-panel-header">
              <button className="fh-btn" onClick={() => setToast("Notebook answer saved for the current workspace session.")}>
                <Save size={15} aria-hidden="true" />
                Save answer
              </button>
            </div>
          </div>
        </section>

        <aside className="fh-panel fh-panel-pad">
          <h2 className="fh-panel-title">Saved Memory</h2>
          <div className="mt-4 grid gap-3">
            {notes.map((note) => (
              <article className="fh-card" key={note.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-sm font-bold">{note.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#aab8ad]">{note.summary}</p>
                  </div>
                  <StatusBadge tone={note.priority === "High" ? "green" : "gold"}>{note.category}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <StatusBadge tone="blue">
              <BookMarked size={13} aria-hidden="true" />
              {answer.relatedProjects.length} related projects
            </StatusBadge>
          </div>
        </aside>
      </div>
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
