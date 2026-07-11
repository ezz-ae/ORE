import { query } from '@/lib/db'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { listConversations } from '@/lib/freehold/notebook-conversations'

/**
 * Build a grounding-context string for the Notebook AI from the sources the user
 * actually selected in the left panel. Before this, the source checkboxes were
 * decorative — the chat ignored them. Now "Live Projects" injects real inventory,
 * "CRM Leads" injects a real pipeline summary, and pasted "Uploads" URLs are
 * listed as references, so the toggles change what the AI can see.
 */

export type NotebookSources = {
  live_projects?: boolean
  crm_leads?: boolean
  uploads?: boolean
  all_conversations?: boolean
}

const MAX_PROJECTS = 15

function fmtAED(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`
  return `AED ${n}`
}

async function projectsBlock(): Promise<string | null> {
  const props = await getInventoryPropertiesFromDB()
  if (!props.length) return null
  const lines = props.slice(0, MAX_PROJECTS).map((p) => {
    const price =
      p.startingPriceAED != null
        ? `${fmtAED(p.startingPriceAED)}${p.maxPriceAED ? `–${fmtAED(p.maxPriceAED)}` : ''}`
        : '—'
    const handover = p.handoverYear ? `handover ${p.handoverYear}` : 'handover TBC'
    const roi = p.roi != null ? `, ~${p.roi}% ROI` : ''
    const avail = p.availableUnits != null ? `, ${p.availableUnits} units available` : ''
    return `- ${p.name} — ${p.area}, by ${p.developer} (${p.type}); ${price}; ${p.bedrooms}; ${handover}${roi}${avail}`
  })
  const more = props.length > MAX_PROJECTS ? `\n(+${props.length - MAX_PROJECTS} more projects in inventory)` : ''
  return `LIVE PROJECTS (${props.length} total, real inventory):\n${lines.join('\n')}${more}`
}

async function leadsBlock(): Promise<string | null> {
  try {
    const rows = await query<{ status: string | null; n: string }>(
      `SELECT COALESCE(status, 'new') AS status, COUNT(*)::text AS n
       FROM freehold_site_leads
       GROUP BY COALESCE(status, 'new')
       ORDER BY COUNT(*) DESC`,
    )
    const total = rows.reduce((s, r) => s + Number(r.n || 0), 0)
    if (total === 0) return 'CRM LEADS: no leads in the pipeline yet.'
    const breakdown = rows.map((r) => `${r.status}: ${r.n}`).join(', ')
    return `CRM LEADS (${total} total, real pipeline):\n${breakdown}`
  } catch {
    return null
  }
}

// "All Conversations" — the panel's default-on source. Injects the user's
// recent thread titles + last exchange so the AI can reference earlier work.
async function conversationsBlock(email: string): Promise<string | null> {
  try {
    const convs = await listConversations(email)
    if (!convs.length) return null
    const lines = convs.slice(0, 8).map((c) => {
      const last = c.messages[c.messages.length - 1]
      const snippet = last ? ` — last: ${last.content.replace(/\s+/g, ' ').slice(0, 140)}` : ''
      return `- "${c.title}" (${c.messages.length} messages)${snippet}`
    })
    return `EARLIER NOTEBOOK THREADS (the user's own, most recent first):\n${lines.join('\n')}`
  } catch {
    return null
  }
}

export type NotebookUpload = { name: string; content?: string }

function uploadsBlock(uploads: NotebookUpload[]): string | null {
  const clean = uploads.filter((u) => u?.name?.trim())
  if (!clean.length) return null
  const lines = clean.slice(0, 20).map((u) => {
    if (u.content && u.content.trim()) {
      const snippet = u.content.trim().slice(0, 4000)
      return `- ${u.name}:\n${snippet}`
    }
    return `- ${u.name} (attached — content not extracted; treat as a pointer the user may quote)`
  })
  return `ATTACHED SOURCES the user added:\n${lines.join('\n\n')}`
}

/**
 * Returns a context string to prepend to the system prompt, or '' when no
 * data-bearing source is selected.
 */
export async function buildNotebookContext(
  sources: NotebookSources | undefined,
  uploads: NotebookUpload[] = [],
  userEmail?: string,
): Promise<string> {
  if (!sources) return ''
  const blocks: string[] = []
  const [proj, leads, convs] = await Promise.all([
    sources.live_projects ? projectsBlock() : Promise.resolve(null),
    sources.crm_leads ? leadsBlock() : Promise.resolve(null),
    sources.all_conversations && userEmail ? conversationsBlock(userEmail) : Promise.resolve(null),
  ])
  if (proj) blocks.push(proj)
  if (leads) blocks.push(leads)
  if (convs) blocks.push(convs)
  if (sources.uploads) {
    const up = uploadsBlock(uploads)
    if (up) blocks.push(up)
  }
  if (!blocks.length) return ''
  return `\n\nThe user selected these workspace sources — ground your answer in this real data and cite specific projects/numbers where relevant:\n\n${blocks.join('\n\n')}`
}
