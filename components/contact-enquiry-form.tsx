"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const interestOptions = [
  { value: "buying", label: "Buying Property" },
  { value: "investment", label: "Investment Consultation" },
  { value: "golden-visa", label: "Golden Visa" },
  { value: "other", label: "Other Inquiry" },
]

export function ContactEnquiryForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "contact-page",
          interest: form.interest,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send enquiry.")
      }

      setSubmitted(true)
      setForm({
        name: "",
        email: "",
        phone: "",
        interest: "",
        message: "",
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send enquiry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-100">
        <p className="text-lg font-semibold">Your enquiry is in with our team.</p>
        <p className="mt-2 text-sm text-emerald-100/80">
          A property consultant will contact you soon. If you added your email, we also sent a confirmation there.
        </p>
      </div>
    )
  }

  return (
    <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="px-1 text-xs font-bold uppercase tracking-wider opacity-70">
            Full Name
          </Label>
          <Input
            id="contact-name"
            placeholder="John Smith"
            className="h-14 rounded-2xl border-0 bg-muted/30 focus-visible:ring-primary/50"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="px-1 text-xs font-bold uppercase tracking-wider opacity-70">
            Email Address
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="john@example.com"
            className="h-14 rounded-2xl border-0 bg-muted/30 focus-visible:ring-primary/50"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-phone" className="px-1 text-xs font-bold uppercase tracking-wider opacity-70">
            Phone Number
          </Label>
          <Input
            id="contact-phone"
            type="tel"
            placeholder="+97150000000"
            className="h-14 rounded-2xl border-0 bg-muted/30 focus-visible:ring-primary/50"
            value={form.phone}
            onChange={(event) => handleChange("phone", event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-interest" className="px-1 text-xs font-bold uppercase tracking-wider opacity-70">
            Investment Focus
          </Label>
          <select
            id="contact-interest"
            className="flex h-14 w-full rounded-2xl border-0 bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            value={form.interest}
            onChange={(event) => handleChange("interest", event.target.value)}
            required
          >
            <option value="">Select an option</option>
            {interestOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message" className="px-1 text-xs font-bold uppercase tracking-wider opacity-70">
          Your Message
        </Label>
        <Textarea
          id="contact-message"
          placeholder="Tell us about your requirements, budget, or preferred areas..."
          rows={5}
          className="resize-none rounded-2xl border-0 bg-muted/30 focus-visible:ring-primary/50"
          value={form.message}
          onChange={(event) => handleChange("message", event.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        size="lg"
        className="h-16 w-full rounded-2xl text-lg font-bold text-black shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] ore-gradient"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Secure My Consultation"}
      </Button>
    </form>
  )
}
