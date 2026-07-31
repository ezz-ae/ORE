import type { NodeType } from "./types"

export const PROVIDER_LOGOS: Record<string, string> = {
  Anthropic: "https://cdn.worldvectorlogo.com/logos/anthropic-2.svg",
  OpenAI: "https://cdn.worldvectorlogo.com/logos/openai-2.svg",
  Google: "https://cdn.worldvectorlogo.com/logos/google-g-2015.svg",
  "Fal AI": "https://fal.ai/favicon.ico",
}

// AI Models available through AI Gateway
export const TEXT_MODELS = [
  // OpenAI
  { value: "openai/gpt-5", label: "GPT-5", group: "OpenAI" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", group: "OpenAI" },
  { value: "openai/gpt-4.1", label: "GPT-4.1", group: "OpenAI" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", group: "OpenAI" },
  { value: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano", group: "OpenAI" },
  { value: "openai/o3", label: "o3", group: "OpenAI" },
  { value: "openai/o3-mini", label: "o3 Mini", group: "OpenAI" },
  { value: "openai/o4-mini", label: "o4 Mini", group: "OpenAI" },
  // Google Gemini models
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", group: "Google" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", group: "Google" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", group: "Google" },
  { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", group: "Google" },
  { value: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", group: "Google" },
  // xAI (Grok)
  { value: "xai/grok-4", label: "Grok 4", group: "xAI" },
  { value: "xai/grok-4-fast", label: "Grok 4 Fast", group: "xAI" },
  { value: "xai/grok-3", label: "Grok 3", group: "xAI" },
  { value: "xai/grok-3-fast", label: "Grok 3 Fast", group: "xAI" },
  { value: "xai/grok-3-mini", label: "Grok 3 Mini", group: "xAI" },
  { value: "xai/grok-3-mini-fast", label: "Grok 3 Mini Fast", group: "xAI" },
] as const

// Updated default node data
export const DEFAULT_NODE_DATA: Record<NodeType, Record<string, unknown>> = {
  start: {},
  end: {},
  prompt: { content: "Enter your prompt..." },
  textModel: {
    model: "openai/gpt-5-mini",
    temperature: 0.7,
    maxTokens: 2000,
    agentMode: false,
    completionSignal: "TASK_COMPLETE",
    maxIterations: 10,
  },
  imageGeneration: { model: "google/imagen-3", format: "insta_ad", aspectRatio: "1:1", outputFormat: "png" },
  conditional: { condition: "input1 === 'value'" },
  javascript: { code: "// Access inputs as input1, input2, etc.\nreturn input1.toUpperCase()" },
  httpRequest: { url: "https://api.example.com", method: "GET" },
  embeddingModel: { model: "openai/text-embedding-3-small", dimensions: 1536 },
  tool: { name: "customTool", description: "A custom tool" },
  audio: { model: "openai/tts-1", voice: "alloy", speed: 1.0 },
  structuredOutput: { schemaName: "Schema", mode: "object" },
  memory: { operation: "load", sessionId: "default", key: "", memoryType: "fact", limit: 10 },
  ugcModel: { persona: "layla", ethnicity: "middle-eastern", gender: "female", ageRange: "26-35", description: "Polished, elegant Dubai luxury property consultant; tailored modern business wear; warm, confident, high-end.", isLocked: false },
  productUpload: { productImage: undefined, productName: "", propertyId: undefined, area: "", developer: "", price: null, bedrooms: "", propertyType: "" },
  script: { script: "" },
  videoGeneration: { model: "fal-ai/veo-3.1", format: "reels", aspectRatio: "9:16", duration: "8s" },
}

export const IMAGE_MODELS = [
  { value: "google/imagen-3", label: "Imagen 3", group: "Google", description: "Text-to-image, cost-efficient (default)" },
  { value: "google/gemini-image", label: "Gemini Image", group: "Google", description: "Image-to-image editing on your Gemini key" },
  { value: "fal-ai/flux-2-pro/edit", label: "Flux 2 Pro Edit", group: "Fal AI (premium)", description: "Premium quality — needs FAL_KEY" },
] as const

export const EMBEDDING_MODELS = [
  { value: "openai/text-embedding-3-small", label: "text-embedding-3-small" },
  { value: "openai/text-embedding-3-large", label: "text-embedding-3-large" },
] as const

export const VIDEO_MODELS = [
  { value: "fal-ai/veo-3.1", label: "Veo 3.1", group: "Fal AI", description: "Image-to-video with audio (recommended)" },
] as const

export const ETHNICITIES = [
  { value: "caucasian", label: "Caucasian" },
  { value: "african", label: "African" },
  { value: "asian", label: "Asian" },
  { value: "hispanic", label: "Hispanic/Latino" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "south-asian", label: "South Asian" },
  { value: "mixed", label: "Mixed" },
] as const

// Ready-made on-camera presenter personas for real-estate reels. Picking one
// pre-fills the demographic fields; "Custom" exposes the manual controls.
export const PRESENTER_PERSONAS = [
  { id: "layla", name: "Layla", tagline: "Luxury consultant", gender: "female", ethnicity: "middle-eastern", ageRange: "26-35",
    description: "Polished, elegant Dubai luxury property consultant; tailored modern business wear; warm, confident, high-end." },
  { id: "omar", name: "Omar", tagline: "Investment advisor", gender: "male", ethnicity: "middle-eastern", ageRange: "36-45",
    description: "Sharp, data-driven Dubai real-estate investment advisor; crisp navy suit; assured, trustworthy, ROI-focused." },
  { id: "sara", name: "Sara", tagline: "Community specialist", gender: "female", ethnicity: "south-asian", ageRange: "26-35",
    description: "Warm, approachable community-living specialist; smart-casual; friendly and relatable for families." },
] as const

/* ── Who a presenter IS ──────────────────────────────────────────────────────
 *
 * Every persona `description` above is deliberately gender-neutral prose about
 * STYLE ("polished, elegant, tailored business wear"). Nothing in it says that
 * Layla is a woman. An image model handed that description alone therefore
 * picks a gender at random — which is exactly how Layla and Sara came back as
 * men.
 *
 * The identity lives in the structured fields (`gender`, `ethnicity`,
 * `ageRange`), so it has to be rendered into words on EVERY path that draws a
 * presenter. This used to be re-implemented per route, and the route that got
 * it wrong was the one behind the main Generate button. One helper now, used
 * everywhere — a persona cannot be described inconsistently because there is
 * only one way to describe it.
 */

export const GENDER_NOUN: Record<string, string> = {
  female: "woman",
  male: "man",
  "non-binary": "person",
}

export interface PersonaLike {
  name?: string
  gender?: string
  ethnicity?: string
  ageRange?: string
  description?: string
}

/** The demographic anchor — e.g. "26-35-year-old middle eastern woman". This
 *  MUST lead any prompt that renders a presenter; a trailing mention is too
 *  weak to override whatever the rest of the sentence implies. */
export function personaSubject(p: PersonaLike): string {
  return [
    p.ageRange ? `${p.ageRange}-year-old` : "",
    p.ethnicity ? p.ethnicity.replace(/-/g, " ") : "",
    GENDER_NOUN[p.gender ?? ""] ?? "person",
  ].filter(Boolean).join(" ")
}

/**
 * The full character sentence: who they are, then how they present. Naming the
 * character and restating the gender after the style prose is redundant on
 * purpose — the style clause is long, and without the restatement the model
 * drifts back to a default by the end of it.
 */
export function personaCharacterPrompt(p: PersonaLike): string {
  const subject = personaSubject(p)
  const noun = GENDER_NOUN[p.gender ?? ""] ?? "person"
  const named = p.name ? `${p.name}, a ${subject}` : `a ${subject}`
  const restate = p.name ? `${p.name} is a ${noun}` : `This character is a ${noun}`
  return `${named}. ${p.description ?? ""} ${restate} — do not change the gender, age or ethnicity.`
    .replace(/\s+/g, " ").trim()
}

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
] as const

export const AGE_RANGES = [
  { value: "18-25", label: "18-25" },
  { value: "26-35", label: "26-35" },
  { value: "36-45", label: "36-45" },
  { value: "46-55", label: "46-55" },
  { value: "56+", label: "56+" },
] as const

export const TTS_VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
] as const

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

export const ASPECT_RATIOS = ["1:1", "16:9", "4:3", "3:2", "9:16"] as const

// Creative format presets — pick a placement and the aspect ratio + media type
// follow. Image formats run on Google (Imagen); video formats need a video key.
export const CREATIVE_FORMATS = [
  { value: "story",    label: "Story",          aspect: "9:16", kind: "image" as const, hint: "9:16 · full-screen vertical" },
  { value: "insta_ad", label: "Insta Ad",       aspect: "1:1",  kind: "image" as const, hint: "1:1 · feed square" },
  { value: "creative", label: "Creative Image", aspect: "4:3",  kind: "image" as const, hint: "4:3 · versatile" },
  { value: "reels",    label: "Reels",          aspect: "9:16", kind: "video" as const, hint: "9:16 · short vertical video" },
  { value: "youtube",  label: "YouTube",        aspect: "16:9", kind: "video" as const, hint: "16:9 · landscape video" },
] as const

export type CreativeFormat = (typeof CREATIVE_FORMATS)[number]

// Node type metadata
export const NODE_TYPES: Record<NodeType, { label: string; description: string }> = {
  start: { label: "Start", description: "Workflow entry point" },
  end: { label: "End", description: "Workflow output" },
  prompt: { label: "Prompt", description: "Text template" },
  textModel: { label: "Text Model", description: "LLM generation" },
  imageGeneration: { label: "Image", description: "Image generation" },
  conditional: { label: "Conditional", description: "Branch logic" },
  javascript: { label: "JavaScript", description: "Custom code" },
  httpRequest: { label: "HTTP", description: "API requests" },
  embeddingModel: { label: "Embedding", description: "Vector embeddings" },
  tool: { label: "Tool", description: "Custom function" },
  audio: { label: "Audio", description: "Text-to-speech" },
  structuredOutput: { label: "Structured", description: "Schema output" },
  memory: { label: "Memory", description: "Persistent storage" },
  ugcModel: { label: "Presenter", description: "On-camera property presenter" },
  productUpload: { label: "Property", description: "Pick a listing from inventory" },
  script: { label: "Listing Script", description: "Reel voiceover / dialogue" },
  videoGeneration: { label: "Video", description: "Video generation" },
}

// Workflow templates
export const WORKFLOW_TEMPLATES = [
  {
    id: "property-reel",
    name: "Property Reel",
    description: "Turn a real listing into a short vertical property video",
    nodes: [
      { id: "1", type: "start", position: { x: 50, y: 300 }, data: {} },
      {
        id: "2",
        type: "ugcModel",
        position: { x: 300, y: 150 },
        data: { ethnicity: "middle-eastern", gender: "female", ageRange: "26-35", description: "Polished Dubai property consultant, confident and warm on camera.", isLocked: false },
      },
      {
        id: "3",
        type: "productUpload",
        position: { x: 300, y: 350 },
        data: { productImage: undefined, productName: "", propertyId: undefined, area: "", developer: "", price: null, bedrooms: "", propertyType: "" },
      },
      {
        id: "4",
        type: "script",
        position: { x: 300, y: 520 },
        data: { script: "This is one of the most sought-after addresses in the area — walk in and the light does all the talking. Book your viewing today before it's gone." },
      },
      {
        id: "5",
        type: "imageGeneration",
        position: { x: 620, y: 250 },
        data: { model: "google/imagen-3", format: "reels", aspectRatio: "9:16" },
      },
      {
        id: "6",
        type: "videoGeneration",
        position: { x: 950, y: 300 },
        data: { model: "fal-ai/veo-3.1", aspectRatio: "9:16", duration: "8s" },
      },
      { id: "7", type: "end", position: { x: 1280, y: 300 }, data: {} },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e1-3", source: "1", target: "3" },
      { id: "e1-4", source: "1", target: "4" },
      { id: "e2-5", source: "2", target: "5" },
      { id: "e3-5", source: "3", target: "5" },
      { id: "e5-6", source: "5", target: "6", targetHandle: "model-input" },
      { id: "e3-6", source: "3", target: "6", targetHandle: "product-input" },
      { id: "e4-6", source: "4", target: "6", targetHandle: "script-input" },
      { id: "e6-7", source: "6", target: "7" },
    ],
  },
  {
    id: "instagram-ad",
    name: "Instagram Ad",
    description: "Square feed image with a presenter — runs on Google, no video key",
    nodes: [
      { id: "1", type: "start", position: { x: 50, y: 260 }, data: {} },
      { id: "2", type: "productUpload", position: { x: 300, y: 150 }, data: { productName: "", area: "", developer: "", price: null, bedrooms: "", propertyType: "" } },
      { id: "3", type: "ugcModel", position: { x: 300, y: 380 }, data: { persona: "layla", ethnicity: "middle-eastern", gender: "female", ageRange: "26-35", description: "Polished, elegant Dubai luxury property consultant; tailored modern business wear; warm, confident, high-end.", isLocked: false } },
      { id: "4", type: "imageGeneration", position: { x: 620, y: 260 }, data: { model: "google/imagen-3", format: "insta_ad", aspectRatio: "1:1", outputFormat: "png" } },
      { id: "5", type: "end", position: { x: 900, y: 260 }, data: {} },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e1-3", source: "1", target: "3" },
      { id: "e2-4", source: "2", target: "4" },
      { id: "e3-4", source: "3", target: "4" },
      { id: "e4-5", source: "4", target: "5" },
    ],
  },
  {
    id: "story-creative",
    name: "Story Creative",
    description: "Vertical 9:16 story image with a listing script — runs on Google",
    nodes: [
      { id: "1", type: "start", position: { x: 50, y: 260 }, data: {} },
      { id: "2", type: "productUpload", position: { x: 300, y: 150 }, data: { productName: "", area: "", developer: "", price: null, bedrooms: "", propertyType: "" } },
      { id: "3", type: "script", position: { x: 300, y: 380 }, data: { script: "This is one of the most sought-after addresses in the area — book your viewing today before it's gone." } },
      { id: "4", type: "imageGeneration", position: { x: 620, y: 260 }, data: { model: "google/imagen-3", format: "story", aspectRatio: "9:16", outputFormat: "png" } },
      { id: "5", type: "end", position: { x: 900, y: 260 }, data: {} },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e1-3", source: "1", target: "3" },
      { id: "e2-4", source: "2", target: "4" },
      { id: "e3-4", source: "3", target: "4" },
      { id: "e4-5", source: "4", target: "5" },
    ],
  },
  {
    id: "quick-image",
    name: "Quick Property Image",
    description: "One listing → one clean creative image. The fastest path.",
    nodes: [
      { id: "1", type: "start", position: { x: 50, y: 200 }, data: {} },
      { id: "2", type: "productUpload", position: { x: 300, y: 200 }, data: { productName: "", area: "", developer: "", price: null, bedrooms: "", propertyType: "" } },
      { id: "3", type: "imageGeneration", position: { x: 620, y: 200 }, data: { model: "google/imagen-3", format: "creative", aspectRatio: "4:3", outputFormat: "png" } },
      { id: "4", type: "end", position: { x: 900, y: 200 }, data: {} },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
    ],
  },
] as const

export type WorkflowTemplate = (typeof WORKFLOW_TEMPLATES)[number]

// Local storage key
export const STORAGE_KEY = "ai-agent-builder-workflow"

// Version for workflow compatibility
export const WORKFLOW_VERSION = "1.0.0"
