"use client"

import type React from "react"
import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { User, Lock, Unlock, Play } from "lucide-react"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type UgcModelNodeData = {
  ethnicity: string
  gender: string
  ageRange: string
  description?: string
  isLocked?: boolean
  lockedImageUrl?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: any // Now outputs parameters object, not image
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

const ETHNICITIES = [
  { value: "caucasian", label: "Caucasian" },
  { value: "african", label: "African" },
  { value: "asian", label: "Asian" },
  { value: "hispanic", label: "Hispanic/Latino" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "south-asian", label: "South Asian" },
  { value: "mixed", label: "Mixed" },
]

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
]

const AGE_RANGES = [
  { value: "18-25", label: "18-25" },
  { value: "26-35", label: "26-35" },
  { value: "36-45", label: "36-45" },
  { value: "46-55", label: "46-55" },
  { value: "56+", label: "56+" },
]

function UgcModelNode({ id, data, selected }: NodeProps<Node<UgcModelNodeData>>) {
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

  const currentEthnicity = data.ethnicity || "caucasian"
  const currentGender = data.gender || "female"
  const currentAgeRange = data.ageRange || "26-35"

  return (
    <div
      className={`w-[280px] rounded-md border bg-card transition-colors duration-150 ${getStatusColor(status, selected)}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">UGC Model</span>
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
                {isLocked ? "Unlock to regenerate with new parameters" : "Lock to reuse the generated image"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!isExpanded && (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {GENDERS.find(g => g.value === currentGender)?.label}, {ETHNICITIES.find(e => e.value === currentEthnicity)?.label}
            </div>
            {isLocked && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-mono">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Gender</Label>
              <Select value={currentGender} onValueChange={(value) => handleUpdate("gender", value)} disabled={isLocked}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender.value} value={gender.value} className="text-xs py-1.5">
                      {gender.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Ethnicity</Label>
              <Select value={currentEthnicity} onValueChange={(value) => handleUpdate("ethnicity", value)} disabled={isLocked}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETHNICITIES.map((eth) => (
                    <SelectItem key={eth.value} value={eth.value} className="text-xs py-1.5">
                      {eth.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Age Range</Label>
              <Select value={currentAgeRange} onValueChange={(value) => handleUpdate("ageRange", value)} disabled={isLocked}>
                <SelectTrigger className="h-8 text-xs font-mono" onMouseDown={stopPropagation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((age) => (
                    <SelectItem key={age.value} value={age.value} className="text-xs py-1.5">
                      {age.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Additional Description (optional)</Label>
              <Textarea
                value={data.description || ""}
                onChange={(e) => handleUpdate("description", e.target.value)}
                onMouseDown={stopPropagation}
                placeholder="e.g., wearing casual clothing, smiling warmly..."
                className="min-h-[60px] text-xs font-mono resize-none"
                disabled={isLocked}
              />
            </div>

            {isLocked && data.lockedImageUrl && (
              <div className="space-y-1.5">
                <Label className="text-[10px] text-amber-500">Locked Model Preview</Label>
                <div className="rounded border border-amber-500/30 overflow-hidden">
                  <img 
                    src={data.lockedImageUrl || "/placeholder.svg"} 
                    alt="Locked model" 
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
            processing
          </div>
        )}

        {status === "completed" && (
          <div className="mt-2 text-[10px] text-green-600 dark:text-green-400 font-mono">
            Parameters ready
          </div>
        )}

        {isExpanded && !isLocked && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[9px] text-muted-foreground text-center">
              These parameters will be used by the Image Generation node to create a realistic model image.
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

export default memo(UgcModelNode)
