"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"

const defaultDubaiAreas = [
  "Dubai Marina", "Downtown Dubai", "Palm Jumeirah", "Business Bay",
  "JBR", "Arabian Ranches", "Dubai Hills Estate", "Jumeirah Village Circle",
  "Dubai Sports City", "Dubai Silicon Oasis", "Meydan", "The Springs"
]

const propertyTypes = [
  "All Types", "Apartment", "Villa", "Townhouse", "Penthouse", "Studio"
]

const listingStatuses = [
  "All Statuses", "selling", "launching", "upcoming", "completed",
]

const defaultDevelopers = [
  "All Developers", "Emaar", "Damac", "Nakheel", "Dubai Properties",
  "Meraas", "Azizi", "Sobha", "Select Group"
]

const sliderFormatter = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 })

interface PropertyFiltersProps {
  collapsible?: boolean
  defaultOpen?: boolean
  areas?: string[]
  developers?: string[]
}

export function PropertyFilters({
  collapsible = false,
  defaultOpen = true,
  areas,
  developers,
}: PropertyFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dynamicAreas = areas?.filter(Boolean) ?? []
  const dynamicDevelopers = developers?.filter(Boolean) ?? []
  const availableAreas =
    dynamicAreas.length > 0
      ? Array.from(new Set([...dynamicAreas, ...defaultDubaiAreas]))
      : defaultDubaiAreas
  const availableDevelopers =
    dynamicDevelopers.length > 0
      ? Array.from(new Set([...dynamicDevelopers, ...defaultDevelopers]))
      : defaultDevelopers

  const initialAreas = searchParams.get("areas")?.split(",").filter(Boolean) ?? []
  const initialBedrooms = searchParams.get("beds")?.split(",").filter(Boolean) ?? []
  const initialPropertyType = searchParams.get("type") || "All Types"
  const initialStatus = searchParams.get("status") || "All Statuses"
  const initialDeveloper = searchParams.get("developer") || "All Developers"
  const initialCurrency = searchParams.get("currency") || "AED"
  const initialFreehold = searchParams.get("freehold") === "true"
  const initialGoldenVisa = searchParams.get("goldenVisa") === "true"
  const initialMinPrice = Number(searchParams.get("minPrice") || 0)
  const initialMaxPrice = Number(searchParams.get("maxPrice") || 10000000)

  const [priceRange, setPriceRange] = React.useState([initialMinPrice, initialMaxPrice])
  const [bedrooms, setBedrooms] = React.useState<string[]>(initialBedrooms)
  const [propertyType, setPropertyType] = React.useState(initialPropertyType)
  const [status, setStatus] = React.useState(initialStatus)
  const [selectedAreas, setSelectedAreas] = React.useState<string[]>(initialAreas)
  const [developer, setDeveloper] = React.useState(initialDeveloper)
  const [currency, setCurrency] = React.useState(initialCurrency)
  const [freeholdOnly, setFreeholdOnly] = React.useState(initialFreehold)
  const [goldenVisaEligible, setGoldenVisaEligible] = React.useState(initialGoldenVisa)

  const toggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  const toggleBedroom = (bed: string) => {
    setBedrooms(prev =>
      prev.includes(bed) ? prev.filter(b => b !== bed) : [...prev, bed]
    )
  }

  const clearFilters = () => {
    setPriceRange([0, 10000000])
    setBedrooms([])
    setPropertyType("All Types")
    setStatus("All Statuses")
    setSelectedAreas([])
    setDeveloper("All Developers")
    setFreeholdOnly(false)
    setGoldenVisaEligible(false)
    const params = new URLSearchParams(searchParams.toString())
    ;["areas", "beds", "type", "status", "developer", "minPrice", "maxPrice", "freehold", "goldenVisa"].forEach((key) =>
      params.delete(key),
    )
    params.set("page", "1")
    router.push(`/properties?${params.toString()}#properties-results`, { scroll: false })
  }

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedAreas.length) {
      params.set("areas", selectedAreas.join(","))
    } else {
      params.delete("areas")
    }
    if (bedrooms.length) {
      params.set("beds", bedrooms.join(","))
    } else {
      params.delete("beds")
    }
    if (propertyType && propertyType !== "All Types") {
      params.set("type", propertyType)
    } else {
      params.delete("type")
    }
    if (status && status !== "All Statuses") {
      params.set("status", status)
    } else {
      params.delete("status")
    }
    if (developer && developer !== "All Developers") {
      params.set("developer", developer)
    } else {
      params.delete("developer")
    }
    params.set("minPrice", String(priceRange[0]))
    params.set("maxPrice", String(priceRange[1]))
    params.set("freehold", String(freeholdOnly))
    params.set("goldenVisa", String(goldenVisaEligible))
    params.set("currency", currency)
    params.set("page", "1")
    router.push(`/properties?${params.toString()}#properties-results`, { scroll: false })
  }

  const filtersBody = (
    <div className="space-y-6">
      {/* Currency Toggle */}
      <div>
        <Label className="text-sm font-medium">Currency</Label>
        <div className="mt-2 flex gap-2">
          <Button
            variant={currency === "AED" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrency("AED")}
            className={currency === "AED" ? "ore-gradient" : ""}
          >
            AED
          </Button>
          <Button
            variant={currency === "USD" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrency("USD")}
            className={currency === "USD" ? "ore-gradient" : ""}
          >
            USD
          </Button>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <Label className="text-sm font-medium">
          Price Range ({currency})
        </Label>
      <div className="mt-4 space-y-4">
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          max={10000000}
          step={100000}
          className="w-full"
        />
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {currency} {sliderFormatter.format(priceRange[0])}
            </span>
            <span className="text-muted-foreground">
              {currency} {sliderFormatter.format(priceRange[1])}
            </span>
        </div>
      </div>
      </div>

      {/* Property Type */}
      <div>
        <Label className="text-sm font-medium">Property Type</Label>
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div>
        <Label className="text-sm font-medium">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listingStatuses.map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption}>
                {statusOption === "All Statuses"
                  ? statusOption
                  : statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bedrooms */}
      <div>
        <Label className="text-sm font-medium">Bedrooms</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Studio", "1", "2", "3", "4", "5+"].map(bed => (
            <Button
              key={bed}
              variant={bedrooms.includes(bed) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleBedroom(bed)}
              className={bedrooms.includes(bed) ? "ore-gradient" : ""}
            >
              {bed}
            </Button>
          ))}
        </div>
      </div>

      {/* Dubai Areas */}
      <div>
        <Label className="text-sm font-medium">Dubai Areas</Label>
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {availableAreas.map(area => (
            <div key={area} className="flex items-center space-x-2">
              <Checkbox
                id={area}
                checked={selectedAreas.includes(area)}
                onCheckedChange={() => toggleArea(area)}
              />
              <Label htmlFor={area} className="text-sm font-normal cursor-pointer">
                {area}
              </Label>
            </div>
          ))}
        </div>
        {selectedAreas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedAreas.map(area => (
              <Badge key={area} variant="secondary" className="gap-1">
                {area}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleArea(area)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Developer */}
      <div>
        <Label className="text-sm font-medium">Developer</Label>
        <Select value={developer} onValueChange={setDeveloper}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableDevelopers.map((dev) => (
              <SelectItem key={dev} value={dev}>{dev}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Special Filters */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="freehold"
            checked={freeholdOnly}
            onCheckedChange={(checked) => setFreeholdOnly(checked as boolean)}
          />
          <Label htmlFor="freehold" className="text-sm font-normal cursor-pointer">
            Freehold only
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="goldenvisa"
            checked={goldenVisaEligible}
            onCheckedChange={(checked) => setGoldenVisaEligible(checked as boolean)}
          />
          <Label htmlFor="goldenvisa" className="text-sm font-normal cursor-pointer">
            Golden Visa eligible
          </Label>
        </div>
      </div>

      <Button className="w-full ore-gradient" onClick={applyFilters}>
        Apply Filters
      </Button>
    </div>
  )

  if (collapsible) {
    return (
      <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="group flex flex-1 items-center gap-2 text-left">
              <SlidersHorizontal className="h-4 w-4" />
              <h3 className="font-semibold">Filters</h3>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
        <CollapsibleContent className="pt-6">
          {filtersBody}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear all
        </Button>
      </div>
      {filtersBody}
    </div>
  )
}
