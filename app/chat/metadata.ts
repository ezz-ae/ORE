import type { Metadata } from "next"
import { BRAND } from "@/lib/freehold/brand"
import { BRAND_AI_OG_IMAGE, getSiteUrl } from "@/lib/site"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    `Instant answers on Dubai real estate, curated projects, and market intelligence from the ${BRAND.company} AI assistant.`,
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    title: `AI Assistant | ${BRAND.company}`,
    description:
      `Ask ${BRAND.company} AI about Dubai market trends, Golden Visa projects, and curated property recommendations.`,
    url: `${siteUrl}/chat`,
    siteName: `${BRAND.company} Real Estate`,
    type: "website",
    images: [
      {
        url: BRAND_AI_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${BRAND.company} AI Assistant`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.company} AI Assistant`,
    description:
      `Talk to ${BRAND.company} AI for instant Dubai property intelligence and curated project shortlists.`,
    images: [BRAND_AI_OG_IMAGE],
  },
}
