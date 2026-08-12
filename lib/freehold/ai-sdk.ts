import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { geminiApiKey, VERTEX_SENTINEL } from '@/lib/gemini-rest'
import { resolveVertexProject, VERTEX_LOCATION, vertexConfigured } from '@/lib/google/vertex-auth'

/**
 * WHICH MODEL THE COORDINATOR CHAT SPEAKS TO, and over which door.
 *
 * There are two Google doors to the same family of models and they are not
 * interchangeable:
 *
 *   GEMINI API      an API key. A consumer product. Fine for a side project.
 *   VERTEX AI       a service account inside the company's own Google Cloud
 *                   project. Enterprise terms, data-residency in a named
 *                   region, audit trail, quota that belongs to the business.
 *
 * A platform running a client's advertising money through a chat agent belongs
 * on the second one, and this file used the first — unconditionally, through
 * createGoogleGenerativeAI(apiKey).
 *
 * WORSE, AND THE ACTUAL BUG: on a deployment configured for Vertex ONLY,
 * geminiApiKey() returns VERTEX_SENTINEL — the literal string "__vertex_sa__",
 * a marker meaning "no key, use the service account". Every other caller reads
 * that marker and routes to Vertex (see lib/gemini-rest.ts). This one did not:
 * it handed the sentinel to the consumer API as if it were a credential. The
 * request fails, and it fails at the model layer, which is exactly where a
 * chat agent has the least honest way to report the problem — it is a
 * plausible cause of an agent that answers from itself instead of from a tool
 * whose call never completed.
 *
 * So: VERTEX FIRST, always, when the service account is present. The API key
 * is the fallback for a workspace that only has one.
 *
 * THE MODEL NAME IS AN ENV VAR because it is an operational decision, not a
 * code one. A model good enough today is superseded on a schedule nobody here
 * controls, and needing a deploy to raise it is how a product stays on a model
 * for a year after a better one shipped.
 */

/**
 * The default the coordinator runs on.
 *
 * PRO TIER, DELIBERATELY. Flash-tier models produced wrong-entity answers on
 * this workload and asked users for ids their own tools could fetch — this
 * agent reasons across several tool results before it answers, which is the
 * work flash is worst at. Cheaper is the wrong axis to optimise on a screen
 * that talks about someone's advertising budget.
 *
 * Raise it with EXPERT_MODEL rather than by editing this line.
 */
export const EXPERT_MODEL = process.env.EXPERT_MODEL?.trim() || 'gemini-2.5-pro'

/**
 * WHICH DOOR, decided in one place and testable without a network or an env.
 *
 * Extracted so the sentinel rule can be ASSERTED rather than trusted: the
 * whole bug was one caller treating "__vertex_sa__" as a credential while
 * every other caller read it as a marker.
 */
export type AiDoor = 'vertex' | 'gemini' | 'none'
export function aiDoorFor(env: { vertex: boolean; apiKey: string }): AiDoor {
  // Vertex outranks a key even when both exist: the company's own project,
  // its own terms, its own region, its own audit trail.
  if (env.vertex) return 'vertex'
  // The sentinel is a marker meaning "use the service account". If Vertex is
  // not configured it means nothing at all, and it is never a credential.
  if (!env.apiKey || env.apiKey === VERTEX_SENTINEL) return 'none'
  return 'gemini'
}

/** True when the coordinator is speaking through the company's own Google
 *  Cloud project rather than a consumer API key. Surfaced so the integrations
 *  screen can state which door is actually in use rather than assuming. */
export const expertUsesVertex = (): boolean => vertexConfigured()

export function expertModel(modelName: string = EXPERT_MODEL) {
  const apiKey = geminiApiKey()
  const door = aiDoorFor({ vertex: vertexConfigured(), apiKey })

  // ── Vertex: the company's own project, service-account authenticated ──────
  // google-auth-library picks up VERTEX_AI_SERVICE_ACCOUNT_JSON through the
  // credentials we already parse for every other Vertex caller, so there is
  // one place that knows how this account authenticates.
  if (door === 'vertex') {
    const credentials = (() => {
      const raw = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
      if (!raw) return undefined
      try { return JSON.parse(raw) } catch { return undefined }
    })()
    const vertex = createVertex({
      project: resolveVertexProject(),
      location: VERTEX_LOCATION,
      ...(credentials ? { googleAuthOptions: { credentials } } : {}),
    })
    return vertex(modelName)
  }

  // ── Fallback: the consumer Gemini API ────────────────────────────────────
  if (door === 'none') {
    throw new Error(
      'No AI credential configured for the coordinator. Set VERTEX_AI_SERVICE_ACCOUNT_JSON '
      + '(preferred — the company Google Cloud project) or GEMINI_API_KEY.',
    )
  }
  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelName)
}
