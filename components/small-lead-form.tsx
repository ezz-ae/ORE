"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SmallLeadFormProps {
  source?: string
  className?: string
  title?: string
  caption?: string
}

export function SmallLeadForm({
  source,
  className,
  title = "Share your brief",
  caption = "Tell us your areas of interest and we will follow up with curated options in Dubai.",
}: SmallLeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setLoading(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2500)
  }

  if (submitted) {
    return (
      <div className={className}>
        <p className="text-sm font-semibold text-foreground">Thanks for sharing!</p>
        <p className="text-xs text-muted-foreground">
          A broker will reach out shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-3">
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{caption}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="compact-name" className="text-xs uppercase tracking-wide text-muted-foreground">
              Full name
            </Label>
            <Input id="compact-name" name="name" placeholder="John Doe" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compact-phone" className="text-xs uppercase tracking-wide text-muted-foreground">
              Phone (or WhatsApp)
            </Label>
            <Input id="compact-phone" name="phone" placeholder="+971 50 ..." required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compact-email" className="text-xs uppercase tracking-wide text-muted-foreground">
            Email
          </Label>
          <Input id="compact-email" name="email" type="email" placeholder="john@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compact-message" className="text-xs uppercase tracking-wide text-muted-foreground">
            What can we help with?
          </Label>
          <Textarea id="compact-message" name="message" rows={3} placeholder="Budget, area, timeframe..." />
        </div>
        <input type="hidden" name="source" value={source || "inline"} />
        <Button type="submit" className="w-full ore-gradient" size="lg" disabled={loading}>
          {loading ? "Sending..." : "Send Inquiry"}
        </Button>
      </div>
    </form>
  )
}
