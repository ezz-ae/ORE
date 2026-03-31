const FALLBACK_SITE_URL = "https://ore-mu.vercel.app"

const ensureProtocol = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`

export const getSiteUrl = () => {
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.METADATA_BASE ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    FALLBACK_SITE_URL

  return ensureProtocol(rawSiteUrl).replace(/\/$/, "")
}

export const getMetadataBase = () => new URL(getSiteUrl())

export const BRAND_OG_IMAGE = "/og-image.png"
export const BRAND_AI_OG_IMAGE = "/ai-og.png"
