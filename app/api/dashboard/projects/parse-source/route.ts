import { NextRequest, NextResponse } from "next/server"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { aiConfigured, geminiApiKey, geminiGenerate, geminiText } from "@/lib/gemini-rest"
import { requireSession } from "@/lib/freehold/api-auth"
import { buildProjectExtractionPrompt, extractJsonBlock } from "@/lib/freehold/project-extraction"

export const runtime = "nodejs"
export const maxDuration = 60

// "From a link" / "From text" project intake — the non-PDF half of the one
// Create flow. Takes JSON {url} or {text}, turns it into plain text, and feeds
// it through the SAME extraction prompt/pipeline as parse-brochure so every
// source lands in the same confirm-fields modal with the same field shape.

// The server fetches an arbitrary user-supplied URL, so the guards below are
// load-bearing: http/https only, no private/loopback/link-local targets, 5s
// timeout, and at most 2MB read.
const FETCH_TIMEOUT_MS = 5_000
const MAX_FETCH_BYTES = 2 * 1024 * 1024
const MAX_TEXT_CHARS = 12_000 // same slice the brochure prompt uses

/** True when an already-resolved IP literal is private/loopback/link-local. */
function isPrivateAddress(addr: string): boolean {
  const family = isIP(addr)
  if (family === 4) {
    const octets = addr.split(".").map(Number)
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
    const [a, b] = octets
    return (
      a === 0 || // "this network"
      a === 10 || // 10/8
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
      (a === 169 && b === 254) || // link-local
      (a === 172 && b >= 16 && b <= 31) || // 172.16/12
      (a === 192 && b === 168) // 192.168/16
    )
  }
  if (family === 6) {
    const v6 = addr.toLowerCase()
    // IPv4-mapped (::ffff:10.0.0.1) — judge the embedded IPv4.
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return (
      v6 === "::" ||
      v6 === "::1" || // loopback
      v6.startsWith("fc") || v6.startsWith("fd") || // fc00::/7 unique-local
      v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") // fe80::/10 link-local
    )
  }
  return true // not an IP literal — callers resolve first
}

/** Resolve the hostname and reject anything that lands on a private range. */
async function assertPublicHost(url: URL): Promise<string | null> {
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return "Private hosts are not allowed."
  if (isIP(host) && isPrivateAddress(host)) return "Private addresses are not allowed."
  if (!isIP(host)) {
    let addrs: Array<{ address: string }>
    try {
      addrs = await lookup(host, { all: true, verbatim: true })
    } catch {
      return "That host could not be resolved."
    }
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
      return "That host resolves to a private address."
    }
  }
  return null
}

/** Strip a fetched HTML page down to readable text for the extraction prompt. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/** Fetch the page body, honouring the timeout and the 2MB read ceiling. */
async function fetchPageText(url: URL): Promise<{ text?: string; error?: string; status?: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual", // a redirect could hop to a private target the guard never saw
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
    })
    if (res.status >= 300 && res.status < 400) {
      return { error: "That page redirects — paste the final URL instead.", status: 400 }
    }
    if (!res.ok) return { error: `Couldn't fetch that page (HTTP ${res.status}).`, status: 502 }
    // Stream at most 2MB — a huge body must not buffer into memory.
    const reader = res.body?.getReader()
    if (!reader) return { error: "That page returned no readable content.", status: 502 }
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > MAX_FETCH_BYTES) { await reader.cancel().catch(() => {}); break }
        chunks.push(value)
      }
    }
    const html = Buffer.concat(chunks).toString("utf8")
    return { text: htmlToText(html) }
  } catch {
    return { error: "Couldn't fetch that page within 5 seconds.", status: 502 }
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: NextRequest) {
  // Session-gated like parse-brochure: an unauthenticated caller must not burn
  // Gemini quota (or drive server-side fetches) on arbitrary input.
  const auth = await requireSession()
  if ("res" in auth) return auth.res
  try {
    if (!aiConfigured()) {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as { url?: unknown; text?: unknown } | null
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : ""
    const rawText = typeof body?.text === "string" ? body.text.trim() : ""
    if (!rawUrl && !rawText) {
      return NextResponse.json({ error: "Provide a `url` or `text` to extract from." }, { status: 400 })
    }

    let sourceText = rawText
    if (rawUrl) {
      let url: URL
      try {
        url = new URL(rawUrl)
      } catch {
        return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 })
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return NextResponse.json({ error: "Only http(s) links are supported." }, { status: 400 })
      }
      const hostError = await assertPublicHost(url)
      if (hostError) return NextResponse.json({ error: hostError }, { status: 400 })
      const page = await fetchPageText(url)
      if (page.error || !page.text) {
        return NextResponse.json({ error: page.error || "That page returned no readable content." }, { status: page.status || 502 })
      }
      sourceText = page.text
    }

    if (sourceText.length < 40) {
      return NextResponse.json({ error: "Not enough text to extract project details from." }, { status: 422 })
    }

    // SAME extraction contract as parse-brochure — one prompt, one field shape.
    const prompt = buildProjectExtractionPrompt(`Brochure text:\n${sourceText.slice(0, MAX_TEXT_CHARS)}`)

    let responseText = ""
    try {
      const resp = await geminiGenerate(geminiApiKey(), [{ role: "user", parts: [{ text: prompt }] }], { temperature: 0.1, maxOutputTokens: 2048 })
      responseText = geminiText(resp)
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 200) : "AI request failed"
      return NextResponse.json({ error: `Source AI extraction failed: ${detail}` }, { status: 502 })
    }

    if (!responseText) {
      return NextResponse.json({ error: "The AI returned no content for this source — try again with cleaner text." }, { status: 502 })
    }

    const extracted = extractJsonBlock(responseText)
    if (!extracted) {
      return NextResponse.json({ error: "Unable to parse AI response." }, { status: 500 })
    }

    return NextResponse.json({ data: extracted })
  } catch (error) {
    console.error("[v0] Source parse error:", error)
    return NextResponse.json({ error: "Failed to parse source." }, { status: 500 })
  }
}
