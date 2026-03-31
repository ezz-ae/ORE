"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const SendIcon = ({ className }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.171l2.665-15a.5.5 0 0 0-.687-.554L2.54 11.944a.5.5 0 0 0 .041.939l5.83 1.995a2 2 0 0 1 1.192 1.192z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
)

const CheckCircle2Icon = ({ className }: { className?: string }) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

interface LeadFormProps {
  projectName?: string
  source?: string
}

export function LeadForm({ projectName, source = "website" }: LeadFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    setLoading(false)
    setSubmitted(true)

    // Reset form after 3 seconds
    setTimeout(() => setSubmitted(false), 3000)
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <CheckCircle2Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-serif text-2xl font-semibold mb-2">Thank You!</h3>
        <p className="text-muted-foreground">
          Our team will contact you within 24 hours to discuss your investment.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="John"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="Doe"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="john@example.com"
          required
        />
      </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+971 55 330 8046"
            required
          />
        </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country *</Label>
        <Select name="country" required>
          <SelectTrigger>
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ae">United Arab Emirates</SelectItem>
            <SelectItem value="sa">Saudi Arabia</SelectItem>
            <SelectItem value="gb">United Kingdom</SelectItem>
            <SelectItem value="us">United States</SelectItem>
            <SelectItem value="in">India</SelectItem>
            <SelectItem value="pk">Pakistan</SelectItem>
            <SelectItem value="eg">Egypt</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget">Investment Budget</Label>
        <Select name="budget">
          <SelectTrigger>
            <SelectValue placeholder="Select your budget range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="500k-1m">AED 500K - 1M</SelectItem>
            <SelectItem value="1m-2m">AED 1M - 2M</SelectItem>
            <SelectItem value="2m-5m">AED 2M - 5M</SelectItem>
            <SelectItem value="5m+">AED 5M+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interest">Interest</Label>
        <Select name="interest">
          <SelectTrigger>
            <SelectValue placeholder="What are you interested in?" />
          </SelectTrigger>
          <SelectContent>
            {projectName && <SelectItem value={projectName}>{projectName}</SelectItem>}
            <SelectItem value="off-plan">Off-Plan Properties</SelectItem>
            <SelectItem value="secondary">Ready Properties</SelectItem>
            <SelectItem value="commercial">Commercial Properties</SelectItem>
            <SelectItem value="golden-visa">Golden Visa Eligible</SelectItem>
            <SelectItem value="consultation">General Consultation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message (Optional)</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Tell us about your investment goals..."
          rows={4}
        />
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox id="consent" name="consent" required />
        <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
          I agree to receive updates and marketing communications from ORE Real Estate. *
        </Label>
      </div>

      <input type="hidden" name="source" value={source} />
      {projectName && <input type="hidden" name="projectName" value={projectName} />}

      <Button
        type="submit"
        className="w-full ore-gradient"
        size="lg"
        disabled={loading}
      >
        {loading ? (
          <>Submitting...</>
        ) : (
          <> 
            <SendIcon className="mr-2 h-5 w-5" />
            Submit Inquiry
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By submitting this form, you agree to our terms and privacy policy.
      </p>
    </form>
  )
}
