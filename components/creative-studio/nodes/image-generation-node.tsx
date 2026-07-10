"use client"

import type React from "react"
import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { ImageIcon, Lock, Unlock } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CREATIVE_FORMATS } from "@/lib/creative-studio/constants"
import { useT } from "@/lib/i18n/provider"

const IMAGE_FORMATS = CREATIVE_FORMATS.filter((f) => f.kind === "image")

export type ImageGenerationNodeData = {
  model: string
  format?: string
  aspectRatio?: string
  outputFormat?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: string // output is now a string (base64 data URL)
  isLocked?: boolean
  lockedImageUrl?: string
  isExpanded?: boolean
  onUpdate?: (data: any) => void
  connectedHandles?: string[]
}

function ImageGenerationNode({ data, selected }: NodeProps<Node<ImageGenerationNodeData>>) {
  const t = useT()
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const isLocked = data.isLocked || false

  const handleUpdate = (field: string, value: any) => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      data.onUpdate({ ...restData, [field]: value })
    }
  }

  const toggleLock = () => {
    if (data.onUpdate) {
      const { isExpanded, onUpdate, ...restData } = data
      if (isLocked) {
        // Unlock: clear the locked image
        data.onUpdate({ ...restData, isLocked: false, lockedImageUrl: undefined })
      } else if (data.output) {
        // Lock: save current output as locked image
        data.onUpdate({ ...restData, isLocked: true, lockedImageUrl: data.output })
      }
    }
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const currentFormat = data.format || "insta_ad"
  const formatLabel = IMAGE_FORMATS.find((f) => f.value === currentFormat)?.label || t("pcsn.img.creativeFallback")

  const selectFormat = (value: string) => {
    if (!data.onUpdate) return
    const f = IMAGE_FORMATS.find((x) => x.value === value)
    const { isExpanded: _e, onUpdate: _o, ...rest } = data
    data.onUpdate({ ...rest, format: value, aspectRatio: f?.aspect || data.aspectRatio })
  }

  return (
    <div
      className={`w-[260px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
<div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">{t("pcsn.node.image")}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLock()
                  }}
                  disabled={!data.output && !isLocked}
                >
                  {isLocked ? (
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isLocked ? t("pcsn.img.unlockTip") : t("pcsn.img.lockTip")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">{formatLabel}</div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3 nodrag nopan" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-foreground font-medium">{t("pcsn.img.format")}</Label>
              <Select value={currentFormat} onValueChange={selectFormat}>
                <SelectTrigger className="h-8 text-xs" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">{t("pcsn.img.aspect")}</Label>
              <Select value={data.aspectRatio || "1:1"} onValueChange={(value) => handleUpdate("aspectRatio", value)}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1" className="text-xs py-1.5">
                    1:1 ({t("pcsn.img.square")})
                  </SelectItem>
                  <SelectItem value="16:9" className="text-xs py-1.5">
                    16:9 ({t("pcsn.img.landscape")})
                  </SelectItem>
                  <SelectItem value="9:16" className="text-xs py-1.5">
                    9:16 ({t("pcsn.img.portrait")})
                  </SelectItem>
                  <SelectItem value="4:3" className="text-xs py-1.5">
                    4:3
                  </SelectItem>
                  <SelectItem value="3:4" className="text-xs py-1.5">
                    3:4
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            {t("pcsn.processing")}
          </div>
        )}

        {/* Show locked image */}
        {isLocked && data.lockedImageUrl && (
          <div className="mt-3 space-y-2">
            <div className="rounded overflow-hidden border border-amber-500/30">
              <img 
                src={data.lockedImageUrl || "/placeholder.svg"} 
                alt="Locked image" 
                className="w-full h-auto max-h-[200px] object-contain bg-muted/30"
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-amber-500 font-mono">
              <Lock className="h-3 w-3" />
              <span>{t("pcsn.img.lockedReuse")}</span>
            </div>
          </div>
        )}

        {/* Show generated image output (when not locked) */}
        {!isLocked && status === "completed" && data.output && typeof data.output === "string" && (data.output.startsWith("data:image/") || data.output.startsWith("https://")) && (
          <div className="mt-3 space-y-2">
            <div className="rounded overflow-hidden border border-green-500/30">
              <img 
                src={data.output || "/placeholder.svg"} 
                alt="Generated" 
                className="w-full h-auto max-h-[200px] object-contain bg-muted/30"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs bg-transparent"
              onClick={(e) => {
                e.stopPropagation()
                toggleLock()
              }}
            >
              <Lock className="mr-1.5 h-3 w-3" />
              {t("pcsn.img.lockThis")}
            </Button>
          </div>
        )}

        {!isLocked && status === "completed" && !data.output && (
          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-mono">
            {t("pcsn.img.noImage")}
          </div>
        )}

        {status === "error" && (
          <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-mono">
            {t("pcsn.img.genFailed")}
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

export default memo(ImageGenerationNode)
