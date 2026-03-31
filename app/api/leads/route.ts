import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { ensureLeadsTable, getProjectBySlug } from "@/lib/ore"
import {
  getLeadershipLeadRecipients,
  sendInternalLeadAlertEmail,
  sendLeadAcknowledgementEmail,
  sendLeadWhatsAppAlert,
} from "@/lib/transactional-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://orerealestate.ae"

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
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS budget text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_source text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_medium text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_campaign text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_term text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_content text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS utm_id text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS referrer text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS device jsonb`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS geo_country text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS geo_region text`)
    await query(`ALTER TABLE gc_leads ADD COLUMN IF NOT EXISTS geo_city text`)

    const leadId = randomUUID()
    await query(
      `INSERT INTO gc_leads (
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
          subject: "New lead registered",
          headline: "New lead registered",
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

    return NextResponse.json({ ok: true, id: leadId })
  } catch (error) {
    console.error("[lp-leads] create error", error)
    return NextResponse.json({ error: "Unable to capture lead" }, { status: 500 })
  }
}
