import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { queryServerAgent } from '@/lib/freehold/server-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RefineBody {
  campaignName?: string
  objective?: string
  metrics?: { spend?: number; impressions?: number; clicks?: number; leads?: number; cpl?: number; ctr?: number }
  quality?: { score?: number | null; attributed?: number; reached?: number; qualified?: number; won?: number; junk?: number }
  landingSlug?: string | null
}

const SYSTEM = `You are a senior Meta Ads performance strategist for Dubai freehold real estate.
Analyse the campaign using the REAL data provided: BOTH Meta delivery metrics AND the downstream
CRM lead-QUALITY funnel (reached → qualified → won, plus junk) — which Meta itself cannot see.
Ground every point in the actual numbers. A campaign with cheap leads but a low quality score is
delivering junk; say so. Always consider the landing-page experience, because Meta never controls it.
NUMBERS ARE EVIDENCE: cite ONLY figures present verbatim in the provided data. If metaMetrics or
leadQuality is null, zero, or missing a field, say that data isn't available yet — NEVER invent,
estimate or extrapolate a number. Fabricated figures on a money decision are the worst failure.
Return ONLY strict JSON: {"working":[],"blocking":[],"actions":[]} — each an array of short, specific
strings. "actions" must be 3 concrete, doable next steps (pause, shift budget, change creative/landing,
tighten targeting). No preamble, no markdown.`

function parse(raw: string): { working: string[]; blocking: string[]; actions: string[] } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const p = JSON.parse(trimmed) as { working?: unknown; blocking?: unknown; actions?: unknown }
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') as string[] : [])
    const out = { working: arr(p.working), blocking: arr(p.blocking), actions: arr(p.actions) }
    if (out.working.length || out.blocking.length || out.actions.length) return out
  } catch { /* not JSON → caller shows the raw text */ }
  return null
}

/** AI Refiner: what is driving results, what is blocking them, and the top actions. */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as RefineBody
  const name = String(body.campaignName ?? '').trim() || 'this campaign'

  const context = {
    campaign: name,
    objective: body.objective ?? null,
    metaMetrics: body.metrics ?? null,
    leadQuality: body.quality ?? null,
    landingPage: body.landingSlug ?? null,
  }
  const message = `Analyse the Meta campaign "${name}" and return the working/blocking/actions JSON.`

  const raw = await queryServerAgent(message, {
    systemPrompt: SYSTEM,
    context,
    responseMimeType: 'application/json',
    maxOutputTokens: 1024,
    temperature: 0.5,
  })

  const analysis = parse(raw)
  if (analysis) return NextResponse.json({ analysis })
  // Non-JSON (e.g. offline fallback) → hand back the honest text so the UI can show it.
  return NextResponse.json({ text: raw })
}
