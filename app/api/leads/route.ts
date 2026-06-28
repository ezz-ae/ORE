import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { ensureLeadActivityTable, ensureLeadsTable, getProjectBySlug } from "@/lib/data"
import { handleNewLead } from "@/lib/automation/engine"
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
     WHERE status NOT IN ('closed', 'lost')
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

    await ensureLeadsTable()
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS budget text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_source text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_medium text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_campaign text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_term text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_content text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_id text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS referrer text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS device jsonb`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_country text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_region text`)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS geo_city text`)

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
      await query(`UPDATE freehold_site_leads SET updated_at = now() WHERE id = $1`, [leadId]).catch(
        () => undefined,
      )
    }

    if (!isRepeatInquiry) await query(
      `INSERT INTO freehold_site_leads (
        id, name, phone, email, source, project_slug, landing_slug, interest, message, budget, status,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
        referrer, device, geo_country, geo_region, geo_city, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, NULLIF($4, ''), $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), 'new',
        NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''), NULLIF($15, ''), NULLIF($16, ''),
        NULLIF($17, ''), $18::jsonb, NULLIF($19, ''), NULLIF($20, ''), NULLIF($21, ''), now(), now()
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
