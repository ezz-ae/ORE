import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { genText, genImage, genVideo } from "@/lib/creative-studio/providers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type Node = { id: string; type?: string; data?: Record<string, unknown> }
type Edge = { source: string; target: string }

const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v))

// Interpolate $input1/$input2/$input into a template.
function interpolate(template: string, inputs: string[]): string {
  let out = template.replace(/\$input(\d+)/g, (_, n) => inputs[Number(n) - 1] ?? "")
  out = out.replace(/\$input\b/g, inputs[0] ?? "")
  return out
}

// Run one node given its resolved inputs (outputs of its source nodes).
async function runNode(node: Node, inputs: string[]): Promise<unknown> {
  const d = node.data || {}
  const primary = inputs[0] ?? ""
  switch (node.type) {
    case "start":
      return {}
    case "end":
      return primary
    case "prompt":
      return interpolate(str(d.content) || "", inputs)
    case "textModel":
    case "script":
      return genText(primary || str(d.content) || "Write engaging copy.", {
        temperature: typeof d.temperature === "number" ? d.temperature : undefined,
        maxTokens: typeof d.maxTokens === "number" ? d.maxTokens : undefined,
      })
    case "ugcModel": {
      const desc = [d.gender, d.ageRange, d.ethnicity].filter(Boolean).join(", ")
      return genText(
        `Describe a realistic UGC creator persona for a Dubai real-estate ad — ${desc || "authentic local creator"}. ${str(d.description)}. One vivid paragraph for an image/video prompt.`,
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
      const r = await genImage(primary || "A cinematic Dubai real-estate hero image.", {
        aspectRatio: str(d.aspectRatio) || undefined,
        imageUrl: inputs.find((i) => /^https?:\/\//.test(i)) || undefined,
      })
      return r.url
    }
    case "videoGeneration": {
      const r = await genVideo(primary || "A cinematic property walkthrough.", {
        imageUrl: inputs.find((i) => /^https?:\/\//.test(i)) || undefined,
      })
      return r.url
    }
    case "productUpload":
      return str(d.productImage) || str(d.productName) || ""
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

      const incoming = (id: string) => edges.filter((e) => e.target === id).map((e) => e.source)
      const ready = (id: string) => incoming(id).every((s) => done.has(s))

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
              const output = await runNode(node, inputs)
              outputs.set(node.id, output)
              done.add(node.id)
              executionLog.push({ nodeId: node.id, type: node.type || "unknown", output })
              send({ type: "node_complete", nodeId: node.id, nodeType: node.type, output })
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
