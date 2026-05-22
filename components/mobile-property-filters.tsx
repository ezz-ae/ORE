"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Filter } from "lucide-react"
import { PropertyFilters } from "./property-filters"

interface MobilePropertyFiltersProps {
  areas?: string[]
  developers?: string[]
  basePath?: string
  resultAnchor?: string
}

export function MobilePropertyFilters({ areas, developers, basePath = "/properties", resultAnchor = "properties-results" }: MobilePropertyFiltersProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span>Filter</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[320px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Filter Inventory</SheetTitle>
        </SheetHeader>
        <div className="py-6">
          <PropertyFilters areas={areas} developers={developers} basePath={basePath} resultAnchor={resultAnchor} />
        </div>
        <SheetFooter>
           <p className="text-xs text-muted-foreground">Apply filters to refine your search.</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
