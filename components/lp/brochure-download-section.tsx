"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LeadCaptureForm } from "@/components/lp/lead-capture-form"
import { SectionShell } from "@/components/lp/section-shell"
import type { CampaignPixelIds } from "@/lib/landing-pages"

interface BrochureDownloadSectionProps {
  data: Record<string, unknown>
  landingSlug: string
  projectSlug: string
  pixels: CampaignPixelIds
}

export function BrochureDownloadSection({
  data,
  landingSlug,
  projectSlug,
  pixels,
}: BrochureDownloadSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Download Brochure"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Get brochure PDF, payment-plan details, and current availability by submitting your enquiry."
  const buttonText = (typeof data.buttonText === "string" && data.buttonText) || "Unlock Brochure"

  return (
    <SectionShell id="download-brochure" title={title} subtitle={subtitle}>
      <Card className="border-primary/20 bg-gradient-to-br from-card to-muted/40">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="font-serif text-2xl font-semibold">Campaign Pack</p>
            <p className="text-sm text-muted-foreground">
              Includes unit mix, expected handover timeline, and consultant review call.
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="ore-gradient w-full md:w-auto">{buttonText}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Request Brochure Access</DialogTitle>
                <DialogDescription>
                  Submit your details and we will send the brochure and a curated shortlist.
                </DialogDescription>
              </DialogHeader>
              <LeadCaptureForm
                landingSlug={landingSlug}
                projectSlug={projectSlug}
                pixels={pixels}
                ctaText="Send Brochure"
                formId="brochure-lead-form"
                cardClassName="border-border shadow-none"
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </SectionShell>
  )
}
