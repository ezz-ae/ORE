import { AmenitiesSection } from "@/components/lp/amenities-section"
import { AiConciergeSection } from "@/components/lp/ai-concierge-section"
import { BrochureDownloadSection } from "@/components/lp/brochure-download-section"
import { FaqSection } from "@/components/lp/faq-section"
import { KeyFactsSection } from "@/components/lp/key-facts-section"
import { LeadFormSection } from "@/components/lp/lead-form-section"
import { LocationSection } from "@/components/lp/location-section"
import { MarketIntelligenceSection } from "@/components/lp/market-intelligence-section"
import { PaymentPlanSection } from "@/components/lp/payment-plan-section"
import { RoiSection } from "@/components/lp/roi-section"
import { WhyDubaiSection } from "@/components/lp/why-dubai-section"
import type { CampaignPixelIds, LandingSection } from "@/lib/landing-pages"

interface SectionRendererProps {
  sections: LandingSection[]
  landingSlug: string
  projectSlug: string
  ctaText: string
  pixels: CampaignPixelIds
}

export function SectionRenderer({ sections, landingSlug, projectSlug, ctaText, pixels }: SectionRendererProps) {
  return (
    <>
      {sections.map((section, index) => {
        switch (section.type) {
          case "market-intelligence":
            return <MarketIntelligenceSection key={`${section.type}-${index}`} data={section.data} />
          case "key-facts":
            return <KeyFactsSection key={`${section.type}-${index}`} data={section.data} />
          case "payment-plan":
            return <PaymentPlanSection key={`${section.type}-${index}`} data={section.data} />
          case "roi":
            return <RoiSection key={`${section.type}-${index}`} data={section.data} />
          case "amenities":
            return <AmenitiesSection key={`${section.type}-${index}`} data={section.data} />
          case "location":
            return <LocationSection key={`${section.type}-${index}`} data={section.data} />
          case "ai-concierge":
            return (
              <AiConciergeSection
                key={`${section.type}-${index}`}
                data={section.data}
                landingSlug={landingSlug}
                projectSlug={projectSlug}
              />
            )
          case "faq":
            return <FaqSection key={`${section.type}-${index}`} data={section.data} />
          case "why-dubai":
            return <WhyDubaiSection key={`${section.type}-${index}`} data={section.data} />
          case "download-brochure":
            return (
              <BrochureDownloadSection
                key={`${section.type}-${index}`}
                data={section.data}
                landingSlug={landingSlug}
                projectSlug={projectSlug}
                pixels={pixels}
              />
            )
          case "lead-form":
            return (
              <LeadFormSection
                key={`${section.type}-${index}`}
                data={section.data}
                landingSlug={landingSlug}
                projectSlug={projectSlug}
                ctaText={ctaText}
                pixels={pixels}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}
