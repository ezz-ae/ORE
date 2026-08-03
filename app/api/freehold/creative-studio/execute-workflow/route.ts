import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { MANAGEMENT_ROLES, type Role } from "@/lib/freehold/session-types"
import { genText, genImage, genVideo } from "@/lib/creative-studio/providers"
import { personaCharacterPrompt } from "@/lib/creative-studio/constants"
import { saveLibraryItem } from "@/lib/freehold/library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type Node = { id: string; type?: string; data?: Record<string, unknown> }
type Edge = { source: string; target: string; targetHandle?: string | null }

const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v))

// Find the first http(s) URL anywhere in the resolved inputs (used as the
// reference image for image/video generation).
const findUrl = (inputs: string[]): string | undefined => {
  for (const i of inputs) {
    // Accept both hosted URLs and inline data: URLs (Google returns base64).
    const m = String(i).match(/(https?:\/\/[^\s"']+|data:image\/[^\s"']+)/)
    if (m) return m[0]
  }
  return undefined
}

// The human-readable part of the inputs: every input with URLs stripped and
// empty/`{}` husks dropped, joined so multi-input nodes (property + presenter)
// keep ALL their context instead of silently using only inputs[0].
const textOf = (input: string): string =>
  String(input).replace(/(https?:\/\/[^\s"']+|data:[a-z/+.-]+;base64,[^\s"']+)/gi, "").replace(/\s+/g, " ").trim()
const combinedText = (inputs: string[]): string =>
  inputs.map(textOf).filter((t) => t && t !== "{}").join("\n\n")

// Interpolate $input1/$input2/$input into a template.
function interpolate(template: string, inputs: string[]): string {
  let out = template.replace(/\$input(\d+)/g, (_, n) => inputs[Number(n) - 1] ?? "")
  out = out.replace(/\$input\b/g, inputs[0] ?? "")
  return out
}

// Run one node given its resolved inputs (outputs of its source nodes).
// `byHandle` maps a labeled input handle (e.g. 'script-input') → the outputs
// wired into it, so nodes with named ports route data the way the canvas shows.
async function runNode(node: Node, inputs: string[], byHandle: Map<string, string[]>): Promise<unknown> {
  const d = node.data || {}
  const primary = inputs[0] ?? ""
  switch (node.type) {
    case "start":
      return {}
    case "end":
      return primary
    case "prompt":
      return interpolate(str(d.content) || "", inputs)
    case "script": {
      // The node's own script IS its product — the user wrote or generated it
      // in the card. Only fall back to generating when the card is empty.
      const written = str(d.script).trim()
      if (written) return written
      const brief = combinedText(inputs) || str(d.content)
      return genText(
        `Write a punchy, spoken voiceover for a Dubai real-estate reel.${brief ? `\n\nContext:\n${brief}` : ""}\nReturn only the voiceover text.`,
        {
          temperature: typeof d.temperature === "number" ? d.temperature : undefined,
          maxTokens: typeof d.maxTokens === "number" ? d.maxTokens : undefined,
        },
      )
    }
    case "textModel":
      return genText(combinedText(inputs) || str(d.content) || "Write engaging copy.", {
        temperature: typeof d.temperature === "number" ? d.temperature : undefined,
        maxTokens: typeof d.maxTokens === "number" ? d.maxTokens : undefined,
      })
    case "ugcModel": {
      // Honor the node's LOCK: reuse the frozen persona instead of regenerating.
      if (d.isLocked && typeof d.lockedImageUrl === "string" && d.lockedImageUrl) return d.lockedImageUrl
      // Same identity rule as every other presenter path: the demographic
      // anchor leads, in the same words, from the same helper. A bare
      // "female, 26-35, middle-eastern" list is easy for the writer model to
      // drop; a stated subject with a do-not-change clause is not.
      const character = personaCharacterPrompt({
        name: str(d.name) || undefined,
        gender: str(d.gender) || undefined,
        ethnicity: str(d.ethnicity) || undefined,
        ageRange: str(d.ageRange) || undefined,
        description: str(d.description) || undefined,
      })
      return genText(
        `Describe a realistic UGC creator persona for a Dubai real-estate ad: ${character} One vivid paragraph for an image/video prompt. Keep the stated gender, age and ethnicity exactly as given.`,
      )
    }
    case "structuredOutput": {
      const schema = str(d.schema) || "{}"
      const text = await genText(
        `${primary}\n\nReturn ONLY valid JSON matching this schema (no markdown fences):\n${schema}`,
      )
      try {
        return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""))
      } catch {
        return text
      }
    }
    case "imageGeneration": {
      // Honor the node's LOCK: reuse the frozen image instead of regenerating.
      if (d.isLocked && typeof d.lockedImageUrl === "string" && d.lockedImageUrl) return d.lockedImageUrl
      // ALL text inputs feed the prompt (property + presenter persona together).
      const r = await genImage(combinedText(inputs) || "A cinematic Dubai real-estate hero image.", {
        aspectRatio: str(d.aspectRatio) || undefined,
        imageUrl: findUrl(inputs),
      })
      return r.url
    }
    case "videoGeneration": {
      // Honor the node's LOCK: reuse the frozen output instead of regenerating.
      if (d.isLocked && typeof d.lockedImageUrl === "string" && d.lockedImageUrl) return d.lockedImageUrl
      // Named handles route data the way the canvas shows: the script port is
      // the motion/voiceover prompt; product/model ports carry the reference
      // image. Without handle wiring, fall back to the combined text — never
      // a base64 data-URL as the "prompt".
      const scriptIn = combinedText(byHandle.get("script-input") ?? [])
      const refIn = findUrl([...(byHandle.get("product-input") ?? []), ...(byHandle.get("model-input") ?? [])])
      const r = await genVideo(scriptIn || combinedText(inputs) || "A cinematic property walkthrough.", {
        imageUrl: refIn ?? findUrl(inputs),
        aspectRatio: str(d.aspectRatio) || undefined,
        // Wire the Duration dropdown through to the generator (value may be '8s' or a number).
        duration:
          typeof d.duration === "string"
            ? parseInt(d.duration)
            : typeof d.duration === "number"
              ? d.duration
              : undefined,
      })
      return r.url
    }
    case "productUpload": {
      // Prefer the AI-written brief; otherwise a real listing line (name, beds,
      // area, developer, price). Append the reference image so downstream image
      // generation describes and edits the actual property.
      const parts = [
        str(d.productName),
        str(d.bedrooms),
        d.area ? `in ${str(d.area)}` : "",
        d.developer ? `by ${str(d.developer)}` : "",
        d.price ? `from AED ${Number(d.price).toLocaleString("en-US")}` : "",
      ].filter(Boolean)
      const text = str(d.brief) || parts.join(", ")
      // Prefer the uploaded environment/backdrop as the reference, else the hero.
      const img = str(d.environmentImage) || str(d.productImage)
      const usable = /^(https?:\/\/|data:image\/)/.test(img) ? img : ""
      return [text, usable].filter(Boolean).join(" ") || usable || text
    }
    case "conditional": {
      const cond = str(d.condition)
      try {
        const fn = new Function("input1", "input2", "input3", "input", `return (${cond});`)
        return Boolean(fn(inputs[0], inputs[1], inputs[2], inputs[0]))
      } catch {
        return false
      }
    }
    case "javascript": {
      const code = str(d.code) || "return input1;"
      const fn = new Function("input1", "input2", "input3", "input", code)
      return fn(inputs[0], inputs[1], inputs[2], inputs[0])
    }
    case "httpRequest": {
      const url = str(d.url)
      if (!url) throw new Error("HTTP node has no URL.")
      const res = await fetch(url, {
        method: str(d.method) || "GET",
        headers: d.headers ? JSON.parse(str(d.headers)) : undefined,
        body: d.body ? str(d.body) : undefined,
      })
      const text = await res.text()
      try { return JSON.parse(text) } catch { return text }
    }
    default:
      // audio / embedding / tool / memory — pass the input through for now.
      return primary
  }
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  // Executing workflows spends real AI budget — same gate as the Creative
  // Studio UI (management + marketing), matching presenters/route.ts.
  if (!([...MANAGEMENT_ROLES, 'marketing'] as Role[]).includes(user.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  let body: { nodes?: Node[]; edges?: Edge[]; stopAtNodeId?: string }
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 }) }
  const nodes = body.nodes || []
  const edges = body.edges || []
  const stopAt = body.stopAtNodeId

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
      const outputs = new Map<string, unknown>()
      const executionLog: Array<{ nodeId: string; type: string; output: unknown; error?: string }> = []
      const done = new Set<string>()

      const incomingEdges = (id: string) => edges.filter((e) => e.target === id)
      const incoming = (id: string) => incomingEdges(id).map((e) => e.source)
      const ready = (id: string) => incoming(id).every((s) => done.has(s))
      // Group resolved inputs by the labeled handle they were wired into, so
      // nodes with named ports (video: script/product/model) route correctly.
      const inputsByHandle = (id: string): Map<string, string[]> => {
        const map = new Map<string, string[]>()
        for (const e of incomingEdges(id)) {
          const key = typeof e.targetHandle === "string" && e.targetHandle ? e.targetHandle : "default"
          const list = map.get(key) ?? []
          list.push(str(outputs.get(e.source)))
          map.set(key, list)
        }
        return map
      }

      try {
        // Execute in dependency order: repeatedly run any node whose inputs are ready.
        let progressed = true
        while (progressed) {
          progressed = false
          for (const node of nodes) {
            if (done.has(node.id) || !ready(node.id)) continue
            progressed = true
            send({ type: "node_start", nodeId: node.id, nodeType: node.type })
            try {
              const inputs = incoming(node.id).map((s) => str(outputs.get(s)))
              const output = await runNode(node, inputs, inputsByHandle(node.id))
              outputs.set(node.id, output)
              done.add(node.id)
              executionLog.push({ nodeId: node.id, type: node.type || "unknown", output })
              // Persist generated media: studio outputs used to evaporate with
              // the canvas. Fresh image/video generations now land in the
              // Library (→ Drive editors → ad media). Locked reuses don't
              // re-save — the original Library row already exists.
              let libraryId: string | null = null
              let editorPath: string | null = null
              const isMediaNode = node.type === "imageGeneration" || node.type === "videoGeneration"
              const isFreshMedia = isMediaNode && !(node.data?.isLocked) &&
                typeof output === "string" && /^(https?:\/\/|data:)/.test(output)
              if (isFreshMedia) {
                const kind = node.type === "imageGeneration" ? ("image" as const) : ("video" as const)
                const label = str(node.data?.label) || (kind === "image" ? "Studio image" : "Studio video")
                const item = await saveLibraryItem(user.email, { kind, title: `Studio — ${label}`, url: output as string }).catch(() => null)
                if (item) {
                  libraryId = item.id
                  editorPath = `/freehold-intelligence/drive/editor/${kind}/${item.id}`
                }
              }
              send({
                type: "node_complete", nodeId: node.id, nodeType: node.type, output,
                ...(libraryId ? { libraryId, editorPath } : {}),
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              done.add(node.id)
              executionLog.push({ nodeId: node.id, type: node.type || "unknown", output: null, error: message })
              send({ type: "node_error", nodeId: node.id, error: message })
            }
            if (stopAt && node.id === stopAt) { progressed = false; break }
          }
        }
        send({ type: "complete", executionLog })
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } })
}
