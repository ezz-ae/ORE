// lib/freehold/expert-blocks.ts
//
// The "generative UI" protocol for the Freehold Expert. The model returns a
// JSON object { blocks: ExpertBlock[] }. The chat column renders each block as
// an interactive widget (action buttons, colour picker, landing preview, etc.).

export type ActionKind = 'prompt' | 'review' | 'launch' | 'edit' | 'approve' | 'navigate'
export type ActionStyle = 'primary' | 'default' | 'danger'

export interface ExpertAction {
  label: string
  kind: ActionKind
  /** Follow-up message sent back to the Expert (for prompt/review/launch/edit/approve). */
  prompt?: string
  /** Destination path (for kind 'navigate'). */
  href?: string
  style?: ActionStyle
}

export interface LandingSection {
  heading: string
  body: string
}

export type ExpertBlock =
  | { type: 'text'; content: string }
  | { type: 'plan'; title?: string; steps: { step: string; detail?: string; owner?: string }[] }
  | { type: 'actions'; actions: ExpertAction[] }
  | { type: 'color'; label?: string; colors: string[] }
  | { type: 'landing'; title: string; subhead?: string; sections: LandingSection[]; cta?: string; accent?: string }
  | { type: 'media'; label: string; prompt: string; aspect?: string }
  | { type: 'path'; label: string; href: string; description?: string }

export interface ExpertResponse {
  blocks: ExpertBlock[]
}

/** The protocol instruction appended to the Expert system prompt. */
export const BLOCK_PROTOCOL = `
VOICE — WHO YOU ARE TALKING TO:
Your reader is a real-estate professional (broker, marketer, manager) — NOT a
developer. Inside every "content"/"detail"/"body" string:
- Plain business language: leads, viewings, campaigns, budgets, listings.
- NO markdown syntax (no **, no #, no backticks, no [links]) — the chat renders
  plain text. Short paragraphs; for lists start lines with "- ".
- NO JSON, code, stack traces, field names, ids or API jargon. If something
  technical broke, say what it means for their work and what to do next
  ("Meta hasn't been connected yet — open Integrations and connect it"),
  not the error internals. Exception: the user explicitly asked for code.

PACING — ONE ANSWER, NOT A REPORT:
Answer the question the user actually asked, tightly, then STOP. A good turn is
1–2 short text blocks plus at most one plan OR one actions block — not
everything you could say. Anything beyond the direct answer (a call script, a
message draft, deeper analysis, the next task) is OFFERED as an action button
("Draft the call message", "Analyze the weak campaign"), never dumped into the
same reply. If a full answer needs more than ~120 words of text, lead with the
conclusion in 1–2 sentences, keep only the essentials, and put the rest behind
action buttons. Walls of text make people stop reading the numbers you worked
to get right.

OUTPUT FORMAT — IMPORTANT:
Respond with ONLY a JSON object of the form { "blocks": [ ... ] }. No prose outside the JSON.
Each block is one of these shapes. Compose several blocks to build a rich, interactive answer.

1. Text (always include at least one, first):
   { "type": "text", "content": "<plain-language explanation — no markdown symbols>" }

2. Plan / full path — a sequenced execution plan:
   { "type": "plan", "title": "7-day launch plan", "steps": [
       { "step": "Publish the Palm landing page", "detail": "It is at 84% — only tracking + sign-off left", "owner": "Marketing" }
   ] }

3. Action buttons — let the user act in-conversation. kind ∈ prompt|review|launch|edit|approve|navigate.
   For prompt/review/launch/edit/approve include a "prompt" = the follow-up to send you when clicked.
   For navigate include an "href" to a real app path.
   { "type": "actions", "actions": [
       { "label": "Review the draft", "kind": "review", "prompt": "Show me the full landing copy to review", "style": "default" },
       { "label": "Launch it", "kind": "launch", "prompt": "Create the launch plan and the ad request", "style": "primary" },
       { "label": "Edit the hero", "kind": "edit", "prompt": "Rewrite the hero headline 3 ways" }
   ] }

4. Colour picker — when a colour/brand decision matters:
   { "type": "color", "label": "Pick an accent for the hero", "colors": ["#D4AF37", "#1877F2", "#10B981", "#0B0F1A"] }

5. Landing page — when asked to design/generate a landing page. Make copy ready-to-use, no placeholders.
   { "type": "landing", "title": "<hero headline>", "subhead": "<subhead>",
     "sections": [ { "heading": "Payment Plan", "body": "..." }, { "heading": "ROI", "body": "..." } ],
     "cta": "Book a private viewing", "accent": "#D4AF37" }
   After a landing block, usually add an actions block with Preview / Edit / Launch.

6. Media brief — when asked to create media/imagery:
   { "type": "media", "label": "Hero image — Palm Jumeirah at golden hour", "prompt": "<image generation prompt>", "aspect": "16:9" }

7. Path — to send the user to a real page in the app:
   { "type": "path", "label": "Open RSA Generator", "href": "/freehold-intelligence/lead-machine/google/ads/generate", "description": "Generate Google ad copy" }

Known real app paths you may link to:
- /freehold-intelligence (home)
- /freehold-intelligence/crm  and /freehold-intelligence/crm/leads/<id>
- /freehold-intelligence/inventory
- /freehold-intelligence/ads-live  (and /meta, /google)
- /freehold-intelligence/lead-machine  and /freehold-intelligence/lead-machine/google/ads/generate
- /freehold-intelligence/ai-manager  (web manager)
- /freehold-intelligence/integrations
- /freehold-intelligence/review-requests

Ground everything in the live system context provided. Never invent numbers. Be decisive.`

/**
 * EVERYTHING IN A REPLY THAT A PERSON CAN ACTUALLY READ.
 *
 * The verification layer — the entity check that refuses invented records —
 * ran on `blocksToText`, which exists for a different job: replaying history
 * back to the model compactly. It keeps a plan step's `step` and drops its
 * `detail` and `owner`, drops action labels entirely, drops a path's label and
 * description, and truncates the whole thing at 4,000 characters.
 *
 * Those omissions are correct for history and catastrophic for verification,
 * because the reply that prompted all of this put its fabrications precisely
 * there. The card read:
 *
 *   step:   "Intent: High"
 *   detail: "Originated from 'Volta_Towers_DXB_Leads_2024' campaign…"
 *   owner:  "AYA AL-MASRI"
 *   action: "View Volta Towers Details"
 *
 * The invented campaign, the invented colleague and the invented property were
 * all in fields the checker never saw. It examined "Intent: High; Risk: High;
 * Next Action: Immediate Contact" and found nothing wrong, which was true of
 * the text it was given.
 *
 * So verification gets its own reader: every field rendered to a human, no
 * truncation. A guard that inspects a summary of the answer is checking
 * something the user never reads.
 *
 * EXHAUSTIVE BY CONSTRUCTION. The switch has no default and ends in a `never`
 * assignment, so adding a block type to ExpertBlock without teaching this
 * function about it fails the typecheck — rather than silently opening a new
 * place for a claim to hide.
 */
export function readableText(blocks: readonly ExpertBlock[] | undefined): string {
  if (!blocks?.length) return ''
  const out: string[] = []
  const push = (...parts: (string | undefined)[]) => {
    for (const p of parts) if (p && p.trim()) out.push(p.trim())
  }

  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        push(b.content)
        break
      case 'plan':
        push(b.title)
        // detail and owner too — the two fields the card hid its inventions in.
        for (const s of b.steps ?? []) push(s.step, s.detail, s.owner)
        break
      case 'actions':
        // A button's LABEL is a claim ("View Volta Towers Details"), and its
        // prompt is what gets said next in the user's name.
        for (const a of b.actions ?? []) push(a.label, a.prompt, a.href)
        break
      case 'color':
        push(b.label)
        break
      case 'landing':
        push(b.title, b.subhead, b.cta)
        for (const s of b.sections ?? []) push(s.heading, s.body)
        break
      case 'media':
        push(b.label, b.prompt)
        break
      case 'path':
        push(b.label, b.description, b.href)
        break
      default: {
        // Exhaustiveness: a new block type must be handled above.
        const never: never = b
        void never
      }
    }
  }
  return out.join('\n')
}
