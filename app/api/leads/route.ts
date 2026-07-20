import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { ensureLeadActivityTable, ensureLeadsTable, getProjectBySlug } from "@/lib/data"
import { handleNewLead } from "@/lib/automation/engine"
import { sendLeadConversion } from "@/lib/meta/capi"
import { parseIntent } from "@/lib/meta/intent"
import { scoreLeadSession } from "@/lib/freehold/behaviour-score"
import {
  getLeadershipLeadRecipients,
  sendInternalLeadAlertEmail,
  sendLeadAcknowledgementEmail,
  sendLeadWhatsAppAlert,
} from "@/lib/transactional-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://freeholdproperty.ae"

// Compare on the last 9 digits so "+971 50 123 4567", "0501234567" and
// "971501234567" all match the same person.
const phoneKey = (value: string) => value.replace(/\D/g, "").slice(-9)

interface ExistingLeadRow {
  id: string
  status: string | null
}

async function findExistingLead(phone: string, email: string): Promise<ExistingLeadRow | null> {
  const digits = phoneKey(phone)
  const normalizedEmail = email.toLowerCase()
  if (!digits && !normalizedEmail) return null
  const rows = await query<ExistingLeadRow>(
    `SELECT id, status FROM freehold_site_leads
     WHERE status NOT IN ('closed', 'converted', 'lost')
       AND (
         ($1 <> '' AND RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9) = $1)
         OR ($2 <> '' AND LOWER(email) = $2)
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [digits, normalizedEmail],
  ).catch(() => [] as ExistingLeadRow[])
  return rows[0] ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const name = toText(body.name)
    const phone = toText(body.phone)
    const email = toText(body.email)
    const budget = toText(body.budget)
    const message = toText(body.message)
    const source = toText(body.source) || `lp:${toText(body.landingSlug)}`
    const projectSlug = toText(body.projectSlug)
    const landingSlug = toText(body.landingSlug)
    const interest = toText(body.interest)

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 })
    }

    const utm = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>
    const device = body.device && typeof body.device === "object" ? body.device : {}
    // Declared intent from the ad click (?intent=, captured first-touch by the
    // LP tracker). Validated against the shared vocabulary — junk becomes ''.
    // Distinct from buyer_intent, which is derived from observed behaviour:
    // click_intent = what the ad promised, buyer_intent = what the visitor did.
    const clickIntent = parseIntent(toText(body.clickIntent)) ?? ""

    await ensureLeadsTable()
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS budget text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_source text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_medium text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_campaign text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_term text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_content text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_id text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS campaign_id text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS referrer text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS device jsonb`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_country text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_region text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_city text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS lp_session_id text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS behaviour_score int`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS buyer_intent text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS purchase_probability int`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS budget_confidence text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS click_intent text`)

    // Repeat inquiry from a known open lead: log it on their timeline
    // instead of creating a duplicate pipeline entry.
    const existing = await findExistingLead(phone, email)
    let leadId: string = randomUUID()
    let isRepeatInquiry = false

    if (existing) {
      isRepeatInquiry = true
      leadId = existing.id
      await ensureLeadActivityTable()
      const inquiryDetail = [
        projectSlug ? `Project: ${projectSlug}` : null,
        landingSlug ? `Landing page: ${landingSlug}` : null,
        interest ? `Interest: ${interest}` : null,
        message ? `Message: ${message}` : null,
        budget ? `Budget: ${budget}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, 'repeat_inquiry', $3, NULL)`,
        [
          randomUUID(),
          leadId,
          inquiryDetail || `New inquiry via ${source || "website"}`,
        ],
      ).catch((error) => console.error("[lp-leads] repeat-inquiry activity failed", error))
      // Fill-if-empty only: the first declared ad intent stays the record —
      // a later click from a different ad never overwrites it.
      await query(
        `UPDATE freehold_site_leads
           SET updated_at = now(),
               click_intent = COALESCE(click_intent, NULLIF($2, ''))
         WHERE id = $1`,
        [leadId, clickIntent],
      ).catch(() => undefined)
    }

    // Layer 8 → Layer 9: score the landing session this lead came from.
    // Fail-soft by design (see scoreLeadSession) — never blocks intake.
    const intel = isRepeatInquiry
      ? { behaviourScore: null, buyerIntent: null, purchaseProbability: null, budgetConfidence: null }
      : await scoreLeadSession(toText(body.sessionId))

    // A repeat inquiry from a lead that never got a behaviour score (first
    // visit had no session join) is a second chance at the SAME real signal —
    // score the new session and fill the still-empty fields. Never overwrite
    // an existing score: the first-session read stays the record.
    if (isRepeatInquiry && toText(body.sessionId)) {
      const late = await scoreLeadSession(toText(body.sessionId))
      if (late.behaviourScore !== null) {
        await query(
          `UPDATE freehold_site_leads SET
             lp_session_id = COALESCE(lp_session_id, NULLIF($2, '')),
             behaviour_score = COALESCE(behaviour_score, $3),
             buyer_intent = COALESCE(buyer_intent, NULLIF($4, '')),
             purchase_probability = COALESCE(purchase_probability, $5),
             budget_confidence = COALESCE(budget_confidence, NULLIF($6, ''))
           WHERE id = $1 AND behaviour_score IS NULL`,
          [leadId, toText(body.sessionId), late.behaviourScore, toText(late.buyerIntent), late.purchaseProbability, toText(late.budgetConfidence)],
        ).catch((error) => console.error("[lp-leads] late behaviour score failed", error))
      }
    }

    if (!isRepeatInquiry) await query(
      `INSERT INTO freehold_site_leads (
        id, name, phone, email, source, project_slug, landing_slug, interest, message, budget, status,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
        referrer, device, geo_country, geo_region, geo_city, campaign_id,
        lp_session_id, behaviour_score, buyer_intent, purchase_probability, budget_confidence,
        click_intent,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, NULLIF($4, ''), $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), 'new',
        NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''), NULLIF($15, ''), NULLIF($16, ''),
        NULLIF($17, ''), $18::jsonb, NULLIF($19, ''), NULLIF($20, ''), NULLIF($21, ''), NULLIF($13, ''),
        NULLIF($22, ''), $23, NULLIF($24, ''), $25, NULLIF($26, ''),
        NULLIF($27, ''),
        now(), now()
      )`,
      [
        leadId,
        name,
        phone,
        email,
        source,
        projectSlug,
        landingSlug,
        interest,
        message,
        budget,
        toText(utm.source),
        toText(utm.medium),
        toText(utm.campaign),
        toText(utm.term),
        toText(utm.content),
        toText(utm.id),
        toText(body.referrer),
        JSON.stringify(device),
        toText(req.headers.get("x-vercel-ip-country")),
        toText(req.headers.get("x-vercel-ip-country-region")),
        toText(req.headers.get("x-vercel-ip-city")),
        toText(body.sessionId),
        intel.behaviourScore,
        toText(intel.buyerIntent),
        intel.purchaseProbability,
        toText(intel.budgetConfidence),
        clickIntent,
      ],
    )

    // Run the automation engine for brand-new leads: auto-distribution + any
    // matching lead.created rules. Never throws — intake must not be blocked.
    if (!isRepeatInquiry) {
      await handleNewLead(leadId)
    }

    const project = projectSlug ? await getProjectBySlug(projectSlug) : null
    const projects = project
      ? [
          {
            slug: project.slug,
            name: project.name,
            area: project.location.area,
            priceFrom: project.units?.[0]?.priceFrom ?? null,
            roi: project.investmentHighlights.expectedROI ?? null,
            brochureUrl: project.brochure || null,
            projectUrl: `${baseUrl}/projects/${project.slug}`,
          },
        ]
      : []

    const leadershipRecipients = await getLeadershipLeadRecipients()
    const notificationTasks: Array<Promise<unknown>> = []

    // Server-side Meta conversion (CAPI) — same event_id as the browser
    // pixel's Lead event so Meta dedups the pair; survives ad blockers and
    // iOS privacy where the browser event is dropped. Fire-and-forget: ad
    // plumbing must never block or fail lead intake.
    notificationTasks.push(
      sendLeadConversion({
        eventId: toText(body.eventId) || leadId,
        email,
        phone,
        sourceUrl: landingSlug ? `${baseUrl}/lp/${landingSlug}` : toText(body.referrer) || undefined,
        clientIp: toText(req.headers.get("x-forwarded-for")).split(",")[0].trim() || undefined,
        userAgent: toText(req.headers.get("user-agent")) || undefined,
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value,
        contentName: project?.name || projectSlug || landingSlug || undefined,
      }),
    )

    if (email) {
      notificationTasks.push(
        sendLeadAcknowledgementEmail({
          to: email,
          name,
          inquiry: message || interest || `Inquiry for ${project?.name || "Dubai property"}`,
          projects,
        }).catch((error) => {
          console.error("[lp-leads] lead acknowledgement failed", error)
          return { sent: false }
        }),
      )
    }

    if (leadershipRecipients.emails.length) {
      notificationTasks.push(
        sendInternalLeadAlertEmail({
          to: leadershipRecipients.emails,
          subject: isRepeatInquiry ? "Repeat inquiry from existing lead" : "New lead registered",
          headline: isRepeatInquiry ? "Repeat inquiry from existing lead" : "New lead registered",
          lead: {
            name,
            email: email || null,
            phone,
            source,
            projectSlug: projectSlug || null,
            message: message || interest || null,
          },
          projects,
        }).catch((error) => {
          console.error("[lp-leads] internal email failed", error)
          return { sent: false }
        }),
      )
    }

    if (leadershipRecipients.whatsappTargets.length) {
      notificationTasks.push(
        sendLeadWhatsAppAlert({
          recipients: leadershipRecipients.recipients.map((recipient) => ({
            name: recipient.name,
            email: recipient.email,
            phone: recipient.phone,
            orgTitle: recipient.orgTitle,
          })),
          lead: {
            name,
            email: email || null,
            phone,
            source,
            projectSlug: projectSlug || null,
            message: message || interest || null,
          },
          projects,
        }).catch((error) => {
          console.error("[lp-leads] whatsapp alert failed", error)
          return { sent: false }
        }),
      )
    }

    await Promise.allSettled(notificationTasks)

    return NextResponse.json({ ok: true, id: leadId, repeat: isRepeatInquiry })
  } catch (error) {
    console.error("[lp-leads] create error", error)
    return NextResponse.json({ error: "Unable to capture lead" }, { status: 500 })
  }
}
