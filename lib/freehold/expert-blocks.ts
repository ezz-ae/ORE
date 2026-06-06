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
OUTPUT FORMAT — IMPORTANT:
Respond with ONLY a JSON object of the form { "blocks": [ ... ] }. No prose outside the JSON.
Each block is one of these shapes. Compose several blocks to build a rich, interactive answer.

1. Text (always include at least one, first):
   { "type": "text", "content": "<concise markdown explanation>" }

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
