#!/usr/bin/env tsx
/**
 * scripts/tenancy-smoke.ts
 * SaaS tenancy — two-tenant isolation smoke.
 *
 * Provisions two throwaway trial tenants through the REAL public signup flow
 * and asserts the isolation properties that must never regress:
 *   • each tenant's roster/leads are invisible to the other;
 *   • a session minted on tenant A is rejected on tenant B's host (and on
 *     the apex) — the proxy fence, both directions;
 *   • a claimed subdomain reports as taken, reserved names as reserved.
 *
 * Usage:
 *   pnpm smoke:tenancy --url https://entrestate.com
 *   pnpm smoke:tenancy --url http://localhost:3000        # needs a DB + env
 *
 * The target deployment must have NEXT_PUBLIC_TENANT_BASE_DOMAIN set and
 * signup enabled. Tenants are named smk<random>a / smk<random>b — clean them
 * up afterwards with SQL if you care:
 *   DELETE FROM saas_tenants WHERE subdomain LIKE 'smk%';
 *   DROP SCHEMA IF EXISTS t_smk... CASCADE;  -- one per tenant
 */

import { parseArgs } from "node:util"

const { values: args } = parseArgs({
  options: { url: { type: "string" } },
  allowPositionals: false,
})

const BASE = (args.url || process.env.TENANCY_SMOKE_URL || "").replace(/\/+$/, "")
if (!BASE) {
  console.error("Usage: pnpm smoke:tenancy --url https://<apex-of-saas-deployment>")
  process.exit(2)
}

const apex = new URL(BASE)
const tenantOrigin = (sub: string) => `${apex.protocol}//${sub}.${apex.host}`

let failures = 0
const pass = (msg: string) => console.log(`✓ ${msg}`)
const fail = (msg: string) => { failures++; console.error(`✗ ${msg}`) }
const expect = (cond: boolean, msg: string) => (cond ? pass(msg) : fail(msg))

const runId = `smk${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = `Smoke-${runId}-pass1`

interface Tenant {
  sub: string
  origin: string
  email: string
  cookie: string
}

async function signupTenant(suffix: "a" | "b"): Promise<Tenant | null> {
  const sub = `${runId}${suffix}`
  const email = `owner-${suffix}@${runId}.example.com`
  const res = await fetch(`${BASE}/api/wl/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company: `Smoke ${suffix.toUpperCase()}`,
      subdomain: sub,
      adminName: `Owner ${suffix.toUpperCase()}`,
      adminEmail: email,
      password: PASSWORD,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string }
  if (!res.ok || !data.ok || !data.redirect) {
    fail(`signup ${sub}: HTTP ${res.status} ${data.error ?? ""}`)
    return null
  }
  pass(`signup ${sub}: tenant provisioned`)

  // Claim on the tenant host — capture the session cookie, don't follow on.
  const claim = await fetch(data.redirect, { redirect: "manual" })
  const setCookie = claim.headers.get("set-cookie") || ""
  const m = /fh_session=([^;]+)/.exec(setCookie)
  if (claim.status < 300 || claim.status >= 400 || !m) {
    fail(`claim ${sub}: expected redirect+cookie, got HTTP ${claim.status}`)
    return null
  }
  pass(`claim ${sub}: session cookie minted on the tenant host`)
  return { sub, origin: tenantOrigin(sub), email, cookie: `fh_session=${m[1]}` }
}

async function textOf(url: string, cookie?: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual" })
  return { status: res.status, text: await res.text().catch(() => "") }
}

async function main() {
  console.log(`Tenancy isolation smoke → ${BASE} (run ${runId})\n`)

  const a = await signupTenant("a")
  const b = await signupTenant("b")
  if (!a || !b) {
    console.error("\nProvisioning failed — aborting the isolation checks.")
    process.exit(1)
  }

  // ── Roster isolation (public endpoint, host-scoped by schema) ──────────────
  const rosterA = await textOf(`${a.origin}/api/auth/roster`)
  const rosterB = await textOf(`${b.origin}/api/auth/roster`)
  expect(rosterA.text.includes(a.email), "roster A lists A's owner")
  expect(!rosterA.text.includes(b.email), "roster A does NOT list B's owner")
  expect(rosterB.text.includes(b.email), "roster B lists B's owner")
  expect(!rosterB.text.includes(a.email), "roster B does NOT list A's owner")

  // ── Lead data isolation (real write into A, read from both) ────────────────
  const leadEmail = `lead-${runId}@isolation.example.com`
  const leadRes = await fetch(`${a.origin}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Lead ${runId}`, phone: "+971500000000", email: leadEmail, source: "tenancy-smoke" }),
  })
  expect(leadRes.ok, `lead capture into A (HTTP ${leadRes.status})`)

  const leadsA = await textOf(`${a.origin}/api/freehold/crm/leads`, a.cookie)
  const leadsB = await textOf(`${b.origin}/api/freehold/crm/leads`, b.cookie)
  expect(leadsA.status === 200 && leadsA.text.includes(leadEmail), "A's CRM shows the lead")
  expect(leadsB.status === 200 && !leadsB.text.includes(leadEmail), "B's CRM does NOT show the lead")

  // ── Session fencing (the proxy, both directions) ───────────────────────────
  const aOnB = await textOf(`${b.origin}/api/freehold/crm/leads`, a.cookie)
  const bOnA = await textOf(`${a.origin}/api/freehold/crm/leads`, b.cookie)
  const aOnApex = await textOf(`${BASE}/api/freehold/crm/leads`, a.cookie)
  expect(aOnB.status === 401, `A's session rejected on B's host (HTTP ${aOnB.status})`)
  expect(bOnA.status === 401, `B's session rejected on A's host (HTTP ${bOnA.status})`)
  expect(aOnApex.status === 401, `A's session rejected on the apex (HTTP ${aOnApex.status})`)

  // ── Subdomain rules stay live after provisioning ───────────────────────────
  const taken = await textOf(`${BASE}/api/wl/subdomain-check?sub=${a.sub}`)
  const reserved = await textOf(`${BASE}/api/wl/subdomain-check?sub=admin`)
  expect(taken.text.includes('"available":false'), `subdomain ${a.sub} now reports taken`)
  expect(reserved.text.includes('"reason":"reserved"'), "reserved name reports reserved")

  console.log(failures === 0
    ? `\n✅ tenancy smoke passed — tenants ${a.sub}/${b.sub} are fully isolated.`
    : `\n❌ tenancy smoke failed — ${failures} assertion(s). Tenants: ${a.sub}/${b.sub}.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Smoke crashed:", e)
  process.exit(1)
})
