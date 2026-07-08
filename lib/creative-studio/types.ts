import type { Node, Edge } from "@xyflow/react"

// Node types
export type NodeType =
  | "start"
  | "end"
  | "prompt"
  | "textModel"
  | "imageGeneration"
  | "conditional"
  | "javascript"
  | "httpRequest"
  | "embeddingModel"
  | "tool"
  | "audio"
  | "structuredOutput"
  | "memory"
  | "ugcModel"
  | "productUpload"
  | "script"
  | "videoGeneration"

// Node data types
export interface BaseNodeData {
  label?: string
  status?: NodeStatus
  output?: unknown
  isExpanded?: boolean
  onUpdate?: (data: unknown) => void
  // Index signature so each node-data type satisfies @xyflow/react's
  // Node<Record<string, unknown>> data constraint.
  [key: string]: unknown
}

export interface StartNodeData extends BaseNodeData {}

export interface EndNodeData extends BaseNodeData {}

export interface PromptNodeData extends BaseNodeData {
  content?: string
}

export interface TextModelNodeData extends BaseNodeData {
  model?: string
  temperature?: number
  maxTokens?: number
  structuredOutput?: boolean
  schema?: string
  schemaName?: string
}

export interface ImageGenerationNodeData extends BaseNodeData {
  model?: string
  aspectRatio?: string
  outputFormat?: string
}

export interface ConditionalNodeData extends BaseNodeData {
  condition?: string
}

export interface JavaScriptNodeData extends BaseNodeData {
  code?: string
}

export interface HttpRequestNodeData extends BaseNodeData {
  url?: string
  method?: string
  headers?: string
  body?: string
}

export interface EmbeddingModelNodeData extends BaseNodeData {
  model?: string
  dimensions?: number
}

export interface ToolNodeData extends BaseNodeData {
  name?: string
  description?: string
  code?: string
  implementation?: string
}

export interface AudioNodeData extends BaseNodeData {
  model?: string
  voice?: string
  speed?: number
}

export interface StructuredOutputNodeData extends BaseNodeData {
  schemaName?: string
  schema?: string
  mode?: string
}

export interface MemoryNodeData extends BaseNodeData {
  operation?: "load" | "save" | "loadAll" | "addMessage" | "getMessages"
  sessionId?: string
  key?: string
  memoryType?: "fact" | "preference" | "entity" | "summary"
  messageRole?: "user" | "assistant" | "system"
  limit?: number
}

export interface UgcModelNodeData extends BaseNodeData {
  ethnicity?: string
  gender?: string
  ageRange?: string
  description?: string
  isLocked?: boolean
  lockedImageUrl?: string
}

export interface ProductUploadNodeData extends BaseNodeData {
  productImage?: string
  productName?: string
}

export interface ScriptNodeData extends BaseNodeData {
  script?: string
}

export interface VideoGenerationNodeData extends BaseNodeData {
  model?: string
  aspectRatio?: string
  duration?: string // "4s" | "6s" | "8s"
}

// Workflow types
export interface Workflow {
  nodes: Node[]
  edges: Edge[]
  version?: string
  createdAt?: string
  updatedAt?: string
}

// Execution types
export interface ExecutionResult {
  nodeId: string
  type: string
  output: unknown
  error?: string
}

export interface StreamUpdate {
  type: "node_start" | "node_complete" | "node_error" | "complete" | "error"
  nodeId?: string
  nodeType?: string
  output?: unknown
  error?: string
  executionLog?: ExecutionResult[]
}

// Run types for observability
export interface RunStep {
  nodeId: string
  nodeType: string
  nodeName?: string
  status: "pending" | "running" | "completed" | "error"
  startedAt?: string
  completedAt?: string
  duration?: number
  input?: unknown
  output?: unknown
  error?: string
}

export interface Run {
  id: string
  status: "running" | "completed" | "failed" | "stopped"
  startedAt: string
  completedAt?: string
  duration?: number
  steps: RunStep[]
  workflowSnapshot?: {
    nodes: Node[]
    edges: Edge[]
  }
}

export type NodeStatus = "idle" | "running" | "completed" | "error"
