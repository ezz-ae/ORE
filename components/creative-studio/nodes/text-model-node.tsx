"use client"

import type React from "react"
import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { MessageSquare } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type TextModelNodeData = {
  model: string
  temperature: number
  maxTokens: number
  prompt?: string
  status?: "idle" | "running" | "completed" | "error"
  structuredOutput?: boolean
  schema?: string
  schemaName?: string
  output?: any
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

function TextModelNode({ data, selected }: NodeProps<Node<TextModelNodeData>>) {
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false

  const handleUpdate = (field: string, value: any) => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      data.onUpdate({ ...restData, [field]: value })
    }
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className={`w-[280px] rounded border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Text Model</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground font-mono">
            <span>temp: {data.temperature || 0.7}</span>
            <span>max: {data.maxTokens || 2000}</span>
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5" onMouseDown={stopPropagation}>
              <Label className="text-xs text-muted-foreground">Temperature: {data.temperature || 0.7}</Label>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[data.temperature || 0.7]}
                onValueChange={([value]) => handleUpdate("temperature", value)}
                className="py-1 nodrag"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Tokens</Label>
              <Input
                type="number"
                value={data.maxTokens || 2000}
                onChange={(e) => handleUpdate("maxTokens", Number.parseInt(e.target.value))}
                className="h-8 text-xs font-mono nodrag"
                onMouseDown={stopPropagation}
              />
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            <span>Running</span>
          </div>
        )}

        {data.output && (
          <div className="mt-2 max-h-20 overflow-y-auto rounded bg-secondary/50 p-2">
            <p className="text-xs text-muted-foreground line-clamp-3 font-mono">
              {typeof data.output === "string" ? data.output : JSON.stringify(data.output, null, 2)}
            </p>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
      />
    </div>
  )
}

export default memo(TextModelNode)
