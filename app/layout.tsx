import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono, Playfair_Display, Cairo } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { WhatsAppFloat } from "@/components/whatsapp-float"
import { BRAND_OG_IMAGE, getMetadataBase, getSiteUrl } from "@/lib/site"
import { BRAND } from "@/lib/freehold/brand"
import { BrandProvider } from "@/components/whitelabel/brand-provider"
import { getWorkspaceBrand } from "@/lib/whitelabel/server"
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

// Cairo — the ad engine's Arabic face. Canvas text falls back to whatever
// Arabic font happens to be installed on the machine doing the rendering,
// which makes an exported ad look different for every agent. Loading a real
// webfont and composing only after it is ready makes the pixels deterministic.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-ad-ar",
  preload: false,
})

const siteUrl = getSiteUrl()

// Public-facing brand name (env-driven via NEXT_PUBLIC_BRAND_*; see
// lib/freehold/brand.ts). Defaults to "Freehold Property UAE".
const publicName = `${BRAND.legalName} UAE`

// Phone/webapp behaviour: edge-to-edge with safe-area support (viewportFit)
// and a browser-chrome colour that matches the app instead of default white.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops iOS Safari's automatic zoom-in when focusing sub-16px inputs (the
  // page then STAYS zoomed, clipping fixed overlays like the Apps sheet).
  // Safari still honors user-initiated pinch zoom despite this cap.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1628",
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: publicName,
    template: `%s | ${publicName}`,
  },
  applicationName: publicName,
  description:
    `${publicName} real estate advisory for sales, leasing, project marketing, investments, consultancy, valuations, and market intelligence.`,
  generator: publicName,
  authors: [{ name: publicName, url: siteUrl }],
  creator: publicName,
  publisher: publicName,
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
    publicName,
    "investment advisors",
  ],
  openGraph: {
    title: publicName,
    description:
      "Dubai real estate advisory for buying, selling, renting, project marketing, investments, and market intelligence.",
    url: siteUrl,
    siteName: publicName,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${publicName} — Dubai Real Estate Advisory`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: publicName,
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
  // Installed-to-home-screen behaviour: full-screen, app-like, no browser chrome.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.company,
  },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // White-label: paint the current workspace's brand (null in the Freehold product).
  const wlBrand = await getWorkspaceBrand()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": publicName,
    "image": `${siteUrl}${BRAND_OG_IMAGE}`,
    "logo": `${siteUrl}/icon.png`,
    "@id": siteUrl,
    "url": siteUrl,
    "telephone": BRAND.phone,
    "address": {
      "@type": "PostalAddress",
      // Env-overridable office address; the default is the Freehold office.
      "streetAddress": process.env.NEXT_PUBLIC_BRAND_ADDRESS?.trim() || "Sobha Sapphire Building, Office 904, Business Bay, Dubai",
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
      siteUrl
    ]
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the persisted Freehold light/dark mode before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('fh-theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${geistMono.variable} ${cairo.variable} bg-background font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* White-label: override the gold accent token for the whole tree. */}
        {wlBrand ? (
          <style dangerouslySetInnerHTML={{ __html: `:root{--color-gold:${wlBrand.accent};}` }} />
        ) : null}
        <BrandProvider brand={wlBrand}>
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
        </BrandProvider>
        <Analytics />
      </body>
    </html>
  )
}
