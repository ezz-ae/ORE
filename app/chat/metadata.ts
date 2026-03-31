import type { Metadata } from "next"
import { BRAND_AI_OG_IMAGE, getSiteUrl } from "@/lib/site"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Instant answers on Dubai real estate, curated projects, and market intelligence from the ORE AI assistant.",
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    title: "AI Assistant | ORE",
    description:
      "Ask ORE AI about Dubai market trends, Golden Visa projects, and curated property recommendations.",
    url: `${siteUrl}/chat`,
    siteName: "ORE Real Estate",
    type: "website",
    images: [
      {
        url: BRAND_AI_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "ORE AI Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ORE AI Assistant",
    description:
      "Talk to ORE AI for instant Dubai property intelligence and curated project shortlists.",
    images: [BRAND_AI_OG_IMAGE],
  },
}
