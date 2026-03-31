import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Assistant | ORE Real Estate",
  description:
    "Instant answers on Dubai real estate, curated projects, and market intelligence from the ORE AI assistant.",
  openGraph: {
    title: "AI Assistant | ORE",
    description:
      "Ask the AI assistant about Dubai market trends, Golden Visa projects, and curated property recommendations.",
    url: "https://orerealestate.ae/chat",
    siteName: "ORE Real Estate",
    type: "website",
    images: [
      {
        url: "https://orerealestate.ae/ai-og.png",
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
      "Talk to the AI assistant for instant Dubai property intelligence and curated project shortlists.",
    images: ["https://orerealestate.ae/ai-og.png"],
  },
}
