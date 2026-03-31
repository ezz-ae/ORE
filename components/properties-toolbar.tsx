"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Grid, List } from "lucide-react"

interface PropertiesToolbarProps {
  total: number
  page: number
  pageSize: number
  sort: string
  view: string
}

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

export function PropertiesToolbar({ total, page, pageSize, sort, view }: PropertiesToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    if (key !== "page") {
      params.set("page", "1")
    }
    router.push(`/properties?${params.toString()}`)
  }

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {Math.min(page * pageSize, total)}
        </span>{" "}
        of <span className="font-semibold text-foreground">{countFormatter.format(total)}</span> properties
      </p>

      <div className="flex items-center gap-2">
        <Select value={sort} onValueChange={(value) => updateParam("sort", value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Best Match</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="roi">Highest ROI</SelectItem>
            <SelectItem value="yield">Best Rental Yield</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1 rounded-md border border-border p-1">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateParam("view", "grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateParam("view", "list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
