import { NextRequest, NextResponse } from 'next/server'
import { brandName } from '@/lib/freehold/brand'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { queryServerAgent } from '@/lib/freehold/server-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The Help centre's AI guide: when a question isn't covered by a built-in
// walkthrough, this generates concrete, clickable steps grounded in the REAL
// sitemap below — it never invents pages that don't exist.

const SITEMAP = `
FREEHOLD INTELLIGENCE — real pages (base: /freehold-intelligence):
- Hub: /freehold-intelligence (daily briefing, activity, app launcher)
- CRM: /crm/leads (all leads, add lead, open lead for 360° view with Call/WhatsApp/notes/timeline), /crm/inbox (new unassigned leads), /crm/assignment (assign to brokers with live capacity), /crm/board (drag pipeline; drop on Closed opens deal window), /crm/follow-up (overdue queue), /crm/pipeline, /crm/reports, /crm/agents (broker capacity), /crm/duplicates, /crm/activity
- Ads / Lead Machine: /lead-machine (hub), /lead-machine/campaigns/new (Meta campaign wizard: project → creative → budget/audience → launch), /lead-machine/landings (create + publish landing pages at /lp/<slug>, per-row Campaign button prefills the ad builder), /lead-machine/creatives + /lead-machine/creatives/generate (AI ad copy), /lead-machine/forms (Meta lead forms), /lead-machine/google/campaigns/new (Google search campaign), /lead-machine/google/keywords, /lead-machine/targeting
- Ads Live: /ads-live (real-time spend & leads overview), /ads-live/meta, /ads-live/google, /ads-live/preview
- Inventory: /inventory, /inventory/projects (all projects, data-quality & ad-readiness), open a project to generate a landing page or start a campaign
- Finance: /finance (commission waterfall: agency → referral/cashback → expenses/growth → broker payout → company net), /finance/credits (give agents ad credits), /finance/payments, /finance/reports, /finance/invoices
- Management: /management (overview), /management/deals (record deals, 2-step approval, autofill from closed CRM leads), /management/team (broker profiles incl. deals), /management/reports, /management/roi
- Analytics: /analytics (Company), /analytics/team (per-member full record), /analytics/market, /analytics/marketing
- Notebook: /notebook (AI research workspace; conversations persist)
- Web Studio (AI Manager): /ai-manager (listings, SEO content, landing copy with AI)
- Integrations: /integrations, /integrations/meta, /integrations/whatsapp, /integrations/hubspot (read/write/both sync), /integrations/google — each has an in-page "How do I get this?" guide; credentials are validated live and stored encrypted
- Settings: /settings, /settings/team (add members + roles), /settings/automation (lead routing rules), /settings/languages, /settings/security, /settings/roles
- Broker workspace: /agent (home), /agent/leads, /agent/bio (public Bio Link + QR, leads auto-assigned), /agent/campaigns, /agent/credits, /agent/account
- Account menu (top-right on every page): Language EN/AR/RU, Day/Night screen light, What's new, Help & guide, Take a tour. All personal settings save to the ACCOUNT and follow the user to any device.
- The AI Expert: gold button on every screen (Cmd/Ctrl-J); reads live data; outputs can be saved to the Notebook.
`

const SYSTEM = `You are the in-product guide for ${brandName}, a real-estate operating platform. Answer "how do I / where is / what does" questions with SHORT, concrete steps a non-technical real-estate person can follow.

Rules:
- Use ONLY the pages in the sitemap. Never invent pages, buttons you are not sure exist, or fake data.
- Reply in the SAME language as the question (English, Arabic or Russian).
- Return PURE JSON, nothing else: {"answer": "<one-sentence direct answer>", "steps": [{"title": "<short imperative>", "detail": "<1-2 sentences>", "path": "</freehold-intelligence/...>"}]}
- 2 to 5 steps. "path" is optional per step — include it when the step happens on a specific page.
- If the question is completely outside the product, answer briefly in "answer" with empty steps.

Sitemap:
${SITEMAP}`

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { question?: string }
  const question = String(body.question ?? '').trim().slice(0, 500)
  if (!question) return NextResponse.json({ error: 'Ask a question' }, { status: 400 })

  const rl = await checkRateLimit(`help-ask:${auth.user.email}`, { limit: 30, windowSec: 3600 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many questions — try again shortly', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    )
  }

  const raw = await queryServerAgent(question, {
    systemPrompt: SYSTEM,
    responseMimeType: 'application/json',
    maxOutputTokens: 700,
    temperature: 0.2,
    sessionId: `help-${auth.user.email}`,
  })

  // Parse defensively: the offline fallback (and a misbehaving model) returns
  // prose, which we surface as a plain answer instead of failing.
  try {
    const jsonStart = raw.indexOf('{')
    const parsed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, raw.lastIndexOf('}') + 1) : raw) as {
      answer?: string
      steps?: Array<{ title?: string; detail?: string; path?: string }>
    }
    const steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .filter((s) => s && (s.title || s.detail))
      .slice(0, 6)
      .map((s) => ({
        title: String(s.title ?? '').slice(0, 120),
        detail: String(s.detail ?? '').slice(0, 400),
        // Only link to real in-app paths — drop anything else the model made up.
        path: typeof s.path === 'string' && s.path.startsWith('/freehold-intelligence') ? s.path : undefined,
      }))
    return NextResponse.json({ answer: String(parsed.answer ?? '').slice(0, 600), steps })
  } catch {
    return NextResponse.json({ answer: raw.slice(0, 800), steps: [] })
  }
}
