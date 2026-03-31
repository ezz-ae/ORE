"use client"

import { Check, Clock, Calendar, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  date: string
  title: string
  icon: React.ElementType
  isPast: boolean
}

interface ProjectTimelineProps {
  timeline: {
    launchDate?: string
    constructionStart?: string
    expectedCompletion?: string
    handoverDate?: string
  }
}

export function ProjectTimeline({ timeline }: ProjectTimelineProps) {
  const events: TimelineEvent[] = []
  const now = new Date()

  if (timeline.launchDate) {
    events.push({
      date: timeline.launchDate,
      title: "Project Launch",
      icon: Rocket,
      isPast: new Date(timeline.launchDate) < now,
    })
  }
  if (timeline.constructionStart) {
    events.push({
      date: timeline.constructionStart,
      title: "Construction Start",
      icon: Clock,
      isPast: new Date(timeline.constructionStart) < now,
    })
  }
  if (timeline.expectedCompletion) {
    events.push({
      date: timeline.expectedCompletion,
      title: "Expected Completion",
      icon: Calendar,
      isPast: new Date(timeline.expectedCompletion) < now,
    })
  }
  if (timeline.handoverDate) {
    events.push({
      date: timeline.handoverDate,
      title: "Handover",
      icon: Check,
      isPast: new Date(timeline.handoverDate) < now,
    })
  }
  
  // Sort events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-0.5 bg-border" />
      
      <div className="space-y-8">
        {events.map((event, index) => (
          <div key={index} className="flex items-start gap-6">
            <div className={cn(
              "z-10 flex h-10 w-10 items-center justify-center rounded-full border-2",
              event.isPast ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border"
            )}>
              <event.icon className="h-5 w-5" />
            </div>
            <div className="pt-1.5">
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
