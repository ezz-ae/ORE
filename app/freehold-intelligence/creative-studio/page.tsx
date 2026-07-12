"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Play, Clock, ChevronDown, StopCircle, Wand2 } from "lucide-react"
import Link from "next/link"
import { useT } from "@/lib/i18n/provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import TextModelNode from "@/components/creative-studio/nodes/text-model-node"
import EmbeddingModelNode from "@/components/creative-studio/nodes/embedding-model-node"
import ToolNode from "@/components/creative-studio/nodes/tool-node"
import StructuredOutputNode from "@/components/creative-studio/nodes/structured-output-node"
import PromptNode from "@/components/creative-studio/nodes/prompt-node"
import ImageGenerationNode from "@/components/creative-studio/nodes/image-generation-node"
import AudioNode from "@/components/creative-studio/nodes/audio-node"
import JavaScriptNode from "@/components/creative-studio/nodes/javascript-node"
import StartNode from "@/components/creative-studio/nodes/start-node"
import EndNode from "@/components/creative-studio/nodes/end-node"
import ConditionalNode from "@/components/creative-studio/nodes/conditional-node"
import HttpRequestNode from "@/components/creative-studio/nodes/http-request-node"
import MemoryNode from "@/components/creative-studio/nodes/memory-node"
import UgcModelNode from "@/components/creative-studio/nodes/ugc-model-node"
import ProductUploadNode from "@/components/creative-studio/nodes/product-upload-node"
import ScriptNode from "@/components/creative-studio/nodes/script-node"
import VideoGenerationNode from "@/components/creative-studio/nodes/video-generation-node"
import { RunsPanel } from "@/components/creative-studio/runs-panel"

import { ExecutionPanel } from "@/components/creative-studio/execution-panel"
import { FloatingAddButton } from "@/components/creative-studio/floating-add-button"
import { TemplatesMenu } from "@/components/creative-studio/templates-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Run } from "@/lib/creative-studio/types"
import { WORKFLOW_TEMPLATES, DEFAULT_NODE_DATA } from "@/lib/creative-studio/constants"

const STORAGE_KEY = "ai-agent-builder-workflow"

const nodeTypes: NodeTypes = {
  textModel: TextModelNode,
  embeddingModel: EmbeddingModelNode,
  tool: ToolNode,
  structuredOutput: StructuredOutputNode,
  prompt: PromptNode,
  imageGeneration: ImageGenerationNode,
  audio: AudioNode,
  javascript: JavaScriptNode,
  start: StartNode,
  end: EndNode,
  conditional: ConditionalNode,
  httpRequest: HttpRequestNode,
  memory: MemoryNode,
  ugcModel: UgcModelNode,
  productUpload: ProductUploadNode,
  script: ScriptNode,
  videoGeneration: VideoGenerationNode,
}

// Use the Property Reel template as the default canvas
const ugcTemplate = WORKFLOW_TEMPLATES[0]
const initialNodes: Node[] = ugcTemplate.nodes as unknown as Node[]
const initialEdges: Edge[] = ugcTemplate.edges as unknown as Edge[]

const getDefaultNodeData = (type: string) => {
  return DEFAULT_NODE_DATA[type as keyof typeof DEFAULT_NODE_DATA] || {}
}

const handleClearCanvas = () => {
  // Implementation for clearing the canvas
}

export default function AgentBuilder() {
  const t = useT()
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [showExecution, setShowExecution] = useState(false)
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set())
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())
  const [showRuns, setShowRuns] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])
  const [stopAtNodeId, setStopAtNodeId] = useState<string | null>(null)
  const [showCodeExport, setShowCodeExport] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const nodeIdCounter = useRef(0)
  const hasInitialFit = useRef(false)

  useEffect(() => {
    const maxId = Math.max(...nodes.map((n) => Number.parseInt(n.id) || 0), 0)
    nodeIdCounter.current = maxId + 1
  }, [nodes])

  useEffect(() => {
    if (reactFlowInstance && !hasInitialFit.current && nodes.length > 0) {
      hasInitialFit.current = true
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.3,
          minZoom: 0.5,
          maxZoom: 1.2,
        })
      }, 100)
    }
  }, [reactFlowInstance, nodes.length])

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setExpandedNodeId((prev) => (prev === node.id ? null : node.id))
    setShowExecution(false)
    setNewNodeIds((prev) => {
      const next = new Set(prev)
      next.delete(node.id)
      return next
    })
  }, [])

  const onPaneClick = useCallback(() => {
    setExpandedNodeId(null)
  }, [])

  const onAddNode = useCallback(
    (type: string) => {
      if (!reactFlowInstance) return

      const newId = `${Date.now()}-${nodeIdCounter.current++}`
      const newNode: Node = {
        id: newId,
        type,
        position: reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }),
        data: getDefaultNodeData(type),
      }

      setNodes((nds) => [...nds, newNode])
      setNewNodeIds((prev) => new Set(prev).add(newId))
    },
    [reactFlowInstance],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!reactFlowWrapper.current || !reactFlowInstance) return

      const type = event.dataTransfer.getData("application/reactflow")
      if (!type) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newId = `${Date.now()}-${nodeIdCounter.current++}`
      const newNode: Node = {
        id: newId,
        type,
        position,
        data: getDefaultNodeData(type),
      }

      setNodes((nds) => [...nds, newNode])
      setNewNodeIds((prev) => new Set(prev).add(newId))
    },
    [reactFlowInstance],
  )

  const onUpdateNode = useCallback((nodeId: string, data: any) => {
    // Merge (don't replace) so status/output written by other handlers mid-run aren't clobbered.
    setNodes((nds) => nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node)))
  }, [])

  const handleNodeStatusChange = useCallback((nodeId: string, status: "idle" | "running" | "completed" | "error") => {
    setNodes((nds) => nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, status } } : node)))
    setRunningNodeIds((prev) => {
      const next = new Set(prev)
      if (status === "running") {
        next.add(nodeId)
      } else {
        next.delete(nodeId)
      }
      return next
    })
  }, [])

  const handleNodeOutputChange = useCallback((nodeId: string, output: any) => {
    setNodes((nds) => nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, output } } : node)))
  }, [])

  const handleRun = useCallback((targetNodeId?: string | null) => {
    setStopAtNodeId(targetNodeId || null)
    setShowExecution(true)
    setExpandedNodeId(null)
    setTimeout(() => {
      const executeButton = document.querySelector("[data-execute-workflow]") as HTMLButtonElement
      if (executeButton) {
        executeButton.click()
      }
    }, 100)
  }, [])

  // Get nodes that can be run to (excluding start/end)
  const runnableNodes = nodes.filter(n => n.type !== "start" && n.type !== "end")

  const NODE_LABELS: Record<string, string> = {
    textModel: t("pcsn.node.textModel"),
    prompt: t("pcsn.node.prompt"),
    conditional: t("pcsn.node.condition"),
    httpRequest: t("pcsn.node.http"),
    imageGeneration: t("pcsn.node.imageGen"),
    javascript: t("pcsn.node.javascript"),
    audio: t("pcsn.node.audio"),
    embeddingModel: t("pcsn.node.embedding"),
    tool: t("pcsn.node.tool"),
    structuredOutput: t("pcsn.node.structured"),
    memory: t("pcsn.node.memory"),
    ugcModel: t("pcsn.node.presenter"),
    productUpload: t("pcsn.node.property"),
    script: t("pcsn.node.listingScript"),
    videoGeneration: t("pcsn.node.videoGeneration"),
  }

  const nodesWithState = nodes.map((node) => ({
    ...node,
    className: newNodeIds.has(node.id) ? "node-new" : undefined,
    data: {
      ...node.data,
      isExpanded: expandedNodeId === node.id,
      onUpdate: (newData: any) => onUpdateNode(node.id, newData),
    },
  }))

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const handleLoadTemplate = useCallback(
    (templateNodes: Node[], templateEdges: Edge[]) => {
      setNodes(templateNodes)
      setEdges(templateEdges)
      setExpandedNodeId(null)
      setNewNodeIds(new Set())

      const maxId = Math.max(
        ...templateNodes.map((n) => {
          const parts = n.id.split("-")
          return Number.parseInt(parts[parts.length - 1]) || Number.parseInt(n.id) || 0
        }),
        0,
      )
      nodeIdCounter.current = maxId + 1

      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.2 })
      }, 100)
    },
    [reactFlowInstance],
  )

  const animatedEdges = edges.map((edge) => ({
    ...edge,
    animated: runningNodeIds.has(edge.source) || runningNodeIds.has(edge.target),
  }))

  const handleRunComplete = useCallback((run: Run) => {
    setRuns((prev) => [run, ...prev])
  }, [])

  const handleClearRuns = useCallback(() => {
    setRuns([])
  }, [])

  const rightPanelOpen = showExecution || showRuns

  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col bg-background">
      <div className="relative flex flex-1 overflow-hidden">
        {/* Smart-form shortcut — the one-screen alternative to this canvas */}
        <Link
          href="/freehold-intelligence/creative-studio/quick"
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/95 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm transition hover:text-foreground/80"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {t("cs.quick.link")}
        </Link>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          <TooltipProvider delayDuration={300}>
            {/* Templates */}
            <div className="flex items-center rounded-lg border border-border bg-background/95 backdrop-blur-sm">
              <TemplatesMenu onLoadTemplate={handleLoadTemplate} />
            </div>

            {/* History */}
            <div className="flex items-center rounded-lg border border-border bg-background/95 backdrop-blur-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => {
                      setShowRuns(true)
                      setShowExecution(false)
                    }}
                  >
                    <Clock className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("pcs.run.history")}</TooltipContent>
              </Tooltip>
            </div>

            {/* Group 3: Run with dropdown */}
            <div className="flex items-center rounded-lg border border-border bg-background/95 backdrop-blur-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 px-3 rounded-r-none" onClick={() => handleRun(null)}>
                    <Play className="h-4 w-4 mr-1.5" />
                    <span className="text-xs">{t("pcs.run.runAll")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("pcs.run.runFull")}</TooltipContent>
              </Tooltip>
              <div className="w-px h-6 bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-8 p-0 rounded-l-none">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{t("pcs.run.runUpTo")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {runnableNodes.length > 0 ? (
                    runnableNodes.map((node) => (
                      <DropdownMenuItem
                        key={node.id}
                        onClick={() => handleRun(node.id)}
                        className="text-xs"
                      >
                        <StopCircle className="h-3.5 w-3.5 mr-2 text-amber-500" />
                        {NODE_LABELS[node.type || ""] || node.type}
                        {node.data?.label ? ` (${node.data.label})` : ""}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {t("pcs.run.noRunTargets")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodesWithState}
            edges={animatedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, minZoom: 0.5, maxZoom: 1.2 }}
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            <Background className="bg-background" gap={24} size={1} color="var(--border)" />
          </ReactFlow>
        </div>

        {showExecution && (
          <ExecutionPanel
            nodes={nodes}
            edges={edges}
            onClose={() => setShowExecution(false)}
            onNodeStatusChange={handleNodeStatusChange}
            onNodeOutputChange={handleNodeOutputChange}
            onRunComplete={handleRunComplete}
            initialStopAtNodeId={stopAtNodeId}
          />
        )}

        {showRuns && <RunsPanel onClose={() => setShowRuns(false)} runs={runs} onClearRuns={handleClearRuns} />}
      </div>

      <FloatingAddButton onAddNode={onAddNode} />
    </div>
  )
}
