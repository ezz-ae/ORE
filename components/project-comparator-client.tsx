"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/types/project"

interface ProjectComparatorClientProps {
  projects: Project[]
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

const getPriceRange = (project?: Project) => {
  if (!project) return "-"
  const units = Array.isArray(project.units) ? project.units : []
  const prices = units.flatMap((unit) => [unit.priceFrom, unit.priceTo]).filter((price) => Number.isFinite(price))
  if (!prices.length) return "Pricing on request"
  return `${formatPrice(Math.min(...prices))} - ${formatPrice(Math.max(...prices))}`
}

export function ProjectComparatorClient({ projects }: ProjectComparatorClientProps) {
  const [leftId, setLeftId] = useState(projects[0]?.id || "")
  const [rightId, setRightId] = useState(projects[1]?.id || projects[0]?.id || "")
  const [loading, setLoading] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  const leftProject = useMemo(
    () => projects.find((project) => project.id === leftId),
    [leftId, projects],
  )
  const rightProject = useMemo(
    () => projects.find((project) => project.id === rightId),
    [rightId, projects],
  )

  const handleScrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleDownload = async () => {
    if (!leftProject?.slug || !rightProject?.slug) return
    setLoading(true)
    try {
      const response = await fetch("/api/pdf/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [leftProject.slug, rightProject.slug] }),
      })
      if (!response.ok) throw new Error("PDF download failed")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "project-comparison.pdf"
      link.click()
      window.URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <Badge className="mb-4 ore-gradient" variant="secondary">
          Project Comparator
        </Badge>
        <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
          Compare Dubai Projects
        </h1>
        <p className="mt-4 text-muted-foreground">
          Select two projects to compare key investment metrics side by side.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Project Selection A</div>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger autoFocus className="h-12 rounded-xl bg-muted/30">
                <SelectValue placeholder="Select primary project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Project Selection B</div>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger className="h-12 rounded-xl bg-muted/30">
                <SelectValue placeholder="Select secondary project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" onClick={handleScrollToResults}>
          View Comparison
        </Button>
        <Button className="ore-gradient" disabled={loading || !leftProject || !rightProject} onClick={handleDownload}>
          {loading ? "Preparing PDF..." : "Download Comparison PDF"}
        </Button>
      </div>

      <div ref={resultsRef} className="scroll-mt-24 mt-10 grid gap-6 lg:grid-cols-2">
        {[leftProject, rightProject].map((project, index) => (
          <Card key={project?.id || index} className="rounded-[2rem] border-border shadow-md overflow-hidden bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary">{index === 0 ? "Primary Candidate" : "Comparison Match"}</div>
                <div className="font-serif text-3xl font-bold tracking-tight">{project?.name || "Select a project"}</div>
                <div className="text-sm text-muted-foreground leading-relaxed italic">{project?.tagline}</div>
              </div>

              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Area</span>
                  <span className="font-semibold text-foreground">{project?.location?.area || "-"}</span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Starting Price</span>
                  <span className="font-bold ore-text-gradient text-lg">{getPriceRange(project)}</span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Expected ROI</span>
                  <span className="font-bold text-green-600">
                    {typeof project?.investmentHighlights?.expectedROI === "number"
                      ? `${project.investmentHighlights.expectedROI}%`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Rental Yield</span>
                  <span className="font-bold text-foreground">
                    {typeof project?.investmentHighlights?.rentalYield === "number"
                      ? `${project.investmentHighlights.rentalYield}%`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Entry Threshold</span>
                  <span className="font-semibold text-foreground">
                    {typeof project?.paymentPlan?.downPayment === "number" ? `${project.paymentPlan.downPayment}% Down` : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Completion</span>
                  <span className="font-semibold text-foreground">{project?.timeline?.handoverDate || "-"}</span>
                </div>
              </div>
              
              {project && (
                <div className="pt-6">
                  <Button variant="outline" className="w-full h-11 rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5" asChild>
                    <Link href={project.slug ? `/projects/${project.slug}` : "/projects"}>View Full Profile</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
