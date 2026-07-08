"use client"

import type React from "react"
import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Video, Play } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVIDER_LOGOS } from "@/lib/creative-studio/constants"

export type VideoGenerationNodeData = {
  model: string
  aspectRatio?: string
  duration?: number
  status?: "idle" | "running" | "completed" | "error"
  output?: string // Video URL
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

const VIDEO_MODELS = [
  { value: "fal-ai/veo-3.1", label: "Veo 3.1", group: "Fal AI", description: "Image-to-video with audio (recommended)" },
]

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

  const getModelLabel = (modelValue: string) => {
    const model = VIDEO_MODELS.find((m) => m.value === modelValue)
    return model?.label || modelValue
  }

  const currentModel = data.model || "fal-ai/veo-3.1"
  const currentAspectRatio = data.aspectRatio || "9:16"

  return (
    <div
      className={`w-[280px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">Video Generation</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{currentAspectRatio}</span>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {getModelLabel(currentModel)}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Model</Label>
              <Select value={currentModel} onValueChange={(value) => handleUpdate("model", value)}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value} className="py-1.5">
                      <div className="flex items-center gap-2">
                        {PROVIDER_LOGOS[model.group] && (
                          <img
                            src={PROVIDER_LOGOS[model.group] || "/placeholder.svg"}
                            alt={model.group}
                            className="h-4 w-4 rounded-sm object-contain"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="text-xs">{model.label}</span>
                          <span className="text-[9px] text-muted-foreground">{model.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <li>Top: Model image (UGC Model/Image)</li>
                <li>Middle: Product image (optional)</li>
                <li>Bottom: Script/dialogue (Script node)</li>
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
