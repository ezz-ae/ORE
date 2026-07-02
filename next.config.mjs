import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors must fail the build (CI also runs `tsc --noEmit`). Previously
  // ignored, which let type regressions ship silently.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Baileys + its native deps (sharp, pino, thread-stream) must not be bundled
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'sharp',
    'pino',
    'pino-pretty',
    'thread-stream',
    'sonic-boom',
    'jimp',
    'keyv',
    '@cacheable/memory',
    '@cacheable/utils',
    'cacheable',
  ],
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      { source: '/management', destination: '/freehold-intelligence/management', permanent: true },
      { source: '/management/:path*', destination: '/freehold-intelligence/management/:path*', permanent: true },
    ]
  },

  // ── Security & cache headers ──────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: [
          // Force HTTPS for 1 year, include subdomains, allow preload list
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Prevent MIME-type sniffing (common source of mixed-content warnings)
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Block clickjacking
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Modern XSS protection
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer policy — send origin only on cross-origin requests
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions policy — disable unused browser APIs
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
        ],
      },
      {
        // Long-term cache for static assets (/_next/static/**)
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache public images / fonts for 7 days
        source: "/(images|fonts|icons)/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // favicon and manifest — cache for 1 day
        source: "/(favicon.ico|icon.png|manifest.json|robots.txt)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        // API routes — no public cache, allow CDN to revalidate
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ]
  },
}

export default nextConfig
