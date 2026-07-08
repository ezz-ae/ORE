"use client"

import type React from "react"
import { memo, useMemo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { FileText, Clock } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type ScriptNodeData = {
  script?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: string
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

// Average speaking rate: ~15 characters per second
// Character limits scale with video duration for accurate timing
const CHARS_PER_SECOND = 15
const DURATION_LIMITS: Record<string, { maxChars: number; seconds: number }> = {
  "4s": { maxChars: 60, seconds: 4 },
  "6s": { maxChars: 90, seconds: 6 },
  "8s": { maxChars: 120, seconds: 8 },
}
const DEFAULT_DURATION = "8s"

function ScriptNode({ data, selected }: NodeProps<Node<ScriptNodeData>>) {
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const script = data.script || ""

  // Get limits based on the connected video duration (default to 8s)
  const durationKey = DEFAULT_DURATION
  const limits = DURATION_LIMITS[durationKey] || DURATION_LIMITS["8s"]
  const maxCharacters = limits.maxChars
  const maxSeconds = limits.seconds

  const characterCount = script.length
  const isOverLimit = characterCount > maxCharacters
  const estimatedSeconds = Math.min(Math.round(characterCount / CHARS_PER_SECOND), maxSeconds)

  const handleUpdate = (field: string, value: any) => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      data.onUpdate({ ...restData, [field]: value })
    }
  }

  const handleScriptChange = (value: string) => {
    // Allow typing but warn if over limit
    handleUpdate("script", value)
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const truncatedScript = useMemo(() => {
    if (script.length > 50) {
      return script.substring(0, 50) + "..."
    }
    return script || "No script entered"
  }, [script])

  return (
    <div
      className={`w-[280px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">Video Script</span>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{maxSeconds}s max</span>
          </div>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {truncatedScript}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Dialogue Script</Label>
                <span className={`text-[10px] font-mono ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {characterCount}/{maxCharacters}
                </span>
              </div>
              <Textarea
                value={script}
                onChange={(e) => handleScriptChange(e.target.value)}
                onMouseDown={stopPropagation}
                placeholder="Enter the dialogue for the model to speak in the video..."
                className={`min-h-[100px] text-xs font-mono resize-none ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {isOverLimit && (
                <p className="text-[9px] text-destructive">
                  Script exceeds the {maxSeconds}-second limit ({maxCharacters} chars). Please shorten your dialogue.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
              <span>Estimated duration:</span>
              <span className="font-mono">{estimatedSeconds}s / {maxSeconds}s</span>
            </div>

            <p className="text-[9px] text-muted-foreground">
              Write the dialogue the model will speak. Keep it under {maxCharacters} characters (~{maxSeconds}s of speech).
            </p>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            processing script
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

export default memo(ScriptNode)
