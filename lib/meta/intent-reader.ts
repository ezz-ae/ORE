import { geminiGenerate, geminiText } from '@/lib/gemini-rest'

// Layer 2, the intent reader. Turns a broker's FREEFORM ask ("more leads for
// TowerD, my old ad's dead") into the structured signals the guardrail router
// needs — grounded in what's already running, and honest: if the objective is
// genuinely unclear it asks ONE question rather than guessing. It never chooses
// the structural action (that's the deterministic router) and never moves money.

export interface ReaderContext {
  projectSlug: string
  projectName?: string
  /** Meta objectives already live for this project — grounds the model. */
  runningObjectives?: string[]
}

export interface ReadIntent {
  /** Meta objective key, or '' when unclear. */
  objective: '' | 'LEAD_GENERATION' | 'LINK_CLICKS' | 'REACH'
  /** Locale hint from the ask: '' | 'en' | 'ar' | 'ru'. */
  language: string
  dailyBudgetAED: number | null
  /** True when the broker signals a new/better creative to run. */
  hasNewCreative: boolean
  /** A short question when the objective can't be determined — else null. */
  needsClarification: string | null
  source: 'ai' | 'fallback'
}

const OBJECTIVE_OF: Record<string, ReadIntent['objective']> = {
  lead_form: 'LEAD_GENERATION',
  landing_page: 'LINK_CLICKS',
  awareness: 'REACH',
}

const langOf = (s: string): string => {
  const t = s.toLowerCase()
  if (/\b(arabic|عربي|بالعربي|arabe)\b/.test(t)) return 'ar'
  if (/\b(russian|русск|russe)\b/.test(t)) return 'ru'
  if (/\b(english|إنجليزي|بالانجليزي)\b/.test(t)) return 'en'
  return ''
}
const budgetOf = (s: string): number | null => {
  // "aed 300", "300 aed", "300/day", "budget 300"
  const m = s.replace(/,/g, '').match(/(?:aed|budget|spend|dhs?|درهم)\s*([0-9]{2,6})|([0-9]{2,6})\s*(?:aed|\/?\s*day|dhs?|درهم)/i)
  const n = m ? Number(m[1] || m[2]) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}
const hasCreativeSignal = (s: string): boolean =>
  /\b(new|better|fresh|another|different|my)\s+(creative|ad|image|photo|video|reel|design|banner)\b|new creative|better creative/i.test(s)

// Deterministic keyword parse — the honest fallback when the AI key is absent or
// the call fails. Never invents an objective it can't see in the text.
export function fallbackRead(text: string): ReadIntent {
  const t = (text || '').toLowerCase()
  let objective: ReadIntent['objective'] = ''
  if (/\b(lead form|instant form|lead-gen|leadgen|leads? form|form)\b/.test(t)) objective = 'LEAD_GENERATION'
  else if (/\b(landing|website|web page|webpage|traffic|link|site)\b/.test(t)) objective = 'LINK_CLICKS'
  else if (/\b(awareness|reach|brand|branding|impressions|views)\b/.test(t)) objective = 'REACH'
  else if (/\b(leads?|inquir|enquir|buyers?|clients?)\b/.test(t)) objective = 'LEAD_GENERATION' // "I want leads"
  return {
    objective,
    language: langOf(t),
    dailyBudgetAED: budgetOf(text || ''),
    hasNewCreative: hasCreativeSignal(text || ''),
    needsClarification: objective ? null : 'What outcome do you want — lead forms, or traffic to the landing page?',
    source: 'fallback',
  }
}

// Extract the first JSON object from a model response (handles code fences).
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced ? fenced[1] : raw).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

/**
 * Read a broker's freeform request into a structured intent. Grounded (running
 * objectives), constrained (fixed enum + validated numbers), and honest
 * (clarifies instead of guessing). Falls back to a deterministic parse.
 */
export async function readCampaignIntent(text: string, ctx: ReaderContext): Promise<ReadIntent> {
  const key = process.env.GEMINI_API_KEY
  const clean = (text || '').trim()
  if (!key || !clean) return fallbackRead(clean)

  const running = (ctx.runningObjectives ?? []).join(', ') || 'none'
  const prompt = `You are a media-buying INTENT PARSER for a Dubai real-estate ad platform. A broker wrote a request about advertising the project "${ctx.projectName || ctx.projectSlug}". Extract ONLY what the broker actually said — never invent a value that isn't implied.

Return STRICT JSON, no prose:
{
  "objective": "lead_form" | "landing_page" | "awareness" | "unclear",
  "language": "en" | "ar" | "ru" | "",
  "dailyBudgetAED": <number or null>,
  "hasNewCreative": <true|false>,
  "clarification": <a ONE-sentence question ONLY if objective is "unclear", else null>
}

Rules:
- "objective" = the outcome they want. lead_form = collect leads via a Meta instant form. landing_page = send traffic to the landing page/website. awareness = reach/branding. If you cannot tell, use "unclear" and set a clarification question.
- "hasNewCreative" true only if they mention a new/better/different creative, ad, image, video or design.
- Objectives already running for this project: ${running}. Use this only for context; do not force a match.
- Do not fabricate a budget or language that isn't in the text (use null / "").

Broker request: """${clean.slice(0, 800)}"""`

  try {
    const resp = await geminiGenerate(
      key,
      [{ role: 'user', parts: [{ text: prompt }] }],
      { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 400 },
    )
    const parsed = JSON.parse(extractJson(geminiText(resp))) as Record<string, unknown>
    const objRaw = String(parsed.objective ?? 'unclear')
    const objective = OBJECTIVE_OF[objRaw] ?? ''
    const lang = String(parsed.language ?? '')
    // Ground the model's budget in the actual text — never accept a number the
    // broker didn't state (NOTHING-FAKE). Prefer the value the text confirms.
    const textBudget = budgetOf(clean)
    const modelBudget = typeof parsed.dailyBudgetAED === 'number' && Number.isFinite(parsed.dailyBudgetAED) && parsed.dailyBudgetAED > 0
      ? parsed.dailyBudgetAED : null
    const budget = textBudget !== null
      ? (modelBudget === textBudget ? modelBudget : textBudget)
      : null
    const clarification = objective ? null
      : (typeof parsed.clarification === 'string' && parsed.clarification.trim() ? parsed.clarification.trim() : fallbackRead(clean).needsClarification)
    return {
      objective,
      language: ['en', 'ar', 'ru'].includes(lang) ? lang : '',
      dailyBudgetAED: budget,
      hasNewCreative: parsed.hasNewCreative === true,
      needsClarification: clarification,
      source: 'ai',
    }
  } catch {
    return fallbackRead(clean)
  }
}
