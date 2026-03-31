import { SectionShell } from "@/components/lp/section-shell"
import { LeadCaptureForm } from "@/components/lp/lead-capture-form"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { CampaignPixelIds } from "@/lib/landing-pages"

interface LeadFormSectionProps {
  data: Record<string, unknown>
  landingSlug: string
  projectSlug: string
  ctaText: string
  pixels: CampaignPixelIds
}

export function LeadFormSection({ data, landingSlug, projectSlug, ctaText, pixels }: LeadFormSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Request Brochure & Availability"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Submit your details and we will contact you with campaign-specific pricing and inventory."
  const chatQuery = encodeURIComponent(`Walk me through ${projectSlug}, ROI, and best buyer profile.`)

  return (
    <SectionShell id="lead-form-section" title={title} subtitle={subtitle} className="bg-muted/20">
      <div className="mx-auto max-w-3xl space-y-4">
        <LeadCaptureForm landingSlug={landingSlug} projectSlug={projectSlug} ctaText={ctaText} pixels={pixels} />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/chat?q=${chatQuery}&source=lp&landing=${landingSlug}&project=${projectSlug}`}>
              Prefer AI first? Open the assistant
            </Link>
          </Button>
        </div>
      </div>
    </SectionShell>
  )
}
