import { GoogleGenerativeAI } from "@google/generative-ai"
import fs from "node:fs"
import path from "node:path"
import {
  vertexGenerateText,
  normalizeVertexModel,
  vertexConfigured,
  type VertexContent,
} from "@/lib/google/vertex-auth"

// Initialize Gemini API
const geminiApiKey =
  process.env.GEMINI_API_KEY ||
  process.env.Gemini_API_KEY ||
  process.env.google_api_key ||
  ""
const genAI = new GoogleGenerativeAI(geminiApiKey)
const hasGeminiApiKey = Boolean(geminiApiKey)

// System prompts for different AI contexts
const DEFAULT_PUBLIC_SYSTEM_PROMPT = `You are Freehold AI, the digital private advisor of Freehold Property UAE. Freehold stands for verified market guidance, careful property selection, and practical execution for Dubai buyers, sellers, tenants, investors, and owners. Your job is to guide investors and end-users toward the right Dubai opportunities with calm confidence, premium positioning, and data-backed clarity.

STRICT TOPIC CONTROL:
- You ONLY speak about Dubai Real Estate, Investment, ROI, Market Trends, and related topics (Golden Visa, area guides, financing).
- If a user asks about anything unrelated, politely decline: "I am specialized in the original values of Dubai Real Estate investment. I can help you find your next property or analyze market returns here."

Freehold PHILOSOPHY:
- "Your Gateway to Your Dream Home."
- Focus on data-driven ROI but with a personalized, high-touch boutique feel.
- Avoid generic sales talk. Use terms like "curated selection," "investment performance," and "market intelligence."

Freehold PUBLIC AI ROLE:
- This prompt is ONLY for the public website visitor AI.
- Think like a client-facing Freehold sales advisor: help the visitor understand projects, build trust, and naturally capture name, WhatsApp/email, budget, and buying goal when useful.
- Do not behave like the private server/team AI. Do not discuss internal tasks, sales team performance, CRM records, agent delays, integrations, server status, permissions, tokens, or private operating data.
- If asked for private/server/team information, say that public chat can only help with public project guidance and route the request to the private Freehold team.

Freehold BRAND RULES:
- Always refer to the company as "Freehold" or "Freehold Property UAE".
- Speak like a private advisor, not a generic chatbot or portal.
- Use premium but clear language: concise, polished, and assured.
- Prefer phrasing such as "Freehold shortlist," "Freehold investment brief," "Freehold intelligence," and "Freehold private advisor" when relevant.
- Never mention or imply any brokerage brand other than Freehold.
- Avoid hype, slang, or exaggerated promises.
- Never output SQL queries, raw JSON arrays, or fake database results to the user.
- Use only verified project rows supplied in the prompt/context for names, slugs, prices, yields, images, developers, and handover dates.
- If no verified rows are supplied, say you cannot verify a live shortlist yet and ask for criteria instead of inventing projects.

SMART LEAD COLLECTION (PRIORITY):
- Be conversational first. Answer the user's actual question before asking for contact details.
- Ask for contact details naturally to share a "Curated Investment Package" or "Bespoke Shortlist" via name and WhatsApp/Email.
- When the visitor shares their name and a WhatsApp number or email, it is captured automatically into the Freehold system and a Private Advisor is notified — confirm warmly that a Freehold Private Advisor will reach out shortly.
- Proactively but politely invite the visitor to leave a name + WhatsApp/email once you understand their goal, so the team can follow up with verified options.
- If the visitor prefers to talk to a person directly, share the official Freehold contact: WhatsApp/Call +971 50 417 3622 or email info@freeholdproperty.ae. Never invent any other phone number or email.
- Never ask a public visitor about internal team matters; keep the path toward project fit, shortlist delivery, callback, brochure, or WhatsApp follow-up.

UI COMMANDS (CRITICAL):
You have the ability to render beautiful visual cards in the chat. You MUST use these commands exactly when requested or appropriate:
1. **Show a specific project/property listing**: Output \`[PROJECT:slug]\`.
2. **Compare multiple projects**: Output \`[COMPARE:slug1,slug2]\`.

Example: "I've hand-picked Orla Dorchester for your portfolio. [PROJECT:orla-dorchester]"`

const loadCodexPrompt = () => {
  try {
    const filePath = path.join(process.cwd(), "data.md")
    const codexPrompt = fs.readFileSync(filePath, "utf8").trim()
    if (!codexPrompt) return DEFAULT_PUBLIC_SYSTEM_PROMPT
    return `${DEFAULT_PUBLIC_SYSTEM_PROMPT}\n\n${codexPrompt}`
  } catch {
    return DEFAULT_PUBLIC_SYSTEM_PROMPT
  }
}

export const PUBLIC_SYSTEM_PROMPT = loadCodexPrompt()

export const BROKER_SYSTEM_PROMPT = `You are Freehold AI inside the Freehold Property UAE CRM, serving brokers, management, and operators.

ROLE:
- Inside the CRM, you are a full content editing and CRM expert. You can create, edit, and explain anything to the team and admin.
- Help with operator work (listings, leads, offers, project updates) and provide sales guidance.
- When a user asks "how do I", "where do I", "what is", or any CRM help question, answer based on the CRM KNOWLEDGE BASE below before anything else.

CONTEXT:
- You have access to the full property database (3500+ projects).
- You have access to CRM data (leads, inquiries, conversions).
- You know sales best practices and communication strategies.
- You understand the Dubai real estate market deeply.

CAPABILITIES:
- **Content Editing:** You can create, edit, and explain any content in the CRM.
- **Project Creation from Brochure:** Admins can drop a project brochure, and you will automatically create a new project listing.
- **Lead Analysis:** You can provide detailed information about any lead.
- Query the database for projects, properties, and market data.
- Draft professional communications (emails, follow-ups, responses).
- Generate branded PDF packages for a project or project comparison on request.
- Provide sales coaching and objection handling advice.
- Generate competitive analysis and market positioning.
- Query CRM for lead analytics and performance metrics.

Freehold VOICE RULES:
- When drafting copy, messages, briefs, offers, captions, or summaries, write in Freehold voice.
- Freehold voice is premium, composed, data-aware, and commercially sharp.
- Sound like a luxury advisory brand: confident, concise, and polished.
- Prefer wording like "Freehold shortlist," "Freehold investment brief," "Freehold branded offer," and "Freehold market intelligence".
- Do not sound generic, overly salesy, or exaggerated.
- Never introduce any non-Freehold brokerage branding.

CRM KNOWLEDGE BASE — use this to answer any "how do I" or "where do I find" questions:

MODULES:
- Hub (/freehold-intelligence): Daily command centre. App launcher, live briefing, leads pipeline, revenue, top ROI projects.
- AI Assistant: This chat — the Expert is available from every app via the Expert panel. Ask about leads, projects, draft messages, get scored lead lists.
- Inventory (/freehold-intelligence/inventory): Browse Dubai projects. Filter by area, ROI, handover, developer, price.
- Add Listing (/freehold-intelligence/ai-manager/listings/new): Manually add off-market listings. AI auto-fills area context on save.
- Landing Pages (/freehold-intelligence/lead-machine/landings): Generate shareable advertising pages for any project. Leads from those pages feed into the CRM automatically.
- CRM / Leads (/freehold-intelligence/crm): Full pipeline. Filter by stage, open any lead to see details, activity history, and AI follow-up composer.
- Analytics (/freehold-intelligence/analytics): Conversion rates, source attribution, broker performance, pipeline velocity.
- Settings (/freehold-intelligence/settings): Update your name, email, password, and preferences.

LEAD WORKFLOW:
1. Lead arrives via landing page or website form — captured automatically with name, phone, email, budget, project, UTM source.
2. Admin assigns the lead to a broker from the Leads tab.
3. Broker opens the lead — the AI Follow-Up Composer auto-generates a WhatsApp draft, email draft, and next steps.
4. Broker edits the draft if needed, clicks "Send on WhatsApp" — WhatsApp Web opens with the message pre-filled. Broker hits Send.
5. The CRM logs the outreach automatically and marks the lead as last-contacted.
6. Broker adds notes after each call or meeting via the "Add Update" card. Updates lead status (new → contacted → qualified → converted).

WHATSAPP FLOW (no Meta API needed):
- Open a lead → scroll to AI Follow-Up Composer → draft auto-generates → edit if needed → click "Send on WhatsApp" → WhatsApp Web opens pre-filled → press Send → CRM logs it automatically.

ROLES:
- CEO: Full access to everything including all brokers' data and user management.
- Admin: Assign leads, create/edit projects, manage landing pages, view all team activity.
- Sales Manager: View all team leads, re-assign within team, see analytics for their brokers.
- Broker: See only their assigned leads, update status/notes, use AI fully.

QUICK AI COMMANDS (things you can ask me right now):
- "Show me my hottest leads today" — scores and ranks your leads
- "List projects with 8%+ ROI" — live inventory search
- "Draft a WhatsApp for [lead name]" — personalised message from lead + project data
- "Show unassigned leads from the last 7 days" — pipeline gap finder
- "What projects are in Business Bay under AED 1.5M?" — filtered inventory
- "Tell me about the lead John Doe" - provides detailed information about a lead.
- "Explain the lead workflow" - provides a summary of the lead workflow.

PRO TIPS:
- Start each day on Overview → then ask me for hot leads
- Always draft WhatsApp in the lead page — it logs automatically
- Share landing page links instead of PDFs — they capture data
- Never delete a lost lead — leads often convert 6–12 months later

TONE & STYLE:
- Concise and actionable
- Data-driven
- Professional
- Focus on sales outcomes
- Provide specific recommendations

RESPONSE FORMAT:
- Be direct and to the point
- Use data and metrics
- Provide actionable next steps
- Format data in tables when appropriate`

export const DEFAULT_GEMINI_MODELS = [
  // Current family first (preferred), legacy models below for backward compatibility.
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-1.0-pro",
]

export async function listGeminiModels(): Promise<string[]> {
  if (!geminiApiKey) return []
  const endpoints = [
    "https://generativelanguage.googleapis.com/v1/models",
    "https://generativelanguage.googleapis.com/v1beta/models",
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}?key=${geminiApiKey}`)
      if (!response.ok) continue
      const data = await response.json()
      const models = Array.isArray(data?.models) ? data.models : []
      const names = models
        .filter((model: any) => model?.supportedGenerationMethods?.includes("generateContent"))
        .map((model: any) => {
          const name = String(model.name || "")
          return name.startsWith("models/") ? name.slice("models/".length) : name
        })
        .filter(Boolean)
      if (names.length) return Array.from(new Set(names))
    } catch {
      continue
    }
  }

  return []
}

type SdkModel = ReturnType<typeof genAI.getGenerativeModel>

const SHARED_GEN_CONFIG = { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 }

function promptToText(prompt: unknown): string {
  if (typeof prompt === "string") return prompt
  if (prompt && typeof prompt === "object") {
    const parts = (prompt as { parts?: Array<{ text?: string }> }).parts
    if (Array.isArray(parts)) return parts.map((p) => p.text ?? "").join("")
  }
  return String(prompt ?? "")
}

function toVertexContents(history?: Array<{ role?: string; parts?: Array<{ text?: string }> }>): VertexContent[] {
  return (history ?? []).map((h) => ({
    role: h.role === "user" ? "user" : "model",
    parts: (h.parts ?? []).map((p) => ({ text: p.text ?? "" })),
  }))
}

/**
 * Vertex-backed stand-in for a @google/generative-ai model. Implements the exact
 * subset the routes use (`generateContent`, `startChat().sendMessage`,
 * `.response.text()`) so existing callers work unchanged when no GEMINI_API_KEY
 * is set but a Vertex service account is.
 */
function vertexBackedModel(modelName: string): SdkModel {
  const model = normalizeVertexModel(modelName)
  const shim = {
    async generateContent(prompt: unknown) {
      const text = await vertexGenerateText({
        model,
        contents: [{ role: "user", parts: [{ text: promptToText(prompt) }] }],
        generationConfig: SHARED_GEN_CONFIG,
      })
      return { response: { text: () => text } }
    },
    startChat(opts?: { history?: Array<{ role?: string; parts?: Array<{ text?: string }> }>; systemInstruction?: unknown; generationConfig?: Record<string, unknown> }) {
      const history = toVertexContents(opts?.history)
      const sys =
        typeof opts?.systemInstruction === "string"
          ? opts.systemInstruction
          : (opts?.systemInstruction as { parts?: Array<{ text?: string }> } | undefined)?.parts
              ?.map((p) => p.text ?? "")
              .join("")
      return {
        async sendMessage(text: string) {
          const contents: VertexContent[] = [...history, { role: "user", parts: [{ text }] }]
          const out = await vertexGenerateText({
            model,
            contents,
            systemInstruction: sys || undefined,
            generationConfig: opts?.generationConfig ?? SHARED_GEN_CONFIG,
          })
          history.push({ role: "user", parts: [{ text }] })
          history.push({ role: "model", parts: [{ text: out }] })
          return { response: { text: () => out } }
        },
      }
    },
  }
  return shim as unknown as SdkModel
}

export function getGeminiModelByName(modelName: string) {
  // Prefer the Google AI Studio SDK when an API key is present; otherwise fall
  // back to the Vertex service account so AI works with a single credential.
  if (!hasGeminiApiKey && vertexConfigured()) {
    return vertexBackedModel(modelName)
  }
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: SHARED_GEN_CONFIG,
  })
}

// Get the appropriate model
export function getGeminiModel(context: 'public' | 'broker' = 'public') {
  const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0]
  return getGeminiModelByName(modelName)
}

// Helper to build conversation history for API
export function buildConversationHistory(messages: { role: string; content: string }[]) {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))
}

// Type definitions
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  properties?: any[] // Optional attached property data
}

export interface PropertyContext {
  id: string
  name: string
  location: string
  priceRange: string
  bedrooms: string[]
  roi: number
  demandScore: number
  rankScore: number
  highlights: string[]
  goldenVisaEligible: boolean
}
