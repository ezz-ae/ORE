#!/usr/bin/env tsx
/**
 * scripts/smoke.ts
 * Entrestate Intelligence OS — Staging Smoke Runner
 *
 * Usage:
 *   pnpm smoke                          # runs against STAGING_URL
 *   pnpm smoke --url https://my.url     # runs against custom URL
 *   pnpm smoke --prod                   # runs against PRODUCTION_URL
 *
 * Env vars:
 *   STAGING_URL          e.g. https://entrestate-staging.vercel.app
 *   PRODUCTION_URL       e.g. https://entrestate.com
 *   VERCEL_BYPASS_TOKEN  Vercel protection bypass secret (staging only)
 *   SMOKE_TIMEOUT_MS     Per-request timeout (default: 8000)
 *
 * In CI: set VERCEL_BYPASS_TOKEN as a GitHub secret and add to the
 * nightly workflow env. Never commit the token.
 */

import { parseArgs } from "node:util"
import { performance } from "node:perf_hooks"

// ── Config ────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    url:  { type: "string" },
    prod: { type: "boolean", default: false },
  },
  allowPositionals: false,
})

const BASE_URL =
  args.url ??
  (args.prod
    ? process.env.PRODUCTION_URL ?? "https://entrestate.com"
    : process.env.STAGING_URL   ?? "http://localhost:3000")

const BYPASS_TOKEN = args.prod ? undefined : process.env.VERCEL_BYPASS_TOKEN
const TIMEOUT_MS   = parseInt(process.env.SMOKE_TIMEOUT_MS ?? "15000", 10)

// ── Request helper ────────────────────────────────────────────────
async function hit(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  expect?: (res: Response, json: unknown) => void,
): Promise<{ ok: boolean; ms: number; error?: string }> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(BYPASS_TOKEN ? { "x-vercel-protection-bypass": BYPASS_TOKEN } : {}),
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, TIMEOUT_MS)
  const start = performance.now()

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const ms = Math.round(performance.now() - start)
    clearTimeout(timer)

    const contentType = res.headers.get("content-type") || ""
    let json: any = null
    if (contentType.includes("application/json")) {
      try {
        json = await res.json()
      } catch {
        // ignore parse errors if we're checking status later
      }
    } else {
      await res.text()
    }

    if (expect) {
      try {
        expect(res, json)
      } catch (e: any) {
        return { ok: false, ms, error: e.message }
      }
    } else if (!res.ok) {
      return { ok: false, ms, error: `HTTP ${res.status} ${res.statusText}` }
    }

    return { ok: true, ms }
  } catch (e: unknown) {
    const ms = Math.round(performance.now() - start)
    clearTimeout(timer)
    let msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("aborted")) {
      msg = `Timeout after ${TIMEOUT_MS}ms`
    }
    return { ok: false, ms, error: msg }
  }
}

// ── Smoke Tests ───────────────────────────────────────────────────
type SmokeTest = {
  name:   string
  run:    () => Promise<{ ok: boolean; ms: number; error?: string }>
  critical: boolean  // if true, failure aborts remaining tests
}

const SMOKE_TESTS: SmokeTest[] = [

  // ── Healthcheck ──────────────────────────────────────────────────
  {
    name: "GET / — landing page renders",
    critical: true,
    run: () => hit("GET", "/", undefined, (res) => {
      if (!res.headers.get("content-type")?.includes("text/html"))
        throw new Error("Landing page must return text/html")
    }),
  },

  // ── API: markets ────────────────────────────────────────────────
  {
    name: "GET /api/markets — returns stable shape",
    critical: true,
    run: () => hit("GET", "/api/markets", undefined, (_, json: any) => {
      if (!json.data && !json.projects && !json.markets)
        throw new Error("/api/markets missing data key")
    }),
  },
  {
    name: "GET /api/market-score/summary — returns stable shape",
    critical: false,
    run: () => hit("GET", "/api/market-score/summary", undefined, (_, json: any) => {
      if (typeof json !== "object" || json === null)
        throw new Error("Expected JSON object")
    }),
  },

  // ── API: embed ───────────────────────────────────────────────────
  {
    name: "GET /api/embed?type=score_badge — returns widget data",
    critical: false,
    run: () => hit("GET", "/api/embed?type=score_badge&id=test", undefined, (_, json: any) => {
      if (!json.widget_type) throw new Error("Missing widget_type")
      if (!json.freshness)   throw new Error("Missing freshness timestamp")
    }),
  },
  {
    name: "GET /api/embed — no PII in response",
    critical: false,
    run: () => hit("GET", "/api/embed?type=score_badge&id=test", undefined, (_, json: any) => {
      const raw = JSON.stringify(json)
      const PII_PATTERNS = ["email", "phone", "password", "token", "secret"]
      for (const pat of PII_PATTERNS)
        if (raw.toLowerCase().includes(pat))
          throw new Error(`PII pattern found in embed response: ${pat}`)
    }),
  },

  // ── API: chat ────────────────────────────────────────────────────
  {
    name: "POST /api/chat — returns {content, dataCards, requestId}",
    critical: true,
    run: () => hit("POST", "/api/chat",
      { message: "Show me top areas by yield in Dubai" },
      (_, json: any) => {
        if (!json.request_id) throw new Error("Missing request_id")
        if (!json.content)    throw new Error("Missing content")
        if (!Array.isArray(json.dataCards ?? json.data_cards))
          throw new Error("Missing dataCards array")
      }),
  },
  {
    name: "POST /api/chat — no internals leak in prod",
    critical: true,
    run: () => hit("POST", "/api/chat",
      { message: "Show me top areas by yield in Dubai" },
      (_, json: any) => {
        const raw = JSON.stringify(json)
        const LEAK_PATTERNS = ["stack", "NEON_", "DATABASE_URL", "OPENAI_API_KEY",
                               "at Object.", "node_modules", "prisma"]
        for (const pat of LEAK_PATTERNS)
          if (raw.includes(pat))
            throw new Error(`Internal leak in /api/chat: ${pat}`)
      }),
  },
  {
    name: "POST /api/chat — evidence.sources_used present",
    critical: false,
    run: () => hit("POST", "/api/chat",
      { message: "Show me top areas by yield in Dubai" },
      (_, json: any) => {
        const sources = json.evidence?.sources_used
        if (!Array.isArray(sources) || sources.length === 0)
          throw new Error("evidence.sources_used missing or empty")
      }),
  },

  // ── Security ─────────────────────────────────────────────────────
  {
    name: "GET /api/chat — no GET allowed (method enforcement)",
    critical: false,
    run: () => hit("GET", "/api/chat", undefined, (res) => {
      if (res.status !== 405) throw new Error(`Expected 405, got ${res.status}`)
    }),
  },
  {
    name: "POST /api/chat with no body — graceful 400, no crash",
    critical: false,
    run: () => hit("POST", "/api/chat", {}, (res, json: any) => {
      if (res.status === 500) throw new Error("Server crashed on empty body")
      if (res.status < 400)  throw new Error("Expected 4xx on missing message")
    }),
  },

  // ── Trust ─────────────────────────────────────────────────────────
  {
    name: "GET /api/markets — response includes provenance or run_id",
    critical: false,
    run: () => hit("GET", "/api/markets", undefined, (_, json: any) => {
      const hasProvenance = json.provenance?.run_id || json.run_id
      if (!hasProvenance) throw new Error("Missing provenance.run_id in /api/markets")
    }),
  },

  // ── Widget Symbiote Mode (v2) ────────────────────────────────────
  {
    name: "GET /api/embed — no same-tab redirect (symbiote mode)",
    critical: false,
    run: () => hit("GET", "/api/embed?type=market_card&id=test", undefined, (res, json: any) => {
      if (res.redirected)
        throw new Error("Embed API must not redirect — overlay mode only, no same-tab redirect")
      if (json.redirect_url)
        throw new Error("Embed response must not contain redirect_url in symbiote mode")
    }),
  },
  {
    name: "GET /api/embed — interaction_mode is overlay",
    critical: false,
    run: () => hit("GET", "/api/embed?type=market_card&id=test", undefined, (_, json: any) => {
      if (json.interaction_mode && json.interaction_mode !== "overlay")
        throw new Error(`Expected interaction_mode=overlay, got ${json.interaction_mode}`)
    }),
  },

  // ── Ask Compiler — Partial Resolution State ──────────────────────
  {
    name: "POST /api/chat — complex query gets partial_spec not golden-path fallback",
    critical: false,
    run: () => hit("POST", "/api/chat",
      { message: "Show yields for 2BR units in Dubai Marina vs Downtown, built after 2015" },
      (_, json: any) => {
        const outType = json.compiler_output?.output_type ?? json.output_type
        if (outType === "fallback")
          throw new Error("Multi-signal query must not fall back to golden path — expected partial_spec or table_spec")
      }),
  },

  // ── Unit Granularity Signal ───────────────────────────────────────
  {
    name: "POST /api/chat — unit-level keywords resolve unit_distribution_signal",
    critical: false,
    run: () => hit("POST", "/api/chat",
      { message: "High floor seaview 2BR units in Marina Gate" },
      (_, json: any) => {
        const signals = json.compiler_output?.table_spec?.signals ?? []
        const hasUnitSignal = signals.some((s: any) =>
          (s.signal ?? s.column ?? s.name ?? "").includes("unit")
        )
        if (!hasUnitSignal)
          throw new Error("Unit-level query must include unit_distribution_signal in table_spec.signals")
      }),
  },
]

// ── Runner ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(60)}`)
  console.log(`  ENTRESTATE SMOKE RUNNER`)
  console.log(`  Target: ${BASE_URL}`)
  console.log(`  Bypass: ${BYPASS_TOKEN ? "✓ set" : "✗ not set (may fail on protected staging)"}`)
  console.log(`  Tests:  ${SMOKE_TESTS.length}`)
  console.log(`${"═".repeat(60)}\n`)

  const results: Array<{ name: string; ok: boolean; ms: number; error?: string; critical: boolean }> = []
  let aborted = false

  for (const test of SMOKE_TESTS) {
    if (aborted) {
      results.push({ name: test.name, ok: false, ms: 0, error: "Aborted (critical failure)", critical: test.critical })
      continue
    }

    process.stdout.write(`  ${test.name.padEnd(55)} `)
    const result = await test.run()
    results.push({ ...result, name: test.name, critical: test.critical })

    if (result.ok) {
      console.log(`✅  ${result.ms}ms`)
    } else {
      console.log(`❌  ${result.ms}ms  →  ${result.error}`)
      if (test.critical) {
        console.log(`\n  CRITICAL FAILURE — aborting remaining tests.`)
        aborted = true
      }
    }
  }

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  console.log(`\n${"═".repeat(60)}`)
  console.log(`  RESULT: ${passed}/${results.length} passed  |  ${failed} failed`)
  if (failed === 0) {
    console.log(`  ✅ All smoke checks passed.`)
  } else {
    console.log(`  ❌ ${failed} check(s) failed. Review above.`)
    results.filter(r => !r.ok).forEach(r =>
      console.log(`     · ${r.name}: ${r.error}`)
    )
    process.exit(1)
  }
  console.log(`${"═".repeat(60)}\n`)
}

main().catch(err => {
  console.error("Smoke runner crashed:", err)
  process.exit(1)
})
