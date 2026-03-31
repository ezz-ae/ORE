import { query } from "@/lib/db"
import { ensureUsersTable } from "@/lib/ore"

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

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://orerealestate.ae"
const resendApiKey = process.env.RESEND_API_KEY?.trim() || ""
const fromEmail =
  process.env.LEADS_FROM_EMAIL?.trim() ||
  process.env.NOTIFICATIONS_FROM_EMAIL?.trim() ||
  "ORE <hello@orerealestate.ae>"
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

Thank you for contacting ORE. Your request has been received and one of our consultants will contact you shortly.

${input.inquiry ? `Your request: ${input.inquiry}\n` : ""}Shortlist:
${projectText}

You can also continue the conversation here: ${baseUrl}/chat

ORE Real Estate`

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>${greeting}</p>
      <p>Thank you for contacting <strong>ORE</strong>. Your request has been received and one of our consultants will contact you shortly.</p>
      ${input.inquiry ? `<p><strong>Your request:</strong> ${input.inquiry}</p>` : ""}
      <p><strong>Shortlist</strong></p>
      ${projectHtml}
      <p><a href="${baseUrl}/chat">Continue with the AI assistant</a></p>
      <p>ORE Real Estate</p>
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
      subject: "ORE received your inquiry",
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

export async function getLeadershipLeadRecipients() {
  const configuredEmails = uniqueValues(
    (
      process.env.LEADS_NOTIFICATION_EMAIL ||
      process.env.CRM_NOTIFICATION_EMAIL ||
      process.env.SALES_NOTIFICATION_EMAIL ||
      ""
    ).split(","),
  )

  const configuredPhones = uniquePhones((process.env.LEADS_NOTIFICATION_WHATSAPP || "").split(","))

  if (configuredEmails.length || configuredPhones.length) {
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
     FROM gc_users
     WHERE regexp_replace(lower(COALESCE(org_title, role, '')), '\s+', '_', 'g') IN ('ceo', 'general_manager')`,
  )

  const recipients = rows.filter(
    (row) => Boolean(row.email?.trim()) || Boolean(String(row.phone || "").replace(/[^\d+]/g, "")),
  )

  return {
    emails: uniqueValues(recipients.map((row) => row.email)),
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
