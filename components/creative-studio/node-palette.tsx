"use client"

import type React from "react"
import { MessageSquare, Layers, Wrench, FileText, ImageIcon, Code, Play, Flag, GitBranch, Globe, User, Package, Video } from "lucide-react"

type NodeType = {
  type: string
  label: string
  icon: React.ReactNode
}

const nodeTypes: NodeType[] = [
  { type: "start", label: "Start", icon: <Play className="h-3.5 w-3.5" /> },
  { type: "prompt", label: "Prompt", icon: <FileText className="h-3.5 w-3.5" /> },
  { type: "textModel", label: "Text Model", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { type: "imageGeneration", label: "Image", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { type: "ugcModel", label: "UGC Model", icon: <User className="h-3.5 w-3.5" /> },
  { type: "productUpload", label: "Product", icon: <Package className="h-3.5 w-3.5" /> },
  { type: "script", label: "Script", icon: <FileText className="h-3.5 w-3.5" /> },
  { type: "videoGeneration", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
  { type: "httpRequest", label: "HTTP", icon: <Globe className="h-3.5 w-3.5" /> },
  { type: "conditional", label: "Condition", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { type: "javascript", label: "JavaScript", icon: <Code className="h-3.5 w-3.5" /> },
  { type: "embeddingModel", label: "Embedding", icon: <Layers className="h-3.5 w-3.5" /> },
  { type: "tool", label: "Tool", icon: <Wrench className="h-3.5 w-3.5" /> },
  { type: "end", label: "End", icon: <Flag className="h-3.5 w-3.5" /> },
]

type NodePaletteProps = {
  onAddNode: (type: string) => void
  onClose?: () => void
}

export function NodePalette({ onAddNode, onClose }: NodePaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleAddNode = (type: string) => {
    onAddNode(type)
    onClose?.()
  }

  return (
    <div className="w-44 rounded-lg border border-border bg-card p-2 shadow-lg">
      <div className="space-y-0.5">
        {nodeTypes.map((node) => (
          <button
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            onClick={() => handleAddNode(node.type)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <span className="text-muted-foreground">{node.icon}</span>
            {node.label}
          </button>
        ))}
      </div>
    </div>
  )
}
