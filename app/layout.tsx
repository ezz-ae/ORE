import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { WhatsAppFloat } from "@/components/whatsapp-float"
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
    default: "Freehold Property UAE",
    template: "%s | Freehold Property UAE",
  },
  applicationName: "Freehold Intelligence Command Center",
  description:
    "Freehold Property UAE real estate advisory for sales, leasing, project marketing, investments, consultancy, valuations, and market intelligence.",
  generator: "Freehold Property UAE",
  authors: [{ name: "Freehold Property UAE", url: siteUrl }],
  creator: "Freehold Property UAE",
  publisher: "Freehold Property UAE",
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
    "Freehold Property UAE",
    "investment advisors",
  ],
  openGraph: {
    title: "Freehold Property UAE",
    description:
      "Dubai real estate advisory for buying, selling, renting, project marketing, investments, and market intelligence.",
    url: siteUrl,
    siteName: "Freehold Property UAE",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Freehold Intelligence Command Center",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Freehold Property UAE",
    description:
      "Dubai real estate advisory backed by practical market intelligence.",
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
    "name": "Freehold Property UAE",
    "image": `${siteUrl}${BRAND_OG_IMAGE}`,
    "logo": `${siteUrl}/icon.png`,
    "@id": siteUrl,
    "url": siteUrl,
    "telephone": "+971 50 417 3622",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Sobha Sapphire Building, Office 904, Business Bay, Dubai",
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
      "https://www.freeholdproperty.ae"
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
            <WhatsAppFloat />
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
