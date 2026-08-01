import { query } from "@/lib/db"
import { BRAND } from "@/lib/freehold/brand"
import { getSiteUrl } from "@/lib/site"
import { ensureUsersTable } from "@/lib/data"

interface ShortProjectEmailItem {
  slug: string
  name: string
  area?: string | null
  priceFrom?: number | null
  roi?: number | null
  brochureUrl?: string | null
  projectUrl?: string | null
}

interface LeadAckEmailInput {
  to: string
  name?: string | null
  inquiry?: string
  projects?: ShortProjectEmailItem[]
}

interface LeadershipRecipient {
  name: string | null
  email: string | null
  phone: string | null
  orgTitle: string | null
}

const baseUrl = getSiteUrl()
const resendApiKey = process.env.RESEND_API_KEY?.trim() || ""
const fromEmail =
  process.env.LEADS_FROM_EMAIL?.trim() ||
  process.env.NOTIFICATIONS_FROM_EMAIL?.trim() ||
  `${BRAND.emailFrom} <hello@${BRAND.domain}>`
const whatsappWebhookUrl =
  process.env.LEADS_WHATSAPP_WEBHOOK_URL?.trim() ||
  process.env.CRM_WHATSAPP_WEBHOOK_URL?.trim() ||
  ""

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    ),
  )

const uniquePhones = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").replace(/[^\d+]/g, ""))
        .filter(Boolean),
    ),
  )

const formatAed = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resendApiKey || !to) {
    return { sent: false, reason: "missing-config" as const }
  }
  const text = `We received a request to reset your ${BRAND.company} password.

Reset it here (valid for 1 hour): ${resetUrl}

If you didn't request this, you can safely ignore this email.

${BRAND.company} Real Estate`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>We received a request to reset your <strong>${BRAND.company}</strong> password.</p>
      <p><a href="${resetUrl}">Reset your password</a> — this link is valid for 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>${BRAND.company} Real Estate</p>
    </div>`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [to], subject: `Reset your ${BRAND.company} password`, text, html }),
  })
  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[email] reset error", payload)
    return { sent: false, reason: "provider-error" as const }
  }
  return { sent: true as const }
}

export async function sendPasswordChangedEmail(to: string) {
  if (!resendApiKey || !to) return { sent: false, reason: "missing-config" as const }
  const text = `Your ${BRAND.company} password was just changed.

If this was you, no action is needed. If you did not do this, reset your password immediately at ${baseUrl}/crm/login and contact your administrator.

${BRAND.company} Real Estate`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Your <strong>${BRAND.company}</strong> password was just changed.</p>
      <p>If this was you, no action is needed. If you did not do this, <a href="${baseUrl}/crm/login">reset your password immediately</a> and contact your administrator.</p>
      <p>${BRAND.company} Real Estate</p>
    </div>`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [to], subject: `Your ${BRAND.company} password was changed`, text, html }),
  })
  if (!response.ok) {
    console.error("[email] password-changed error", await response.text().catch(() => ""))
    return { sent: false, reason: "provider-error" as const }
  }
  return { sent: true as const }
}

/** Warn a broker that their ad-credit balance is nearly exhausted. */
export async function notifyBrokerLowCredits(brokerId: string, balance: number) {
  if (!brokerId) return { sent: false as const }
  try {
    const rows = await query<{ name: string | null; email: string | null }>(
      `SELECT name, email FROM freehold_site_users WHERE id::text = $1 OR lower(email) = lower($1) LIMIT 1`,
      [brokerId],
    ).catch(() => [])
    const to = rows[0]?.email
    if (!to) return { sent: false as const, reason: "no-broker-email" }
    if (!resendApiKey) return { sent: false as const, reason: "missing-config" }
    const url = `${baseUrl}/freehold-intelligence/agent/credits`
    const text = `Hi ${rows[0]?.name ?? ""},

Your ad-credit balance is down to ${balance} credit${balance === 1 ? "" : "s"}. Campaign launches will be refused once it runs out.

Top up or request an allocation: ${url}

${BRAND.company}`
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <p>Hi ${rows[0]?.name ?? ""},</p>
        <p>Your ad-credit balance is down to <strong>${balance}</strong> credit${balance === 1 ? "" : "s"}. Campaign launches will be refused once it runs out.</p>
        <p><a href="${url}">Top up or request an allocation →</a></p>
        <p>${BRAND.company}</p>
      </div>`
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [to], subject: `Low ad credits: ${balance} left`, text, html }),
    })
    if (!response.ok) return { sent: false as const, reason: "provider-error" }
    return { sent: true as const }
  } catch (err) {
    console.error("[notify] low-credits failed", err)
    return { sent: false as const }
  }
}

export async function sendLeadAssignedEmail(
  to: string,
  brokerName: string,
  lead: { id: string; name?: string | null; phone?: string | null; interest?: string | null; source?: string | null },
) {
  if (!resendApiKey || !to) return { sent: false, reason: "missing-config" as const }
  const leadUrl = `${baseUrl}/freehold-intelligence/crm/leads/${lead.id}`
  const who = lead.name?.trim() || "A new lead"
  const lines = [
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.interest ? `Interest: ${lead.interest}` : "",
    lead.source ? `Source: ${lead.source}` : "",
  ].filter(Boolean)
  const text = `${brokerName ? `Hi ${brokerName},` : "Hi,"}

${who} has been assigned to you.
${lines.join("\n")}

Open the lead: ${leadUrl}

Respond fast — speed-to-lead wins deals.
${BRAND.company}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>${brokerName ? `Hi ${brokerName},` : "Hi,"}</p>
      <p><strong>${who}</strong> has been assigned to you.</p>
      ${lines.length ? `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}
      <p><a href="${leadUrl}">Open the lead →</a></p>
      <p style="color:#6b7280">Respond fast — speed-to-lead wins deals.</p>
      <p>${BRAND.company}</p>
    </div>`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [to], subject: `New lead assigned: ${who}`, text, html }),
  })
  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[email] lead-assigned error", payload)
    return { sent: false, reason: "provider-error" as const }
  }
  return { sent: true as const }
}

/**
 * Resolve a broker (assigned_broker_id may be a user id, email, or slug) and
 * email them that a lead is now theirs. Best-effort; never throws.
 */
export async function notifyBrokerOfAssignedLead(brokerId: string, leadId: string) {
  if (!brokerId || !leadId) return { sent: false as const }
  try {
    const brokerRows = await query<{ name: string | null; email: string | null }>(
      `SELECT name, email FROM freehold_site_users WHERE id::text = $1 OR lower(email) = lower($1) LIMIT 1`,
      [brokerId],
    ).catch(() => [])
    const to = brokerRows[0]?.email
    if (!to) return { sent: false as const, reason: "no-broker-email" }
    const leadRows = await query<{ name: string | null; phone: string | null; interest: string | null; project_slug: string | null; source: string | null }>(
      `SELECT name, phone, interest, project_slug, source FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
      [leadId],
    ).catch(() => [])
    const lead = leadRows[0]
    if (!lead) return { sent: false as const }
    // The movement feed: the brand inbox learns about every assignment the
    // moment the broker does. Fire-and-forget — the broker's email is the one
    // that must not fail silently here.
    void emailLeadMovementToInbox("assigned", { id: leadId, name: lead.name },
      `assigned to ${brokerRows[0]?.name || to}`)
    return await sendLeadAssignedEmail(to, brokerRows[0]?.name ?? "", {
      id: leadId,
      name: lead.name,
      phone: lead.phone,
      interest: lead.interest ?? lead.project_slug,
      source: lead.source,
    })
  } catch (err) {
    console.error("[notify] broker assignment failed", err)
    return { sent: false as const }
  }
}

export async function sendLeadAcknowledgementEmail(input: LeadAckEmailInput) {
  if (!resendApiKey || !input.to) {
    return { sent: false, reason: "missing-config" as const }
  }

  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,"
  const projects = Array.isArray(input.projects) ? input.projects.slice(0, 3) : []
  const projectText = projects.length
    ? projects
        .map((project) => {
          const priceText =
            typeof project.priceFrom === "number" && project.priceFrom > 0
              ? ` from ${formatAed(project.priceFrom)}`
              : ""
          const roiText =
            typeof project.roi === "number" && Number.isFinite(project.roi)
              ? ` • ${project.roi.toFixed(1)}% ROI`
              : ""
          const links = [project.projectUrl ? `Page: ${project.projectUrl}` : "", project.brochureUrl ? `Brochure: ${project.brochureUrl}` : ""]
            .filter(Boolean)
            .join(" | ")
          return `- ${project.name}${project.area ? ` (${project.area})` : ""}${priceText}${roiText}${links ? ` | ${links}` : ""}`
        })
        .join("\n")
    : "- A senior consultant will share the most relevant projects shortly."

  const projectHtml = projects.length
    ? `<ul>${projects
        .map((project) => {
          const priceText =
            typeof project.priceFrom === "number" && project.priceFrom > 0
              ? ` from ${formatAed(project.priceFrom)}`
              : ""
          const roiText =
            typeof project.roi === "number" && Number.isFinite(project.roi)
              ? ` • ${project.roi.toFixed(1)}% ROI`
              : ""
          const projectLink = project.projectUrl
            ? ` <a href="${project.projectUrl}">Project page</a>`
            : ""
          const brochureLink = project.brochureUrl
            ? ` <a href="${project.brochureUrl}">Brochure</a>`
            : ""
          return `<li><strong>${project.name}</strong>${project.area ? ` (${project.area})` : ""}${priceText}${roiText}${projectLink}${brochureLink ? ` · ${brochureLink}` : ""}</li>`
        })
        .join("")}</ul>`
    : "<p>A senior consultant will share the most relevant projects shortly.</p>"

  const text = `${greeting}

Thank you for contacting ${BRAND.company}. Your request has been received and one of our consultants will contact you shortly.

${input.inquiry ? `Your request: ${input.inquiry}\n` : ""}Shortlist:
${projectText}

You can also continue the conversation here: ${baseUrl}/chat

${BRAND.company} Real Estate`

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>${greeting}</p>
      <p>Thank you for contacting <strong>${BRAND.company}</strong>. Your request has been received and one of our consultants will contact you shortly.</p>
      ${input.inquiry ? `<p><strong>Your request:</strong> ${input.inquiry}</p>` : ""}
      <p><strong>Shortlist</strong></p>
      ${projectHtml}
      <p><a href="${baseUrl}/chat">Continue with the AI assistant</a></p>
      <p>${BRAND.company} Real Estate</p>
    </div>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: `${BRAND.company} received your inquiry`,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[email] resend error", payload)
    return { sent: false, reason: "provider-error" as const }
  }

  return { sent: true as const }
}

export async function sendInternalLeadAlertEmail(input: {
  to: string[]
  subject?: string
  headline?: string
  lead: {
    name?: string | null
    email?: string | null
    phone?: string | null
    source?: string | null
    projectSlug?: string | null
    message?: string | null
  }
  projects?: ShortProjectEmailItem[]
}) {
  if (!resendApiKey || !input.to.length) {
    return { sent: false, reason: "missing-config" as const }
  }

  const projectLines = (input.projects || [])
    .slice(0, 3)
    .map((project) => {
      const page = project.projectUrl ? ` | ${project.projectUrl}` : ""
      return `- ${project.name}${project.area ? ` (${project.area})` : ""}${page}`
    })
    .join("\n")

  const headline = input.headline?.trim() || "New lead registered"
  const subject = input.subject?.trim() || headline
  const text = `${headline}

Name: ${input.lead.name || "Unknown"}
Phone: ${input.lead.phone || "—"}
Email: ${input.lead.email || "—"}
Source: ${input.lead.source || "ai-chat"}
Project: ${input.lead.projectSlug || "—"}
Message: ${input.lead.message || "—"}

Shortlist:
${projectLines || "- No shortlist attached"}
`

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p><strong>${headline}</strong></p>
      <p>Name: ${input.lead.name || "Unknown"}<br/>
      Phone: ${input.lead.phone || "—"}<br/>
      Email: ${input.lead.email || "—"}<br/>
      Source: ${input.lead.source || "ai-chat"}<br/>
      Project: ${input.lead.projectSlug || "—"}</p>
      <p><strong>Message</strong><br/>${input.lead.message || "—"}</p>
      <p><strong>Shortlist</strong></p>
      <ul>${(input.projects || [])
        .slice(0, 3)
        .map(
          (project) =>
            `<li>${project.name}${project.area ? ` (${project.area})` : ""}${project.projectUrl ? ` · <a href="${project.projectUrl}">Project page</a>` : ""}</li>`,
        )
        .join("")}</ul>
    </div>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[email] internal resend error", payload)
    return { sent: false, reason: "provider-error" as const }
  }

  return { sent: true as const }
}

export interface FollowUpDigestLead {
  name: string | null
  phone: string | null
  status: string | null
  source: string | null
  daysOverdue: number
  leadUrl: string
}

export async function sendFollowUpDigestEmail(input: {
  to: string[]
  recipientName?: string | null
  leads: FollowUpDigestLead[]
}) {
  if (!resendApiKey || !input.to.length || !input.leads.length) {
    return { sent: false, reason: "missing-config" as const }
  }

  const greeting = input.recipientName?.trim() ? `Hi ${input.recipientName.trim()},` : "Hi,"
  const count = input.leads.length
  const subject = `${count} lead${count === 1 ? "" : "s"} waiting on follow-up`

  const text = `${greeting}

The following lead${count === 1 ? " has" : "s have"} had no contact for over 48 hours:

${input.leads
  .map(
    (lead) =>
      `- ${lead.name || "Unknown"} | ${lead.phone || "—"} | ${lead.status || "new"} | ${lead.daysOverdue}d overdue | ${lead.leadUrl}`,
  )
  .join("\n")}

Open the CRM to follow up: ${baseUrl}/crm/leads
`

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>${greeting}</p>
      <p>The following lead${count === 1 ? " has" : "s have"} had no contact for over 48 hours:</p>
      <ul>${input.leads
        .map(
          (lead) =>
            `<li><a href="${lead.leadUrl}">${lead.name || "Unknown"}</a> · ${lead.phone || "—"} · ${lead.status || "new"} · ${lead.daysOverdue}d overdue</li>`,
        )
        .join("")}</ul>
      <p><a href="${baseUrl}/crm/leads">Open the CRM</a> to follow up.</p>
    </div>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[email] follow-up digest resend error", payload)
    return { sent: false, reason: "provider-error" as const }
  }

  return { sent: true as const }
}


/* ── System-alive layer ───────────────────────────────────────────────────────
 * One generic branded sender that every automated notification goes through,
 * plus the lead-movement feed to the brand inbox. The platform produced these
 * events all along; this is the layer that makes it SPEAK.
 */

export async function sendSystemEmail(input: {
  to: string[]
  subject: string
  headline: string
  lines?: string[]
  ctaLabel?: string
  ctaUrl?: string
}) {
  const to = uniqueValues(input.to)
  if (!resendApiKey || !to.length) return { sent: false, reason: "missing-config" as const }
  const lines = (input.lines ?? []).filter(Boolean)
  const text = `${input.headline}

${lines.join("\n")}
${input.ctaUrl ? `\n${input.ctaLabel || "Open"}: ${input.ctaUrl}` : ""}

${BRAND.company}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p><strong>${input.headline}</strong></p>
      ${lines.length ? `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}
      ${input.ctaUrl ? `<p><a href="${input.ctaUrl}" style="color:#B8860B">${input.ctaLabel || "Open"} →</a></p>` : ""}
      <p style="color:#6b7280">${BRAND.company}</p>
    </div>`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to, subject: input.subject, text, html }),
  })
  if (!response.ok) {
    console.error("[email] system email error", await response.text().catch(() => ""))
    return { sent: false, reason: "provider-error" as const }
  }
  return { sent: true as const }
}

/**
 * Lead-movement feed: every step of a lead's life lands in the brand inbox
 * (info@<domain>), so the company has one running record of new / assigned /
 * reassigned / stage changes without anyone watching a dashboard.
 * Best-effort; never throws into the mutation that triggered it.
 */
export async function emailLeadMovementToInbox(
  kind: "assigned" | "unassigned" | "stage" | "priority",
  lead: { id: string; name?: string | null },
  detail: string,
) {
  try {
    const inbox = BRAND.email?.trim()
    if (!inbox) return { sent: false as const }
    const who = lead.name?.trim() || "Lead"
    return await sendSystemEmail({
      to: [inbox],
      subject: `Lead update: ${who} — ${detail}`,
      headline: `${who}: ${detail}`,
      ctaLabel: "Open the lead",
      ctaUrl: `${baseUrl}/freehold-intelligence/crm/leads/${lead.id}`,
    })
  } catch (err) {
    console.error("[email] lead movement failed", err)
    return { sent: false as const }
  }
}

/** "Your design is ready" — sent to whoever exported a design/brochure, with
 *  the way back to it. A creator should not have to remember where it went. */
export async function sendDesignReadyEmail(to: string, title: string, directUrl?: string | null) {
  try {
    if (!to) return { sent: false as const }
    return await sendSystemEmail({
      to: [to],
      subject: `Your design is ready: ${title}`,
      headline: `“${title}” has been saved to your Drive.`,
      lines: directUrl && /^https:\/\//.test(directUrl) ? [`Direct download: ${directUrl}`] : [],
      ctaLabel: "Open your Drive library",
      ctaUrl: `${baseUrl}/freehold-intelligence/drive/library`,
    })
  } catch (err) {
    console.error("[email] design ready failed", err)
    return { sent: false as const }
  }
}

export async function getLeadershipLeadRecipients() {
  // The brand inbox (info@<domain>, per-tenant via NEXT_PUBLIC_BRAND_EMAIL) is
  // a GUARANTEED recipient of every lead alert — appended to whatever else is
  // configured, never replacing it. Before this, alert delivery depended
  // entirely on env vars or leadership rows existing; with neither, a lead
  // arrived on time and was announced to nobody. The company's own public
  // inbox is the one address that always exists, so it is the floor.
  const brandInbox = BRAND.email?.trim() || ""

  // The branch test below must see only the ENV-configured values: if the
  // brand inbox were mixed in first, this branch would always win and the
  // leadership-users fallback underneath would silently become dead code.
  const envEmails = uniqueValues(
    (
      process.env.LEADS_NOTIFICATION_EMAIL ||
      process.env.CRM_NOTIFICATION_EMAIL ||
      process.env.SALES_NOTIFICATION_EMAIL ||
      ""
    ).split(","),
  )

  const configuredPhones = uniquePhones((process.env.LEADS_NOTIFICATION_WHATSAPP || "").split(","))

  if (envEmails.length || configuredPhones.length) {
    const configuredEmails = uniqueValues([...envEmails, brandInbox])
    return {
      emails: configuredEmails,
      whatsappTargets: configuredPhones,
      recipients: configuredEmails.map((email) => ({
        name: email.split("@")[0],
        email,
        phone: null,
        orgTitle: "Leadership",
      })),
    }
  }

  await ensureUsersTable()
  const rows = await query<LeadershipRecipient>(
    `SELECT name, email, phone, org_title AS "orgTitle"
     FROM freehold_site_users
     WHERE lower(COALESCE(role, '')) IN ('ceo', 'admin', 'director', 'sales_manager')`,
  )

  const recipients = rows.filter(
    (row) => Boolean(row.email?.trim()) || Boolean(String(row.phone || "").replace(/[^\d+]/g, "")),
  )

  return {
    // Brand inbox stays on the list even when recipients come from the users
    // table — the guarantee must not depend on which branch resolved.
    emails: uniqueValues([...recipients.map((row) => row.email), brandInbox]),
    whatsappTargets: uniquePhones(recipients.map((row) => row.phone)),
    recipients,
  }
}

export async function sendLeadWhatsAppAlert(input: {
  recipients: Array<{
    name?: string | null
    email?: string | null
    phone?: string | null
    orgTitle?: string | null
  }>
  lead: {
    name?: string | null
    email?: string | null
    phone?: string | null
    source?: string | null
    projectSlug?: string | null
    message?: string | null
  }
  projects?: ShortProjectEmailItem[]
}) {
  const phones = uniquePhones(input.recipients.map((recipient) => recipient.phone))
  if (!whatsappWebhookUrl || !phones.length) {
    return { sent: false, reason: "missing-config" as const }
  }

  const projectSummary = (input.projects || [])
    .slice(0, 3)
    .map((project) => `${project.name}${project.area ? ` (${project.area})` : ""}`)
    .join(", ")

  const textLines = [
    "New lead registered",
    `Name: ${input.lead.name || "Unknown"}`,
    `Phone: ${input.lead.phone || "—"}`,
    `Email: ${input.lead.email || "—"}`,
    `Source: ${input.lead.source || "website"}`,
    `Project: ${input.lead.projectSlug || "—"}`,
    `Message: ${input.lead.message || "—"}`,
    `Shortlist: ${projectSummary || "No shortlist attached"}`,
  ]

  const response = await fetch(whatsappWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "lead_registered",
      channel: "whatsapp",
      targets: phones,
      recipients: input.recipients,
      lead: input.lead,
      projects: input.projects || [],
      text: textLines.join("\n"),
    }),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    console.error("[whatsapp] webhook error", payload)
    return { sent: false, reason: "provider-error" as const }
  }

  return { sent: true as const }
}
