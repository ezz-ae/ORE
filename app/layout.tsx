import type React from "react"
import type { Metadata } from "next"
// [ORE] Vault Refinement Cache Breaker: 2026-03-31 08:50:00
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { BRAND_OG_IMAGE, getMetadataBase, getSiteUrl } from "@/lib/site"
import "./globals.css"

export const dynamic = "force-dynamic"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  preload: false,
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono",
  preload: false,
})

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: "--font-serif",
  preload: false,
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "ORE Real Estate",
    template: "%s | ORE Real Estate",
  },
  applicationName: "ORE Real Estate",
  description:
    "Your Gateway to Your Dream Home. Discover 3,500+ premium Dubai properties, off-plan launches, and elite investment guidance with ORE Real Estate.",
  generator: "ORE Real Estate Engine",
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "ORE Real Estate", url: siteUrl }],
  creator: "ORE Real Estate",
  publisher: "ORE Real Estate",
  category: "Real Estate",
  keywords: [
    "Dubai real estate",
    "Dubai properties",
    "Dubai investment",
    "off-plan Dubai",
    "Golden Visa",
    "Dubai Marina",
    "Downtown Dubai",
    "Dubai market intelligence",
    "ORE real estate",
    "investment advisors",
  ],
  openGraph: {
    title: "ORE Real Estate | Dubai Property Intelligence",
    description:
      "ORE delivers curated Dubai projects, off-plan intelligence, and broker-grade AI insight for international investors.",
    url: siteUrl,
    siteName: "ORE Real Estate",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "ORE Real Estate Dubai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ORE Real Estate",
    description:
      "Dubai investment intelligence with 3,500+ verified projects, AI chat, and CRM-grade leads.",
    images: [BRAND_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "ORE Real Estate",
    "image": `${siteUrl}/ore-logo-gold.png`,
    "logo": `${siteUrl}/ore-logo-gold.png`,
    "@id": siteUrl,
    "url": siteUrl,
    "telephone": "+971 4 580 8244",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Office 38 floor, Building The One Tower, Dubai Media City, Sheikh Zayed Road",
      "addressLocality": "Dubai",
      "addressRegion": "Dubai",
      "addressCountry": "AE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 25.1012,
      "longitude": 55.1852
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      "opens": "09:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.facebook.com/Orerealestate/",
      "https://www.instagram.com/ore.realestate/",
      "https://www.linkedin.com/company/ore-real-estate-l-l-c/"
    ]
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} ${geistMono.variable} bg-background font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
          disableTransitionOnChange={false}
        >
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 overflow-x-clip">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
