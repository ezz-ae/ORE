"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutTemplate, Video, FileText, ImageIcon, Zap } from "lucide-react"
import { useT } from "@/lib/i18n/provider"
import { WORKFLOW_TEMPLATES } from "@/lib/creative-studio/constants"
import type { Node, Edge } from "@xyflow/react"

interface TemplatesMenuProps {
  onLoadTemplate: (nodes: Node[], edges: Edge[]) => void
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "property-reel": <Video className="h-3.5 w-3.5" />,
  "instagram-ad": <ImageIcon className="h-3.5 w-3.5" />,
  "story-creative": <FileText className="h-3.5 w-3.5" />,
  "quick-image": <Zap className="h-3.5 w-3.5" />,
}

export function TemplatesMenu({ onLoadTemplate }: TemplatesMenuProps) {
  const t = useT()
  const [open, setOpen] = useState(false)

  const handleSelectTemplate = (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      onLoadTemplate(template.nodes as unknown as Node[], template.edges as unknown as Edge[])
    }
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-r-none">
          <LayoutTemplate className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide py-1.5 px-2">
          {t("pcs.tpl.readySets")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {WORKFLOW_TEMPLATES.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template.id)}
            className="flex flex-col items-start gap-0.5 py-2 px-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {TEMPLATE_ICONS[template.id] || <Video className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm font-medium">{template.name}</span>
            </div>
            <span className="text-xs text-muted-foreground pl-5">{template.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
