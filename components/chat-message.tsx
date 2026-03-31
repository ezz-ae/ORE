"use client"

import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Property, Project } from "@/lib/types/project"
import { PropertyCard } from "@/components/property-card"
import { ProjectComparatorClient } from "@/components/project-comparator-client"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: Date
  properties?: Property[]
  projects?: Project[]
}

export function ChatMessage({ role, content, timestamp, properties = [], projects = [] }: ChatMessageProps) {
  const isUser = role === "user"

  const renderContent = () => {
    if (isUser) {
      return <div className="whitespace-pre-wrap">{content}</div>
    }

    const parts = content.split(/(\[PROJECT:[a-z0-9-]+\]|\[COMPARE:[a-z0-9-,]+\])/g)

    return (
      <div className="flex flex-col gap-4">
        {parts.map((part, index) => {
          if (part.startsWith("[PROJECT:")) {
            const slug = part.replace("[PROJECT:", "").replace("]", "")
            const property = properties.find(p => p.slug === slug)
            if (property) {
              return (
                <div key={index} className="w-full max-w-sm mt-2 mb-2">
                  <PropertyCard property={property} compact />
                </div>
              )
            }
          }

          if (part.startsWith("[COMPARE:")) {
            const slugsStr = part.replace("[COMPARE:", "").replace("]", "")
            const slugs = slugsStr.split(",")
            const comparisonProjects = projects.filter(p => slugs.includes(p.slug))
            if (comparisonProjects.length >= 2) {
              return (
                <div key={index} className="w-full mt-4 mb-4">
                  <ProjectComparatorClient projects={comparisonProjects} />
                </div>
              )
            }
          }

          if (part.trim()) {
            return (
              <div key={index} className="whitespace-pre-wrap">
                {part}
              </div>
            )
          }

          return null
        })}
      </div>
    )
  }

  return (
    <div className={cn("flex w-full gap-2 sm:gap-4 py-2 sm:py-4 px-2 sm:px-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="mt-0.5 h-7 w-7 sm:h-8 sm:w-8 border border-border/50 shadow-sm shrink-0">
          <AvatarImage src="/images/ai-avatar.png" alt="AI" />
          <AvatarFallback className="ore-gradient text-black">
            <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col max-w-[85%] sm:max-w-[80%] md:max-w-2xl", isUser ? "items-end" : "items-start")}>
        <div 
          className={cn(
            "prose prose-neutral dark:prose-invert max-w-none break-words px-3 py-2 sm:px-5 sm:py-3 shadow-sm text-sm leading-relaxed",
            isUser 
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" 
              : "bg-muted text-foreground rounded-2xl rounded-tl-sm w-full"
          )}
        >
          {renderContent()}
        </div>
        
        {timestamp && (
          <div className={cn("text-[10px] text-muted-foreground/60 uppercase tracking-widest px-1", isUser && "text-right")}>
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  )
}
