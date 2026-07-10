"use client"

import type React from "react"
import { memo, useMemo, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { FileText, Clock, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getStatusColor } from "@/lib/creative-studio/node-utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"

export type ScriptNodeData = {
  script?: string
  status?: "idle" | "running" | "completed" | "error"
  output?: string
  isExpanded?: boolean
  onUpdate?: (data: any) => void
}

// Average speaking rate: ~15 characters per second.
// Scripts target a fixed 8-second reel (the default video length), so the
// character budget is a fixed 120 chars (~8s spoken) to keep voiceover on time.
const CHARS_PER_SECOND = 15
const MAX_SECONDS = 8
const MAX_CHARACTERS = MAX_SECONDS * CHARS_PER_SECOND

function ScriptNode({ data, selected }: NodeProps<Node<ScriptNodeData>>) {
  const t = useT()
  const status = data.status || "idle"
  const isExpanded = data.isExpanded || false
  const script = data.script || ""

  const maxCharacters = MAX_CHARACTERS
  const maxSeconds = MAX_SECONDS

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

  const [generating, setGenerating] = useState(false)
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const brief = script.trim() || "a premium Dubai property"
      const res = await fetch("/api/freehold/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write a punchy vertical property-reel voiceover for ${brief}. One or two short sentences, under ${maxCharacters} characters (~${maxSeconds}s spoken), ending with a clear call to action. Return only the voiceover text, no quotes or notes.`,
          system: "You are a senior Dubai real-estate video copywriter for Freehold Property UAE. Write natural spoken lines for short social reels. No placeholders, no emojis.",
        }),
      })
      const d = await res.json()
      const text = String(d.text || "").trim().replace(/^["']|["']$/g, "")
      if (text) { handleUpdate("script", text); toast.success(t("pcsn.script.genOk")) }
      else toast.error(t("pcsn.script.genErr"))
    } catch {
      toast.error(t("pcsn.script.genErr"))
    } finally {
      setGenerating(false)
    }
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
          <span className="text-[11px] font-medium text-foreground">{t("pcsn.node.listingScript")}</span>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{t("pcsn.script.dur", { sec: maxSeconds })}</span>
          </div>
        </div>

        {!isExpanded && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
            {truncatedScript}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-3 nodrag nopan" onClick={stopPropagation}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">{t("pcsn.script.voiceover")}</Label>
                <span className={`text-[10px] font-mono ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {characterCount}/{maxCharacters}
                </span>
              </div>
              <Textarea
                value={script}
                onChange={(e) => handleScriptChange(e.target.value)}
                onMouseDown={stopPropagation}
                placeholder={t("pcsn.script.ph")}
                className={`min-h-[100px] text-xs font-mono resize-none ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 gap-1.5 text-[10px]"
                disabled={generating}
                onClick={(e) => { e.stopPropagation(); handleGenerate() }}
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generating ? t("pcsn.script.writing") : t("pcsn.script.generate")}
              </Button>
              {isOverLimit && (
                <p className="text-[9px] text-destructive">
                  {t("pcsn.script.over", { sec: maxSeconds, max: maxCharacters })}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
              <span>{t("pcsn.script.estimated")}</span>
              <span className="font-mono">{estimatedSeconds}s / {maxSeconds}s</span>
            </div>

            <p className="text-[9px] text-muted-foreground">
              {t("pcsn.script.help", { max: maxCharacters, sec: maxSeconds })}
            </p>
          </div>
        )}

        {status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
            {t("pcsn.processing")}
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
