"use client"

import { useState } from "react"

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)

const INTEREST_LABELS: Record<string, string> = {
  buy: "Buying a property",
  sell: "Selling my property",
  rent: "Renting",
  invest: "Investment advisory",
  "golden-visa": "Golden Visa eligibility",
}

export function HomeCallbackForm() {
  const [form, setForm] = useState({ name: "", phone: "", interest: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          interest: form.interest ? INTEREST_LABELS[form.interest] ?? form.interest : "",
          source: "home-callback",
          message: form.interest
            ? `Callback request — interested in: ${INTEREST_LABELS[form.interest] ?? form.interest}`
            : "Callback request from homepage",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "Unable to send your request.")
      setSubmitted(true)
      setForm({ name: "", phone: "", interest: "" })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send your request.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-[#C69B3E]/25 bg-[#C69B3E]/[0.08] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#C69B3E]/30 bg-[#C69B3E]/15">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4AC50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="text-lg font-bold text-white">Request received.</p>
        <p className="mt-2 text-sm text-white/45">
          A Freehold private advisor will reach out to you shortly. Your details are now with our team.
        </p>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Full Name
        </label>
        <input
          type="text"
          name="name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="John Doe"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3.5 text-sm text-white placeholder:text-white/20 transition focus:border-[#C69B3E]/40 focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
          WhatsApp or Phone
        </label>
        <input
          type="tel"
          name="phone"
          required
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+971 50 417 3622"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3.5 text-sm text-white placeholder:text-white/20 transition focus:border-[#C69B3E]/40 focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
          I&apos;m interested in
        </label>
        <select
          name="interest"
          value={form.interest}
          onChange={(e) => set("interest", e.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3.5 text-sm text-white/70 transition focus:border-[#C69B3E]/40 focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20"
        >
          <option value="" className="bg-[#152E24]">Select interest…</option>
          <option value="buy" className="bg-[#152E24]">Buying a property</option>
          <option value="sell" className="bg-[#152E24]">Selling my property</option>
          <option value="rent" className="bg-[#152E24]">Renting</option>
          <option value="invest" className="bg-[#152E24]">Investment advisory</option>
          <option value="golden-visa" className="bg-[#152E24]">Golden Visa eligibility</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="freehold-gradient mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] shadow-lg transition hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Request Consultation"}
        {!submitting && <ArrowRightIcon />}
      </button>
    </form>
  )
}
