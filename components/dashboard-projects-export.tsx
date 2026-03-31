"use client"

import { Button } from "@/components/ui/button"
import type { DashboardProjectRow } from "@/lib/ore"

interface DashboardProjectsExportProps {
  projects: DashboardProjectRow[]
}

export function DashboardProjectsExport({ projects }: DashboardProjectsExportProps) {
  const handleExport = () => {
    if (!projects.length) return
    const headers = ["name", "area", "status", "priceFrom", "priceTo", "roi", "unitsAvailable"]
    const lines = [
      headers.join(","),
      ...projects.map((project) =>
        [
          project.name,
          project.area || "",
          project.status || "",
          project.priceFrom ?? "",
          project.priceTo ?? "",
          project.expectedRoi ?? "",
          project.unitsAvailable ?? "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "dashboard-projects.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={!projects.length}>
      Export CSV
    </Button>
  )
}
