import { BRAND } from '@/lib/freehold/brand'
import { getSiteUrl } from '@/lib/site'
import { sendSystemEmail } from '@/lib/transactional-email'
import {
  listCampaigns, getCampaign, getCampaignInsights,
  updateCampaignStatus, updateAdSet, listAdSets, getAdSet,
  launchFullCampaign, listLeadForms, createLeadForm,
  listCampaignAds, updateAdCreativeContent,
} from '@/lib/meta/client'
import { campaignResumeBlock } from '@/lib/freehold/ads-machine-engine'
import { UAE_INTERESTS } from '@/lib/meta/targeting-catalog'
import { recommendTargeting } from '@/lib/freehold/targeting-recommend'
import { getBaseStats, getBaseQuality, getNetworkBenchmarks, TENANT_ID, BASE_TENANT } from '@/lib/entrestate/targeting-base'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { AutonomyLevel } from '@/lib/freehold/agent-router'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import {
  listRules, createRule,
  RULE_METRICS, RULE_OPERATORS, RULE_ACTIONS,
  type RuleMetric, type RuleOperator, type RuleAction,
} from '@/lib/freehold/campaign-rules'
import { getLandingPagesForDashboard, getLandingPageForEditor, createLandingPage } from '@/lib/landing-pages'
import { getInventoryPropertyBySlug, getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { getProjectProfile } from '@/lib/freehold/project-profile'
import { searchCrmLeads } from '@/lib/data'
import { listLibrary, saveLibraryItem } from '@/lib/freehold/library'
import { listAudiences, getAudience, type SavedAudience } from '@/lib/freehold/audiences'
import type { AdDestination, CampaignTargeting, MetaCampaignObjective, MetaCta } from '@/lib/meta/types'
import { genImage } from '@/lib/creative-studio/providers'
import { z } from 'zod'

/**
 * Coordinator tools — the Vertex-ADK-style "marketing coordinator" layer of
 * the ONE side chat. The coordinator (the chat model) routes work to
 * specialist toolsets — ads / landing / crm / creative / research — and every
 * tool here executes a REAL internal function (the same ones the UI uses).
 * Nothing is simulated; a tool that can't run returns an honest error.
 *
 * Safety model:
 *  - Tools are role-gated server-side (the role comes from the verified
 *    session — the model cannot escalate it).
 *  - Destructive tools (pause/resume/budget/rules) additionally require
 *    args.confirm === true, which the model is instructed to set only after
 *    the user explicitly confirmed in their own words.
 */

export type CoordinatorRole =
  | 'owner' | 'admin' | 'marketing' | 'sales_manager'
  | 'sales_agent' | 'data_manager' | 'viewer'

export interface ToolCtx {
  role: CoordinatorRole
  /** Verified account email (tool ownership scoping — e.g. rules, library). */
  email: string
  brokerId: string | null
  /** Server-stored guardrail: 1 advisory · 2 semi-autonomous · 3 autopilot. */
  autonomy: AutonomyLevel
}

export interface CoordinatorTool {
  /** Stable snake name the model calls, prefixed by specialist. */
  name: string
  /** Specialist agent this tool belongs to (shown in docs + evidence). */
  agent: 'ads_agent' | 'landing_agent' | 'crm_agent' | 'creative_agent' | 'research_agent'
  description: string
  /** Human-readable args spec rendered into the prompt. */
  params: string
  /** Zod schema for the tool's args (used by the AI-SDK tool builder). */
  schema: z.ZodType<Record<string, unknown>>
  /** Mutates money/live campaigns/content — requires args.confirm === true. */
  destructive?: boolean
  roles: CoordinatorRole[]
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>
}

// Compact, chat-friendly view of a saved audience (Audiences tab entity).
function audienceSummary(a: SavedAudience) {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    seededFromContacts: a.uploadedCount || undefined,
    interests: a.spec.interests.map((i) => i.name),
    behaviors: (a.spec.behaviors ?? []).map((b) => b.name),
    narrowed: (a.spec.narrowing ?? []).length > 0,
    excludes: [...(a.spec.exclusions?.interests ?? []), ...(a.spec.exclusions?.behaviors ?? [])].map((e) => e.name),
    countries: a.spec.countries,
    attachUrl: `/freehold-intelligence/lead-machine/campaigns/new?audience=${encodeURIComponent(a.id)}`,
  }
}

const OPERATORS: CoordinatorRole[] = ['owner', 'admin', 'marketing']
const ADS_READERS: CoordinatorRole[] = ['owner', 'admin', 'marketing', 'sales_manager']
const EVERYONE: CoordinatorRole[] = ['owner', 'admin', 'marketing', 'sales_manager', 'sales_agent', 'data_manager']

const s = (v: unknown) => String(v ?? '').trim()
const n = (v: unknown) => Number(v)

// Launch vocabulary shared with the campaign wizard (campaigns/new). The
// wizard's product objectives map onto exactly these three Meta objectives —
// smart landing / WhatsApp / call → LINK_CLICKS, Meta lead form →
// LEAD_GENERATION, branding → REACH.
const LAUNCH_OBJECTIVES = ['LEAD_GENERATION', 'LINK_CLICKS', 'REACH'] as const
const LAUNCH_DESTINATIONS = ['landing', 'form', 'whatsapp', 'phone'] as const
const LAUNCH_CTAS = ['LEARN_MORE', 'GET_QUOTE', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW'] as const
const LAUNCH_PLACEMENTS = ['fbFeed', 'igFeed', 'igStory', 'fbStory', 'reels'] as const
const LAUNCH_LEAD_LANGUAGES = ['en', 'ar', 'ru'] as const

/** Trimmed, deduped, non-empty string array from unknown args (cap defensive). */
const strArr = (v: unknown, cap = 30): string[] =>
  Array.isArray(v) ? [...new Set(v.map(s).filter(Boolean))].slice(0, cap) : []

export const COORDINATOR_TOOLS: CoordinatorTool[] = [
  // ── ads_agent ──────────────────────────────────────────────────────────────
  {
    name: 'ads_list_campaigns', agent: 'ads_agent',
    description: 'List the Meta campaigns on the connected ad account (id, name, status, daily budget).',
    params: '{}', roles: ADS_READERS,
    schema: z.object({}),
    run: async () => {
      const campaigns = await listCampaigns()
      return campaigns.slice(0, 25).map((c) => ({
        id: c.id, name: c.name, status: c.status,
        dailyBudgetAED: c.daily_budget ? Math.round(Number(c.daily_budget) / 100) : null,
      }))
    },
  },
  {
    name: 'ads_campaign_insights', agent: 'ads_agent',
    description: 'Live performance for one campaign: spend, impressions, clicks, leads, CPC/CPM (this month).',
    params: '{ "campaignId": string }', roles: ADS_READERS,
    schema: z.object({ campaignId: z.string() }),
    run: async (args) => {
      const id = s(args.campaignId)
      if (!id) return { error: 'campaignId is required' }
      const [campaign, insights] = await Promise.all([getCampaign(id), getCampaignInsights(id)])
      return { campaign: { id: campaign.id, name: campaign.name, status: campaign.status }, insights }
    },
  },
  {
    name: 'ads_campaign_quality', agent: 'ads_agent',
    description: 'THE tool for "does this campaign generate good leads?". Live quality from the campaign\'s REAL CRM leads: 0–100 score (funnel outcomes + junk/duplicates), the human 0–10 value ratings (avgValue, valuable ≥6 vs avoid ≤2 counts), and whoTheyAre — researched smart-profile aggregates (industries, roles, cities) of the people this campaign actually brings. Null score / null avgValue = not enough signal yet, say so honestly.',
    params: '{ "campaignId": string, "campaignName": string }', roles: ADS_READERS,
    schema: z.object({ campaignId: z.string(), campaignName: z.string() }),
    run: async (args) => getCampaignQuality(s(args.campaignId), s(args.campaignName)),
  },
  {
    name: 'ads_pause_campaign', agent: 'ads_agent', destructive: true,
    description: 'PAUSE a live Meta campaign (stops spend).',
    params: '{ "campaignId": string, "confirm": true }', roles: OPERATORS,
    schema: z.object({
      campaignId: z.string(),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args) => {
      await updateCampaignStatus(s(args.campaignId), 'PAUSED')
      return { ok: true, campaignId: s(args.campaignId), status: 'PAUSED' }
    },
  },
  {
    name: 'ads_resume_campaign', agent: 'ads_agent', destructive: true,
    description: 'Set a paused Meta campaign ACTIVE (spend resumes).',
    params: '{ "campaignId": string, "confirm": true }', roles: OPERATORS,
    schema: z.object({
      campaignId: z.string(),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args) => {
      // An ads machine may have stopped this campaign for a reason that
      // outranks the request — an expired Trakheesi permit makes the ad
      // illegal, whichever door turns it back on. Refuse with the reason
      // rather than silently putting an unpermitted ad back on air.
      const block = await campaignResumeBlock(s(args.campaignId))
      if (block) return { ok: false, campaignId: s(args.campaignId), refused: block }
      await updateCampaignStatus(s(args.campaignId), 'ACTIVE')
      return { ok: true, campaignId: s(args.campaignId), status: 'ACTIVE' }
    },
  },
  {
    name: 'ads_list_adsets', agent: 'ads_agent',
    description: 'List a campaign’s ad sets (id, name, status, daily budget) — budgets live on ad sets.',
    params: '{ "campaignId": string }', roles: ADS_READERS,
    schema: z.object({ campaignId: z.string() }),
    run: async (args) => {
      const sets = await listAdSets(s(args.campaignId))
      return sets.map((x) => ({ id: x.id, name: x.name, status: x.status, dailyBudgetAED: x.daily_budget ? Math.round(Number(x.daily_budget) / 100) : null }))
    },
  },
  {
    name: 'ads_set_adset_budget', agent: 'ads_agent', destructive: true,
    description: 'Change an ad set’s daily budget in AED (min 50).',
    params: '{ "adSetId": string, "dailyBudgetAED": number, "confirm": true }', roles: OPERATORS,
    schema: z.object({
      adSetId: z.string(),
      dailyBudgetAED: z.number().describe('new daily budget in AED, min 50'),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args) => {
      const budget = n(args.dailyBudgetAED)
      if (!Number.isFinite(budget) || budget < 50) return { error: 'dailyBudgetAED must be ≥ 50' }
      await updateAdSet(s(args.adSetId), { dailyBudgetAED: budget })
      return { ok: true, adSetId: s(args.adSetId), dailyBudgetAED: budget }
    },
  },
  {
    name: 'ads_list_rules', agent: 'ads_agent',
    description: 'List this account’s automation rules on the lead-quality score / CPL / spend.',
    params: '{ "campaignId"?: string }', roles: ADS_READERS,
    schema: z.object({ campaignId: z.string().optional().describe('filter to one campaign; omit for all rules') }),
    run: async (args, ctx) => listRules(ctx.email, s(args.campaignId) || undefined),
  },
  {
    name: 'ads_add_rule', agent: 'ads_agent', destructive: true,
    description: `Create an automation rule, e.g. "if quality < 60 pause". metric: ${RULE_METRICS.join('|')}; operator: ${RULE_OPERATORS.join('|')}; action: ${RULE_ACTIONS.join('|')} (budget_up/down need actionValue %).`,
    params: '{ "campaignId": string, "metric": string, "operator": string, "threshold": number, "action": string, "actionValue"?: number, "confirm": true }',
    roles: OPERATORS,
    schema: z.object({
      campaignId: z.string().describe('campaign the rule applies to'),
      metric: z.string().describe(`one of: ${RULE_METRICS.join('|')}`),
      operator: z.string().describe(`one of: ${RULE_OPERATORS.join('|')}`),
      threshold: z.number(),
      action: z.string().describe(`one of: ${RULE_ACTIONS.join('|')}`),
      actionValue: z.number().optional().describe('percent for budget_up/down actions'),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args, ctx) => {
      const rule = await createRule(ctx.email, {
        campaignId: s(args.campaignId) || null,
        metric: s(args.metric) as RuleMetric,
        operator: s(args.operator) as RuleOperator,
        threshold: n(args.threshold),
        action: s(args.action) as RuleAction,
        actionValue: args.actionValue == null ? null : n(args.actionValue),
      })
      return rule ?? { error: 'Invalid rule — check metric/operator/action values.' }
    },
  },

  {
    name: 'ads_plan_campaign', agent: 'ads_agent',
    description: 'BUILD a data-driven campaign plan for a listing: the learning loop reads real campaign/CRM outcomes + network benchmarks and returns strategy, audience (ages, cities, interests), daily budget, creative angle, and a prefilled wizard link. Non-destructive — nothing launches.',
    params: '{ "listingName": string, "area"?: string, "priceAED"?: number }',
    roles: OPERATORS,
    schema: z.object({
      listingName: z.string(),
      area: z.string().optional().describe('area/community of the listing'),
      priceAED: z.number().optional().describe('listing price in AED'),
    }),
    run: async (args, ctx) => {
      const name = s(args.listingName)
      if (!name) return { error: 'listingName is required' }
      const listing = { name, area: s(args.area), price: n(args.priceAED) || 0 }
      const { recommendation, connected } = await recommendTargeting(listing, ctx.email)
      const interestNames = recommendation.interestIds
        .map((id) => UAE_INTERESTS.find((i) => i.id === id)?.name)
        .filter(Boolean)
      const qs = new URLSearchParams({ name, ...(listing.price ? { price: String(listing.price) } : {}) })
      return {
        plan: {
          strategy: recommendation.strategy,
          analysis: recommendation.analysis,
          rationale: recommendation.rationale,
          audience: {
            ageMin: recommendation.ageMin,
            ageMax: recommendation.ageMax,
            cityKeys: recommendation.cityKeys,
            interests: interestNames,
            lookalikeSeed: recommendation.lookalikeSeed,
            exclusions: recommendation.exclusions,
          },
          dailyBudgetAED: recommendation.dailyBudgetAED,
          creativeAngle: recommendation.creativeAngle,
          signalPlan: recommendation.signalPlan,
          learningPhase: recommendation.learningPhase,
        },
        metaConnected: connected,
        wizardUrl: `/freehold-intelligence/lead-machine/campaigns/new?${qs.toString()}`,
        note: 'Present the plan in plain language. Offer BOTH follow-ups: open the prefilled wizard (navigate to wizardUrl) or launch it paused via ads_launch_campaign after the user confirms.',
      }
    },
  },
  {
    name: 'ads_list_ads', agent: 'ads_agent',
    description: 'READ the ads inside a campaign with their CURRENT copy (primary text, headline, description, link, CTA). Use before editing an ad so you quote the real current content and get the adId.',
    params: '{ "campaignId": string }',
    roles: ADS_READERS,
    schema: z.object({ campaignId: z.string() }),
    run: async (args) => {
      const campaignId = s(args.campaignId)
      if (!campaignId) return { error: 'campaignId is required' }
      const ads = await listCampaignAds(campaignId)
      return {
        ads: ads.map((a) => ({
          adId: a.id, name: a.name, status: a.status,
          copy: a.creative
            ? { primaryText: a.creative.primaryText, headline: a.creative.headline, description: a.creative.description, landingUrl: a.creative.landingUrl, cta: a.creative.ctaType }
            : null,
        })),
      }
    },
  },
  {
    name: 'ads_edit_ad', agent: 'ads_agent', destructive: true,
    description: 'EDIT a live ad’s creative/copy for real: builds a new creative with the changed fields (primary text, headline, description, landing URL, image URL, CTA) and repoints the ad — the Meta-correct flow, since creatives are immutable. Get the adId from ads_list_ads first. Only pass the fields the user wants changed.',
    params: '{ "adId": string, "primaryText"?: string, "headline"?: string, "description"?: string, "landingUrl"?: string, "imageUrl"?: string, "cta"?: string, "confirm": true }',
    roles: OPERATORS,
    schema: z.object({
      adId: z.string().describe('the ad to edit — get it from ads_list_ads'),
      primaryText: z.string().optional(),
      headline: z.string().optional(),
      description: z.string().optional(),
      landingUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      cta: z.string().optional(),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args) => {
      const adId = s(args.adId)
      if (!adId) return { error: 'adId is required — call ads_list_ads to find it' }
      const changes = {
        primaryText: s(args.primaryText) || undefined,
        headline: s(args.headline) || undefined,
        description: s(args.description) || undefined,
        landingUrl: s(args.landingUrl) || undefined,
        imageUrl: s(args.imageUrl) || undefined,
        cta: s(args.cta) || undefined,
      }
      if (!Object.values(changes).some(Boolean)) return { error: 'Pass at least one field to change.' }
      const result = await updateAdCreativeContent(adId, changes)
      return {
        ok: true,
        adId: result.adId,
        newCreativeId: result.creativeId,
        before: result.before,
        after: result.after,
        note: 'The ad now serves the new creative. Meta may re-review it; delivery continues per campaign status.',
      }
    },
  },
  {
    name: 'forms_list', agent: 'ads_agent',
    description: 'READ the Meta instant lead forms on the connected account: name, status, lead counts. Use before creating a form (reuse beats duplication) and when wiring a Meta Lead campaign.',
    params: '{}',
    roles: ADS_READERS,
    schema: z.object({}),
    run: async () => {
      const forms = await listLeadForms()
      return {
        forms: forms.slice(0, 15).map((f) => ({
          id: f.id, name: f.name, status: f.status, leads: f.leads_count,
          manageUrl: `/freehold-intelligence/lead-machine/forms/${f.id}`,
        })),
        formsUrl: '/freehold-intelligence/lead-machine/forms',
      }
    },
  },
  {
    name: 'forms_create', agent: 'ads_agent', destructive: true,
    description: 'CREATE a real Meta instant lead form on the connected account with the standard fields (full name, email, phone). Leads collected by it sync into the CRM. Use when the user asks for a lead form — do NOT tell them to build it in Ads Manager.',
    params: '{ "formName": string, "listingName": string, "listingSlug"?: string, "landingUrl"?: string, "confirm": true }',
    roles: OPERATORS,
    schema: z.object({
      formName: z.string(),
      listingName: z.string(),
      listingSlug: z.string().optional(),
      landingUrl: z.string().optional(),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args) => {
      const formName = s(args.formName)
      const listingName = s(args.listingName)
      if (!formName || !listingName) return { error: 'formName and listingName are required' }
      const slug = s(args.listingSlug)
      const landingUrl = s(args.landingUrl)
        || (slug ? `${getSiteUrl()}/lp/${slug}` : getSiteUrl())
      const created = await createLeadForm({
        name: formName,
        listingId: slug || listingName,
        listingName,
        landingUrl,
        questions: [{ type: 'FULL_NAME' }, { type: 'EMAIL' }, { type: 'PHONE' }],
        privacyPolicyUrl: BRAND.privacyUrl,
        thankYouTitle: `Thank you — ${listingName}`,
        thankYouBody: 'Our advisor will contact you shortly with the full details.',
      })
      return {
        ok: true,
        formId: created.id,
        manageUrl: `/freehold-intelligence/lead-machine/forms/${created.id}`,
        note: 'The form is live on the ad account and its leads sync into the CRM. To run ads on it: campaign wizard → objective "Meta Lead" → pick this form, or ads_launch_campaign later.',
      }
    },
  },
  {
    name: 'audiences_list', agent: 'ads_agent',
    description: 'READ the saved audiences (Audiences tab): behavioral/narrow definitions and lookalikes seeded from real lead lists, with their composition and one-click attach links. Use before planning a campaign so a real audience gets attached instead of guessed interests.',
    params: '{}',
    roles: ADS_READERS,
    schema: z.object({}),
    run: async () => {
      const audiences = await listAudiences()
      if (!audiences.length) {
        return {
          audiences: [],
          audiencesUrl: '/freehold-intelligence/lead-machine/audiences',
          note: 'No saved audiences yet — the user can build behavioral/narrow audiences or upload a lead list for a lookalike on the Audiences tab.',
        }
      }
      return { audiences: audiences.slice(0, 10).map(audienceSummary), audiencesUrl: '/freehold-intelligence/lead-machine/audiences' }
    },
  },
  {
    name: 'audiences_best_match', agent: 'ads_agent',
    description: 'RANK the best-match audiences for a listing: saved lookalikes first (seeded from real lead contacts), then narrow behavioral definitions, grounded by the learning loop’s call on our own outcomes. Returns attach links so the campaign starts with a real audience in one click. Non-destructive.',
    params: '{ "listingName": string, "area"?: string, "priceAED"?: number }',
    roles: ADS_READERS,
    schema: z.object({
      listingName: z.string().optional().describe('listing to match audiences to; omit for a generic ranking'),
      area: z.string().optional(),
      priceAED: z.number().optional(),
    }),
    run: async (args, ctx) => {
      const name = s(args.listingName)
      const listing = name ? { name, area: s(args.area), price: n(args.priceAED) || 0 } : null
      const [audiences, loop] = await Promise.all([
        listAudiences(),
        recommendTargeting(listing, `chat-audiences:${ctx.email}`),
      ])
      const weight = (x: SavedAudience) => (x.kind === 'lookalike' ? 0 : x.kind === 'narrow' ? 1 : 2)
      const ranked = [...audiences].sort((a, b) => weight(a) - weight(b)).slice(0, 5)
      return {
        ranked: ranked.map(audienceSummary),
        learningLoop: {
          strategy: loop.recommendation.strategy,
          rationale: loop.recommendation.rationale,
          dailyBudgetAED: loop.recommendation.dailyBudgetAED,
        },
        audiencesUrl: '/freehold-intelligence/lead-machine/audiences',
        note: ranked.length
          ? 'Recommend the top audience by name and offer its attachUrl to start the campaign with it attached.'
          : 'No saved audiences yet — suggest building a lookalike from the lead list or a behavioral audience on the Audiences tab, then plan with ads_plan_campaign.',
      }
    },
  },
  {
    name: 'ads_data_pool_status', agent: 'ads_agent',
    description: 'READ the Data Pool (Settings → Data Pool / network targeting base): how many historical lead rows are stored — the system-wide seed and this tenant’s own imports — their outcome mix (lead/qualified/closed/lost), per-field completeness, and the current best cross-tenant benchmark segments that feed ads_plan_campaign. Read-only; never returns a raw row or PII, only counts.',
    params: '{}',
    roles: ADS_READERS,
    schema: z.object({}),
    run: async () => {
      const [stats, benchmarks, baseQuality, thisQuality] = await Promise.all([
        getBaseStats(), getNetworkBenchmarks(5),
        getBaseQuality(BASE_TENANT), getBaseQuality(TENANT_ID),
      ])
      return {
        stats,
        quality: { systemSeed: baseQuality, thisTenant: thisQuality },
        topBenchmarkSegments: benchmarks,
        importUrl: '/freehold-intelligence/settings/data',
        note: stats.length === 0
          ? 'The Data Pool is empty — no historical rows imported yet. Suggest importing via Settings → Data Pool.'
          : 'Use this to explain data coverage/quality when asked, or to note how much signal backs a recommendation from ads_plan_campaign.',
      }
    },
  },
  {
    name: 'ads_launch_campaign', agent: 'ads_agent', destructive: true,
    description: 'LAUNCH a Meta campaign (always created PAUSED — spend never starts until a human resumes it, a separately confirmed action). Builds campaign + ad set + creative + ad on the connected account at full wizard parity: objective (LEAD_GENERATION default | LINK_CLICKS | REACH), destination (landing | form — Meta instant form, needs leadFormId from forms_list | whatsapp | phone — needs destinationPhone), a saved audience via audienceId (from audiences_list — its full definition replaces the manual targeting fields, like attaching it in the wizard), countries (defaults to AE only — widen only when the user explicitly asked), lead-language narrowing (en/ar/ru), manual placements, multi-text headlines/descriptions (Meta auto-tests up to 5 of each), pixel override, lifetime spend cap and CPL cap. Every optional field omitted = today’s simple lead-gen launch. Use after ads_plan_campaign and the user’s explicit go-ahead.',
    params: '{ "campaignName": string, "listingName": string, "dailyBudgetAED": number, "objective"?: "LEAD_GENERATION"|"LINK_CLICKS"|"REACH", "destination"?: "landing"|"form"|"whatsapp"|"phone", "leadFormId"?: string, "destinationPhone"?: string, "audienceId"?: string, "ageMin"?: number, "ageMax"?: number, "interestIds"?: string[], "countries"?: string[], "cityKeys"?: string[], "leadLanguages"?: ("en"|"ar"|"ru")[], "headline"?: string, "headlines"?: string[], "primaryText": string, "description"?: string, "descriptions"?: string[], "landingUrl": string, "cta"?: "LEARN_MORE"|"GET_QUOTE"|"SIGN_UP"|"CONTACT_US"|"BOOK_NOW"|"APPLY_NOW", "pixelId"?: string, "placementMode"?: "automatic"|"manual", "manualPlacements"?: ("fbFeed"|"igFeed"|"igStory"|"fbStory"|"reels")[], "lifetimeCapAED"?: number, "cplCapAED"?: number, "confirm": true }',
    roles: OPERATORS,
    schema: z.object({
      campaignName: z.string(),
      listingName: z.string(),
      dailyBudgetAED: z.number().describe('daily budget in AED, min 50'),
      objective: z.enum(LAUNCH_OBJECTIVES).optional()
        .describe('Meta objective — defaults to LEAD_GENERATION; LINK_CLICKS for landing/WhatsApp/call traffic, REACH for branding'),
      destination: z.enum(LAUNCH_DESTINATIONS).optional()
        .describe("where a click/submit goes; omit for the landing URL. 'form' requires leadFormId, 'phone' requires destinationPhone"),
      leadFormId: z.string().optional().describe("Meta instant-form id (forms_list) — required when destination is 'form'"),
      destinationPhone: z.string().optional().describe("E.164 number, e.g. +9715… — required when destination is 'phone'"),
      audienceId: z.string().optional()
        .describe('saved audience id (audiences_list) — its full definition REPLACES ageMin/ageMax/interestIds/countries/cityKeys'),
      ageMin: z.number().optional().describe('min audience age (defaults to 28)'),
      ageMax: z.number().optional().describe('max audience age (defaults to 60)'),
      interestIds: z.array(z.string()).optional().describe('UAE interest ids to target'),
      countries: z.array(z.string()).optional()
        .describe("ISO country codes to deliver in; defaults to ['AE'] — only widen when the user explicitly asked for other markets"),
      cityKeys: z.array(z.string()).optional().describe('Meta city keys; defaults to Dubai'),
      leadLanguages: z.array(z.enum(LAUNCH_LEAD_LANGUAGES)).optional()
        .describe('narrow delivery to these lead languages; omit (or list all three) for no narrowing'),
      headline: z.string().optional().describe('ad headline — required unless headlines[] is given (then defaults to its first entry)'),
      headlines: z.array(z.string()).optional().describe("up to 5 headline variants — Meta auto-tests combinations (multi-text)"),
      primaryText: z.string(),
      description: z.string().optional().describe('ad description line (defaults to "Request the investor summary now.")'),
      descriptions: z.array(z.string()).optional().describe('up to 5 description variants — Meta auto-tests combinations'),
      landingUrl: z.string().describe('full https landing URL'),
      cta: z.enum(LAUNCH_CTAS).optional().describe('call-to-action button (defaults to LEARN_MORE)'),
      pixelId: z.string().optional().describe('conversion pixel id override; omit for the account default'),
      placementMode: z.enum(['automatic', 'manual']).optional()
        .describe("omit/'automatic' = Meta places across facebook+instagram; 'manual' = only the surfaces in manualPlacements"),
      manualPlacements: z.array(z.enum(LAUNCH_PLACEMENTS)).optional()
        .describe("surfaces to run on when placementMode is 'manual'"),
      lifetimeCapAED: z.number().optional().describe('lifetime spend ceiling in AED (real Meta spend_cap)'),
      cplCapAED: z.number().optional().describe('cost-per-lead ceiling in AED (real Meta COST_CAP bid)'),
      confirm: z.boolean().optional().describe('set true only after the user explicitly confirmed this exact action'),
    }),
    run: async (args, ctx) => {
      const campaignName = s(args.campaignName)
      const listingName = s(args.listingName)
      const budget = n(args.dailyBudgetAED)
      const headlines = strArr(args.headlines, 5)
      const descriptions = strArr(args.descriptions, 5)
      const headline = s(args.headline) || headlines[0] || ''
      const primaryText = s(args.primaryText)
      const description = s(args.description) || descriptions[0] || 'Request the investor summary now.'
      const landingUrl = s(args.landingUrl)
      if (!campaignName || !listingName) return { error: 'campaignName and listingName are required' }
      if (!Number.isFinite(budget) || budget < 50) return { error: 'dailyBudgetAED must be ≥ 50' }
      if (!headline || !primaryText) return { error: 'headline (or headlines[]) and primaryText are required — generate them first if needed' }
      if (!/^https?:\/\//.test(landingUrl)) return { error: 'landingUrl must be a full https URL (use landing_list to find the page)' }

      // Destination + objective — validated the same way the wizard gates its
      // launch button, and derived from the same product-objective mapping
      // (form → LEAD_GENERATION; landing/whatsapp/phone → LINK_CLICKS) when
      // the objective is omitted. Both omitted = today's LEAD_GENERATION.
      const destination = (s(args.destination) || undefined) as AdDestination | undefined
      if (destination && !LAUNCH_DESTINATIONS.includes(destination as (typeof LAUNCH_DESTINATIONS)[number])) {
        return { error: `destination must be one of ${LAUNCH_DESTINATIONS.join('|')}` }
      }
      const leadFormId = s(args.leadFormId)
      const destinationPhone = s(args.destinationPhone)
      if (destination === 'form' && !leadFormId) return { error: 'leadFormId is required when destination is "form" — use forms_list to pick one (or forms_create)' }
      if (destination === 'phone' && !destinationPhone) return { error: 'destinationPhone (E.164, e.g. +9715…) is required when destination is "phone"' }
      const objective = (s(args.objective)
        || (destination && destination !== 'form' ? 'LINK_CLICKS' : 'LEAD_GENERATION')) as MetaCampaignObjective
      if (!LAUNCH_OBJECTIVES.includes(objective as (typeof LAUNCH_OBJECTIVES)[number])) {
        return { error: `objective must be one of ${LAUNCH_OBJECTIVES.join('|')}` }
      }
      const cta = (s(args.cta) || 'LEARN_MORE') as MetaCta
      if (!LAUNCH_CTAS.includes(cta as (typeof LAUNCH_CTAS)[number])) {
        return { error: `cta must be one of ${LAUNCH_CTAS.join('|')}` }
      }

      // Targeting — a saved audience IS the audience: its full definition
      // (behaviors, narrowing, exclusions, attached Meta audiences) replaces
      // the manual fields, exactly like attaching it in the wizard. A bad id
      // is a hard error — never silently fall back to manual targeting.
      let targeting: CampaignTargeting
      let attachedAudience: SavedAudience | null = null
      const audienceId = s(args.audienceId)
      if (audienceId) {
        attachedAudience = await getAudience(audienceId)
        if (!attachedAudience) return { error: `No saved audience with id "${audienceId}" — call audiences_list for the real ids, or omit audienceId for manual targeting.` }
        targeting = { ...attachedAudience.spec, publisherPlatforms: ['facebook', 'instagram'] }
      } else {
        const ids = strArr(args.interestIds)
        const interests = UAE_INTERESTS.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, name: i.name }))
        const cityKeys = strArr(args.cityKeys)
        const countries = strArr(args.countries).map((c) => c.toUpperCase())
        targeting = {
          // Deliberately defaults to AE only (unlike the wizard's default-all
          // country list) — an agent widening geo silently is a spend risk.
          countries: countries.length ? countries : ['AE'],
          cityKeys: cityKeys.length ? cityKeys : ['297928'],
          ageMin: Math.min(60, Math.max(18, n(args.ageMin) || 28)),
          ageMax: Math.min(65, Math.max(25, n(args.ageMax) || 60)),
          publisherPlatforms: ['facebook', 'instagram'],
          interests,
        }
      }

      // Lead-language narrowing — same rules as the wizard: an attached
      // audience carries its own complete definition, and all three languages
      // means no narrowing worth sending.
      const langs = strArr(args.leadLanguages).filter((l) => LAUNCH_LEAD_LANGUAGES.includes(l as (typeof LAUNCH_LEAD_LANGUAGES)[number]))
      const leadLanguages = !attachedAudience && langs.length > 0 && langs.length < LAUNCH_LEAD_LANGUAGES.length ? langs : undefined

      // Placements — only sent when the agent explicitly chose; 'manual' with
      // no valid surface is an error rather than a silently-automatic launch.
      const placementMode = (s(args.placementMode) || undefined) as 'automatic' | 'manual' | undefined
      if (placementMode && placementMode !== 'automatic' && placementMode !== 'manual') {
        return { error: 'placementMode must be "automatic" or "manual"' }
      }
      const manualPlacements = placementMode === 'manual'
        ? strArr(args.manualPlacements).filter((k) => LAUNCH_PLACEMENTS.includes(k as (typeof LAUNCH_PLACEMENTS)[number]))
        : undefined
      if (placementMode === 'manual' && !manualPlacements?.length) {
        return { error: `manualPlacements must list at least one of ${LAUNCH_PLACEMENTS.join('|')} when placementMode is "manual"` }
      }

      // Money guardrails — real Meta controls (campaign spend_cap / COST_CAP).
      const lifetimeCapAED = n(args.lifetimeCapAED)
      const cplCapAED = n(args.cplCapAED)

      const result = await launchFullCampaign({
        campaignName,
        objective,
        listingName,
        dailyBudgetAED: budget,
        targeting,
        creative: {
          primaryText, headline,
          description,
          landingUrl,
          cta,
          // Meta's real multi-text feature — only sent when the agent actually
          // provided variants (a single entry is exactly the singular path).
          ...(headlines.length > 1 ? { headlines } : {}),
          ...(descriptions.length > 1 ? { descriptions } : {}),
        },
        ...(destination ? { destination } : {}),
        ...(destination === 'form' && leadFormId ? { leadFormId } : {}),
        ...(destination === 'phone' && destinationPhone ? { destinationPhone } : {}),
        ...(s(args.pixelId) ? { pixelId: s(args.pixelId) } : {}),
        ...(Number.isFinite(lifetimeCapAED) && lifetimeCapAED > 0 ? { lifetimeCapAED } : {}),
        ...(Number.isFinite(cplCapAED) && cplCapAED > 0 ? { cplCapAED } : {}),
        ...(placementMode ? { placementMode } : {}),
        ...(manualPlacements?.length ? { manualPlacements } : {}),
        ...(leadLanguages ? { leadLanguages } : {}),
        // HARD safety: the agent can never start spend. A human resumes it
        // (which is itself a separately confirmed destructive tool).
        launchStatus: 'PAUSED',
      })
      await setCampaignAutoEnhance(result.campaignId, 'approval')
      return {
        ok: true,
        campaignId: result.campaignId,
        status: 'PAUSED',
        objective,
        destination: destination ?? 'landing',
        ...(attachedAudience ? { audience: { id: attachedAudience.id, name: attachedAudience.name, kind: attachedAudience.kind } } : {}),
        reviewUrl: `/freehold-intelligence/ads-live/meta/${result.campaignId}`,
        note: 'Created PAUSED. Tell the user to review it and that resuming (starting spend) needs their separate confirmation.',
      }
    },
  },

  // ── landing_agent ──────────────────────────────────────────────────────────
  {
    name: 'listing_get', agent: 'landing_agent',
    description: 'Load ONE catalog project/listing by slug (or exact name): the REAL stored record (price, area, developer, payment plan, handover, yield) PLUS the PERSISTED four-dimension AI intelligence profile (investment / lifestyle / financial / market, with its generated_at and staleness) when one exists. For investment-case / lifestyle / market questions about a project, use this and cite the settled profile instead of re-deriving it.',
    params: '{ "slug": string }', roles: EVERYONE,
    schema: z.object({ slug: z.string().describe('project slug from the catalog (an exact project name also resolves)') }),
    run: async (args) => {
      const ref = s(args.slug)
      if (!ref) return { error: 'slug is required' }
      // Slug first (the canonical id), then an exact-name fallback — the model
      // often knows the project by name from conversation, not by slug.
      let prop = await getInventoryPropertyBySlug(ref)
      if (!prop) {
        const all = await getInventoryPropertiesFromDB()
        prop = all.find((p) => p.name.toLowerCase() === ref.toLowerCase()) ?? null
      }
      if (!prop) return { error: `No catalog project matching "${ref}" — check the slug or exact name.` }
      const { profile, stale } = await getProjectProfile(prop.slug)
      return {
        listing: {
          slug: prop.slug, name: prop.name, area: prop.area, developer: prop.developer,
          type: prop.type, status: prop.status,
          startingPriceAED: prop.startingPriceAED, maxPriceAED: prop.maxPriceAED,
          paymentPlan: prop.paymentPlan, handoverYear: prop.handoverYear,
          expectedRentalYieldPct: prop.roi, unitMix: prop.bedrooms,
          landingUrl: prop.landingUrl,
        },
        // The settled intelligence: stored, timestamped, never regenerated on
        // read. Null when never generated — say so instead of inventing one.
        intelligenceProfile: profile
          ? { generatedAt: profile.generatedAt, stale, dimensions: profile.dimensions }
          : null,
        note: profile
          ? (stale
              ? 'AI-generated profile from this project\'s stored record — its facts changed since generation, so present it as possibly outdated (an operator can regenerate it on the project page).'
              : 'AI-generated profile from this project\'s stored record — reuse its summaries and cited facts instead of re-deriving the case.')
          : 'No stored intelligence profile yet for this project — answer from the listing record only and mention the profile has not been generated.',
      }
    },
  },
  {
    name: 'landing_list', agent: 'landing_agent',
    description: 'List the landing pages (slug, title, status, leads) — the ONE store behind /lp/<slug>.',
    params: '{}', roles: EVERYONE,
    schema: z.object({}),
    run: async () => {
      const rows = await getLandingPagesForDashboard(30)
      return rows.map((r) => ({
        slug: r.slug, headline: r.headline, status: r.status,
        isLiveNow: r.isLiveNow, leads: r.leadCount, views: r.pageViews,
      }))
    },
  },
  {
    name: 'landing_get', agent: 'landing_agent',
    description: 'Load one landing page for review: headline, sections (order/visibility), SEO, publish state. Editor: /freehold-intelligence/inventory/landings/<slug>/edit',
    params: '{ "slug": string }', roles: EVERYONE,
    schema: z.object({ slug: z.string() }),
    run: async (args) => {
      const page = await getLandingPageForEditor(s(args.slug))
      if (!page) return { error: `No landing page with slug "${s(args.slug)}"` }
      return page
    },
  },
  {
    name: 'landing_create', agent: 'landing_agent',
    description: 'Create a NEW landing page for an existing catalog project and return its REAL slug + editor URL. The page is created as a DRAFT: surface editUrl (works now) and tell the user to review & PUBLISH — the public /lp/<slug> link only goes live AFTER publishing. This is the ONLY way to create a landing page; never claim one was created without calling this, and never hand out the public link as live until it is published.',
    params: '{ "project": string, "campaignName"?: string, "template"?: string }',
    roles: ['owner', 'admin', 'marketing', 'sales_manager'],
    schema: z.object({
      project: z.string().describe('project slug or exact name from the catalog'),
      campaignName: z.string().optional().describe('short campaign label, e.g. "golden-visa" or "q3-launch"'),
      template: z.string().optional().describe('template key (classic/luxury/investor/…); defaults to classic'),
    }),
    run: async (args, ctx) => {
      const ref = s(args.project)
      if (!ref) return { error: 'project is required (slug or exact project name)' }
      // Resolve the project the same way listing_get does: slug first, then name.
      let prop = await getInventoryPropertyBySlug(ref)
      if (!prop) {
        const all = await getInventoryPropertiesFromDB()
        prop = all.find((p) => p.name.toLowerCase() === ref.toLowerCase()) ?? null
      }
      if (!prop) return { error: `No catalog project matching "${ref}". Create the project in Inventory first, then a landing page for it.` }
      const result = await createLandingPage({
        projectSlug: prop.slug,
        campaignName: s(args.campaignName) || undefined,
        template: s(args.template) || undefined,
        createdBy: ctx.brokerId ?? undefined,
      })
      if ('error' in result) return result
      return {
        created: true,
        slug: result.slug,
        status: result.status,
        editUrl: result.editUrl,
        publicUrl: result.url,
        note: `Draft landing page created for ${result.projectName}. Open editUrl to review and PUBLISH it — the public link (${result.url}) goes live ONLY after publishing. Do not tell the user the public link works until it is published.`,
      }
    },
  },

  // ── crm_agent ──────────────────────────────────────────────────────────────
  {
    name: 'crm_search_leads', agent: 'crm_agent',
    description: 'Search CRM leads by name/phone/email/project. Brokers see only their own book.',
    params: '{ "q": string }', roles: EVERYONE,
    schema: z.object({ q: z.string().describe('name, phone, email, or project to search for') }),
    run: async (args, ctx) => {
      const q = s(args.q)
      if (!q) return { error: 'q is required' }
      const asRole = ctx.role === 'sales_agent' ? 'broker' as const : 'admin' as const
      const rows = await searchCrmLeads(q, asRole, ctx.brokerId ?? undefined, 10)
      // Exactly one match (the attached-lead case): include the researched
      // smart profile so the expert answers from verified facts — each fact
      // already carries its source and confidence, so the model can cite them
      // instead of guessing who the person is.
      if (rows.length === 1) {
        try {
          const { listProfileFacts } = await import('@/lib/freehold/lead-profile')
          const facts = await listProfileFacts(rows[0].id)
          if (facts.length) {
            return {
              lead: rows[0],
              smartProfile: facts.map((f) => ({
                fact: f.factKey === 'other' && f.factLabel ? f.factLabel : f.factKey,
                value: f.factValue,
                source: f.sourceUrl,
                confidence: f.confidence,
              })),
            }
          }
        } catch (e) {
          console.error('[coordinator] profile attach failed', e)
        }
      }
      return rows
    },
  },

  // ── creative_agent ─────────────────────────────────────────────────────────
  {
    name: 'library_list', agent: 'creative_agent',
    description: 'List the account’s Library assets (reports, notes, creatives, images, videos, pdfs).',
    params: '{ "kind"?: "report"|"note"|"creative"|"image"|"video"|"pdf" }', roles: EVERYONE,
    schema: z.object({
      kind: z.enum(['report', 'note', 'creative', 'image', 'video', 'pdf']).optional().describe('filter assets by kind'),
    }),
    run: async (args, ctx) => {
      const items = await listLibrary(ctx.email, ctx.role, s(args.kind) || undefined)
      return items.slice(0, 20).map((i) => ({ id: i.id, kind: i.kind, title: i.title, createdAt: i.createdAt }))
    },
  },
  {
    name: 'creative_generate_image', agent: 'creative_agent',
    description: 'Generate a REAL marketing image from a prompt (same engine as Creative Studio), save it to the Library, and return the Drive editor path where it can be QR-stamped/edited and then used as ad media.',
    params: '{ "prompt": string, "aspectRatio"?: "1:1"|"4:5"|"9:16"|"16:9" }', roles: OPERATORS,
    schema: z.object({
      prompt: z.string(),
      aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
    }),
    run: async (args, ctx) => {
      const prompt = s(args.prompt)
      if (!prompt) return { error: 'prompt is required' }
      const out = await genImage(prompt, { aspectRatio: s(args.aspectRatio) || undefined })
      const item = await saveLibraryItem(ctx.email, { kind: 'image', title: prompt.slice(0, 80), url: out.url })
      return item
        ? { ok: true, libraryId: item.id, editorPath: `/freehold-intelligence/creative-studio/image/${item.id}` }
        : { error: 'Image generated but could not be saved to the Library.' }
    },
  },

  // ── research_agent ─────────────────────────────────────────────────────────
  {
    name: 'research_save_note', agent: 'research_agent',
    description: 'Save a research note / summary to the Library (kind: note) so it persists beyond the chat.',
    params: '{ "title": string, "content": string }', roles: EVERYONE,
    schema: z.object({ title: z.string(), content: z.string() }),
    run: async (args, ctx) => {
      const title = s(args.title); const content = s(args.content)
      if (!title || !content) return { error: 'title and content are required' }
      const item = await saveLibraryItem(ctx.email, { kind: 'note', title, content })
      return item ? { ok: true, libraryId: item.id } : { error: 'Could not save' }
    },
  },
  // ── Every agent: close the loop by email ───────────────────────────────────
  {
    name: 'email_me', agent: 'research_agent',
    description: 'Email the signed-in user a summary of what was just done (e.g. "campaign setup complete", a report, next steps). Use this to keep the promise "I will email you once I finish" — call it AFTER the work is done, with the real outcome.',
    params: '{ "subject": string, "summary": string, "linkPath"?: string }', roles: EVERYONE,
    schema: z.object({
      subject: z.string(),
      summary: z.string(),
      linkPath: z.string().optional().describe('in-app path to link, e.g. /freehold-intelligence/lead-machine/campaigns'),
    }),
    run: async (args, ctx) => {
      const subject = s(args.subject); const summary = s(args.summary)
      if (!subject || !summary) return { error: 'subject and summary are required' }
      const linkPath = s(args.linkPath)
      const result = await sendSystemEmail({
        to: [ctx.email],
        subject,
        headline: subject,
        lines: summary.split('\n').filter(Boolean).slice(0, 20),
        ...(linkPath && linkPath.startsWith('/') ? { ctaLabel: 'Open in the platform', ctaUrl: `${getSiteUrl()}${linkPath}` } : {}),
      })
      return result.sent
        ? { ok: true, emailedTo: ctx.email }
        : { ok: false, error: 'Email is not configured on this deployment (RESEND_API_KEY missing) — tell the user plainly instead of pretending it sent.' }
    },
  },
]

/** Tools this role may use. */
export function toolsForRole(role: CoordinatorRole): CoordinatorTool[] {
  return COORDINATOR_TOOLS.filter((t) => t.roles.includes(role))
}

/** Render the tool docs block for the system prompt, grouped by specialist. */
export function renderToolDocs(tools: CoordinatorTool[]): string {
  const byAgent = new Map<string, CoordinatorTool[]>()
  for (const t of tools) {
    const list = byAgent.get(t.agent) ?? []
    list.push(t); byAgent.set(t.agent, list)
  }
  const lines: string[] = []
  for (const [agent, list] of byAgent) {
    lines.push(`\n[${agent}]`)
    for (const t of list) {
      lines.push(`- ${t.name}${t.destructive ? ' ⚠destructive' : ''}: ${t.description} args: ${t.params}`)
    }
  }
  return lines.join('\n')
}

/** Parse a model turn that is a tool call: {"tool_call":{"name","args"}}. */
export function parseToolCall(
  raw: string,
  knownNames: string[] = [],
): { name: string; args: Record<string, unknown> } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()

  // 1 — the documented protocol: {"tool_call": {name, args}}
  try {
    const parsed = JSON.parse(trimmed) as { tool_call?: { name?: string; args?: Record<string, unknown> } }
    if (parsed.tool_call?.name) {
      return { name: String(parsed.tool_call.name), args: parsed.tool_call.args ?? {} }
    }
  } catch { /* fall through to the recovery parsers */ }

  // Models drift from the protocol under pressure — recover the obvious
  // shapes instead of leaking tool syntax to the user as a "reply".
  if (knownNames.length) {
    // 2 — protocol JSON embedded in prose
    const embedded = trimmed.match(/\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}/)
    if (embedded) {
      try {
        const parsed = JSON.parse(embedded[0]) as { tool_call?: { name?: string; args?: Record<string, unknown> } }
        if (parsed.tool_call?.name && knownNames.includes(String(parsed.tool_call.name))) {
          return { name: String(parsed.tool_call.name), args: parsed.tool_call.args ?? {} }
        }
      } catch { /* keep going */ }
    }

    // 3 — python/function style: tool_name(arg='v', n=3) — optionally
    // print(...) and optionally specialist-qualified (ads_agent.tool_name(...)
    // — the model sometimes drifts into this dotted form under pressure); the
    // qualifier is discarded, only the real tool name after the dot is matched.
    const fn = trimmed.match(/^(?:print\s*\(\s*)?(?:[a-z][a-z0-9_]*\.)?([a-z][a-z0-9_]*)\s*\(([^)]*)\)/i)
    if (fn && knownNames.includes(fn[1])) {
      const args: Record<string, unknown> = {}
      for (const m of fn[2].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|(true|false)|(-?\d+(?:\.\d+)?))/g)) {
        const key = m[1]
        args[key] = m[2] ?? m[3] ?? (m[4] !== undefined ? m[4] === 'true' : Number(m[5]))
      }
      return { name: fn[1], args }
    }

    // 4 — a bare tool name on its own (possibly repeated on multiple lines)
    const firstLine = trimmed.split(/\n/)[0].trim()
    if (knownNames.includes(firstLine) && trimmed.split(/\s+/).every((w) => knownNames.includes(w))) {
      return { name: firstLine, args: {} }
    }

    // 5 — pseudo-calls ANYWHERE in the reply, including inside an otherwise
    // valid {"blocks":[...]} answer. This is the drift that fabricates: the
    // model "shows its work" as python lines inside a text block, shape 3's
    // ^-anchor never fires (the reply starts with '{'), no tool executes, the
    // code leaks to the user's screen as a message — and the NEXT turn answers
    // the metric question from nothing, with invented CPL/spend/quality
    // numbers. Catching the first known-tool call wherever it appears turns
    // that turn back into a real execution, which is the difference between a
    // grounded answer and a lie. First known tool wins; the loop's
    // TOOL_RESULT feedback and duplicate-breaker handle the rest.
    const nameAlt = knownNames
      .map((tn) => tn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const anywhere = raw.match(new RegExp(
      `(?:print\\s*\\(\\s*)?(?:[a-z][a-z0-9_]*\\.)?(${nameAlt})\\s*\\(([^)]*)\\)`, 'i',
    ))
    if (anywhere && knownNames.includes(anywhere[1])) {
      const args: Record<string, unknown> = {}
      for (const m of anywhere[2].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|(true|false)|(-?\d+(?:\.\d+)?))/g)) {
        args[m[1]] = m[2] ?? m[3] ?? (m[4] !== undefined ? m[4] === 'true' : Number(m[5]))
      }
      return { name: anywhere[1], args }
    }
  }
  return null
}

/** At level 2, actions that ACTIVATE spend still need an explicit human yes. */
const L2_STILL_CONFIRM = new Set(['ads_resume_campaign'])

/**
 * Execute one tool call with role + autonomy enforcement. Never throws.
 *
 * Autonomy policy (server-enforced — the model only sees a description):
 *  L1 advisory        destructive requires args.confirm === true (the model
 *                     proposes an action card first).
 *  L2 semi-autonomous destructive runs unconfirmed EXCEPT spend-activating
 *                     tools; budget deltas clamped to ±15%; every unconfirmed
 *                     destructive action is written to the audit log.
 *  L3 autopilot       destructive runs unconfirmed; same clamp + audit.
 */
export async function runCoordinatorTool(
  tools: CoordinatorTool[],
  call: { name: string; args: Record<string, unknown> },
  ctx: ToolCtx,
): Promise<unknown> {
  let tool = tools.find((t) => t.name === call.name)

  // Qualified spelling: the model writes the tool as "<agent>.<tool>" or
  // "<agent>:<tool>" — e.g. `creative_agent.library_list` — because that is how
  // the tools are PRESENTED to it, grouped under an agent. The intent is
  // unambiguous, so honour it instead of failing. Left unhandled, this burned
  // the whole turn budget on retries and surfaced a raw
  // `Unknown tool "creative_agent.library_list"` to the user, which is exactly
  // the kind of breakage a client notices and never forgets.
  if (!tool) {
    const bare = call.name.split(/[.:]/).pop() ?? ''
    const qualified = tools.find((t) => t.name === bare)
    // Only accept it when the prefix really is that tool's agent (or the tool
    // name alone is unique) — never let a stray prefix silently redirect a call
    // to a different tool than the one named.
    if (qualified && (call.name === `${qualified.agent}.${bare}` || call.name === `${qualified.agent}:${bare}` || !call.name.includes('.'))) {
      tool = qualified
    }
  }

  if (!tool) {
    // Observed drift: the model calls an agent GROUP name ("creative_agent")
    // as if it were a tool, gets a bare "unknown tool", then flails until the
    // turn budget dies. Answer with that agent's real tool list so it
    // self-corrects on the next round instead.
    const agentTools = tools.filter((t) => t.agent === call.name).map((t) => t.name)
    if (agentTools.length) {
      return { error: `"${call.name}" is an agent group, not a tool. Call one of its tools directly: ${agentTools.join(', ')}.` }
    }
    return { error: `Unknown tool "${call.name}" — use only the tools listed for you.` }
  }

  const confirmed = call.args.confirm === true
  if (tool.destructive && !confirmed) {
    const allowed = ctx.autonomy >= 2 && !(ctx.autonomy === 2 && L2_STILL_CONFIRM.has(tool.name))
    if (!allowed) {
      return {
        error: 'confirmation_required',
        hint: 'This action changes live campaigns/money. Ask the user to confirm explicitly, then retry with "confirm": true.',
      }
    }
    // Semi-autonomous budget safety: clamp to ±15% of the CURRENT budget.
    if (tool.name === 'ads_set_adset_budget') {
      try {
        const current = await getAdSet(s(call.args.adSetId))
        const cur = current.daily_budget ? Math.round(Number(current.daily_budget) / 100) : null
        if (cur && cur > 0) {
          const requested = n(call.args.dailyBudgetAED)
          const min = Math.max(50, Math.round(cur * 0.85))
          const max = Math.round(cur * 1.15)
          const clamped = Math.min(max, Math.max(min, requested))
          if (clamped !== requested) call.args = { ...call.args, dailyBudgetAED: clamped, clampedFrom: requested }
        }
      } catch { /* clamp is best-effort; the tool itself still validates */ }
    }
  }

  try {
    const result = await tool.run(call.args, ctx)
    // Audit trail: unconfirmed destructive executions are recorded where the
    // manager already looks (the Library) — the L2/L3 "system alert".
    if (tool.destructive && !confirmed && ctx.autonomy >= 2) {
      // Readable audit note — a manager skims this in the Library, so it's
      // plain lines, not a JSON blob.
      const argLines = Object.entries(call.args ?? {})
        .filter(([k]) => k !== 'confirm')
        .map(([k, v]) => `• ${k.replace(/[_-]+/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join('\n')
      const outcome = result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)
        ? `Failed: ${String((result as Record<string, unknown>).error)}`
        : 'Completed successfully.'
      const summary = `The AI assistant ran "${tool.name}" automatically (autonomy level ${ctx.autonomy}).\n\n${argLines || '(no parameters)'}\n\n${outcome}`.slice(0, 4000)
      await saveLibraryItem(ctx.email, {
        kind: 'note',
        title: `Agent action (L${ctx.autonomy}): ${tool.name}`,
        content: summary,
      }).catch(() => null)
    }
    return result
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Tool failed' }
  }
}
