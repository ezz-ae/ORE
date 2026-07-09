"use client"

import type React from "react"
import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Video, Play } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CREATIVE_FORMATS } from "@/lib/creative-studio/constants"

const VIDEO_FORMATS = CREATIVE_FORMATS.filter((f) => f.kind === "video")

export type VideoGenerationNodeData = {
  model?: string
  format?: string
  aspectRatio?: string
  duration?: number
  status?: "idle" | "running" | "completed" | "error"
  output?: string // Video URL
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 (Vertical/Stories)" },
  { value: "16:9", label: "16:9 (Horizontal)" },
  { value: "1:1", label: "1:1 (Square -> 9:16)" },
]

const DURATIONS = [
  { value: "4s", label: "4 seconds" },
  { value: "6s", label: "6 seconds" },
  { value: "8s", label: "8 seconds" },
]

function VideoGenerationNode({ data, selected }: NodeProps<Node<VideoGenerationNodeData>>) {
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

  const currentAspectRatio = data.aspectRatio || "9:16"
  const currentFormat = data.format || "reels"
  const formatLabel = VIDEO_FORMATS.find((f) => f.value === currentFormat)?.label || "Reels"

  const selectFormat = (value: string) => {
    if (!data.onUpdate) return
    const f = VIDEO_FORMATS.find((x) => x.value === value)
    const { isExpanded: _e, onUpdate: _o, ...rest } = data
    data.onUpdate({ ...rest, format: value, aspectRatio: f?.aspect || data.aspectRatio })
  }

  return (
    <div
      className={`w-[280px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">Video</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{currentAspectRatio}</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {formatLabel}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-foreground font-medium">Format</Label>
              <Select value={currentFormat} onValueChange={selectFormat}>
                <SelectTrigger className="h-8 text-xs" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground">Video needs a video provider key in your environment. Image formats work by default.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Aspect Ratio</Label>
              <Select value={currentAspectRatio} onValueChange={(value) => handleUpdate("aspectRatio", value)}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value} className="text-xs py-1.5">
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Duration</Label>
              <Select value={data.duration?.toString() || "8s"} onValueChange={(value) => handleUpdate("duration", value)}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((dur) => (
                    <SelectItem key={dur.value} value={dur.value} className="text-xs py-1.5">
                      {dur.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded p-2 space-y-1">
              <p className="text-[9px] text-muted-foreground font-medium">Inputs (connect in order):</p>
              <ul className="text-[9px] text-muted-foreground list-disc list-inside space-y-0.5">
                <li>Top: Presenter image (Presenter/Image)</li>
                <li>Middle: Property image (optional)</li>
                <li>Bottom: Voiceover (Listing Script node)</li>
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                Requires FAL_KEY environment variable for Fal AI.
              </p>
            </div>

            {data.output && (
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Generated Video</Label>
                <div className="relative rounded border border-border overflow-hidden bg-black">
                  <video 
                    src={data.output} 
                    controls
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            generating video
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="model-input"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
        style={{ top: "30%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="product-input"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
        style={{ top: "50%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="script-input"
        className="!bg-muted-foreground/40 !border-0 !w-2 !h-2"
        style={{ top: "70%" }}
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

export default memo(VideoGenerationNode)
