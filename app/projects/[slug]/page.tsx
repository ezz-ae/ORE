import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { notFound } from "next/navigation"
import { ProjectPdfDownload } from "@/components/project-pdf-download"
import Image from "next/image"
import Link from "next/link"
import { ProjectTimeline } from "@/components/project-timeline"
import { FeatureCard } from "@/components/feature-card"
import {
  MapPin,
  TrendingUp,
  Calendar,
  Clock,
  Building2,
  Check,
  FileText,
  PlayCircle,
  ExternalLink,
  Phone,
  MessageCircle,
  Home,
  Maximize,
  Sun,
  Droplets,
  Car,
  ShieldCheck,
  Dumbbell,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  School,
  Plane,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { getProjectBySlug, getProjectsForGrid, searchProjects, getAdjacentProjectSlugs } from "@/lib/ore"
import { Toaster } from "@/components/ui/toaster"
import type { Project } from "@/lib/types/project"
import { ProjectLeadForm } from "@/components/project-lead-form"
import { ProjectMap } from "@/components/project-map"
import {
  safePercent,
  shouldShow,
  isPositiveNumber,
  nameToColor,
  getAvatarInitial,
  hasValidCoordinates,
} from "@/lib/utils/safeDisplay"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const getProject = async (slug: string) => {
  const normalizedSlug = decodeURIComponent(slug).trim()
  const direct = await getProjectBySlug(normalizedSlug)
  if (direct) return direct
  const fallback = await searchProjects(normalizedSlug, 1)
  return fallback[0] || null
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

const getPriceRange = (project: Project) => {
  const prices = (project.units || [])
    .flatMap((unit) => [unit.priceFrom, unit.priceTo])
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price))
  if (!prices.length) {
    return "Pricing on request"
  }
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`
}

const getUnitPriceRange = (unit: {
  priceFrom?: number | null
  priceTo?: number | null
}) => {
  const from = typeof unit.priceFrom === "number" ? unit.priceFrom : null
  const to = typeof unit.priceTo === "number" ? unit.priceTo : null
  if (from == null && to == null) {
    return "Price on request"
  }
  if (from != null && to != null) {
    return `${formatPrice(from)} - ${formatPrice(to)}`
  }
  const value = from ?? to ?? 0
  return formatPrice(value)
}

const toArray = <T,>(value: T[] | null | undefined) => (Array.isArray(value) ? value : [])
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const getSizeRange = (units: Project["units"]) => {
  const sizes = units
    .flatMap((unit) => [unit.sizeFrom, unit.sizeTo])
    .filter((size): size is number => typeof size === "number" && Number.isFinite(size))
  if (!sizes.length) return ""
  return `${Math.min(...sizes).toLocaleString()} - ${Math.max(...sizes).toLocaleString()} sq ft`
}

const getUnitTypes = (units: Project["units"]) => {
  const types = units.map((unit) => unit.type).filter(Boolean)
  return Array.from(new Set(types))
}

const getAvailabilityCount = (units: Project["units"]) =>
  units.reduce((sum, unit) => sum + (Number.isFinite(unit.available) ? unit.available : 0), 0)

import { LucideIcon } from "lucide-react"

const amenityIconMap: { [key: string]: LucideIcon } = {
  "infinity pool": Sun,
  "swimming pool": Sun,
  "pool": Sun,
  "gymnasium": Dumbbell,
  "gym": Dumbbell,
  "fitness center": Dumbbell,
  "security": ShieldCheck,
  "parking": Car,
  "concierge": ShieldCheck,
  "restaurant": UtensilsCrossed,
  "cafe": UtensilsCrossed,
  "retail": ShoppingBag,
  "school": School,
  "airport": Plane,
  "landmark": Landmark,
  "water feature": Droplets,
  "default": Check,
}

const projectTabTriggerClass =
  "rounded-full border border-[#152E24]/10 bg-white px-4 text-[#152E24]/65 data-[state=active]:border-[#152E24] data-[state=active]:bg-[#152E24] data-[state=active]:text-white"

const brandOutlineButtonClass =
  "border-[#152E24]/10 bg-white text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]"

const getAmenityIcon = (amenity: string): LucideIcon => {
  const lowerAmenity = amenity.toLowerCase()
  for (const key in amenityIconMap) {
    if (lowerAmenity.includes(key)) {
      return amenityIconMap[key]
    }
  }
  return amenityIconMap.default
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await getProject(slug)
  const adjacent = project ? await getAdjacentProjectSlugs(project.slug) : { prev_slug: null, next_slug: null }
  const prevSlug = adjacent.prev_slug
  const nextSlug = adjacent.next_slug
  
  if (!project) {
    return {
      title: "Project Not Found",
    }
  }

  const priceRange = getPriceRange(project)
  const locationArea = project.location?.area || "Dubai"
  const title = project.seoTitle || `${project.name} - ${project.tagline} | ORE Real Estate`
  const description = project.seoDescription ||
      `${project.longDescription} Starting from ${priceRange}. Golden Visa eligible. Contact us today.`
  const image = project.heroImage || "/logo_blsck.png"

  return {
    title,
    description,
    keywords: project.seoKeywords?.length
      ? project.seoKeywords
      : [project.name, locationArea, "Dubai property", "off-plan Dubai", "Golden Visa", "investment"],
    openGraph: {
      title,
      description,
      images: [image],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await getProject(slug)
  let prevSlug: string | null = null
  let nextSlug: string | null = null

  if (!project) {
    const suggestions = await getProjectsForGrid(6)
    return (
      <section className="py-16">
        <div className="container">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-serif text-3xl font-bold">Project Not Found</h1>
            <p className="mt-3 text-muted-foreground">
              This project may have been renamed or removed. Explore our latest projects below.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="text-sm text-muted-foreground">{item.tagline}</p>
                    <Button className="mt-4 w-full" variant="outline" asChild>
                      <Link href={`/projects/${item.slug}`}>View Project</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6">
              <Button className="ore-gradient" asChild>
                <Link href="/projects">Browse All Projects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const adjacent = await getAdjacentProjectSlugs(project.slug)
  prevSlug = adjacent.prev_slug
  nextSlug = adjacent.next_slug

  const location = project.location || {
    area: "Dubai",
    district: "Dubai",
    city: "Dubai",
    coordinates: { lat: 0, lng: 0 },
    freehold: false,
    nearbyLandmarks: [],
  }
  const timeline = project.timeline || {
    launchDate: "",
    constructionStart: "",
    expectedCompletion: "TBD",
    handoverDate: "TBD",
    progressPercentage: 0,
  }
  const paymentPlan = project.paymentPlan || {
    downPayment: 0,
    duringConstruction: 0,
    onHandover: 0,
    postHandover: 0,
  }
  const highlights = toArray(project.highlights)
  const amenities = toArray(project.amenities)
  const units = toArray(project.units)
  const landmarks = toArray(location.nearbyLandmarks)
  const hasMap = location.coordinates && location.coordinates.lat !== 0 && location.coordinates.lng !== 0

  const constructionUpdates = toArray(project.constructionUpdates)
  const testimonials = toArray(project.testimonials)
  const faqs = toArray(project.faqs)
  const developer = project.developer || { name: "ORE", logo: "" }
  const phoneNumber = "+97150000000"
  const heroImage = project.heroImage || "/logo.png"
  const heroImageClass = project.heroImage ? "object-cover" : "object-contain bg-card"

  const priceRange = getPriceRange(project)
  const areaSlug = slugify(location.area || "dubai")
  const unitTypes = getUnitTypes(units)
  const sizeRange = getSizeRange(units)
  const availabilityCount = getAvailabilityCount(units)
  
  const showRoi = shouldShow(project.investmentHighlights?.expectedROI)
  const showYield = shouldShow(project.investmentHighlights?.rentalYield)

  const hasTimeline =
    Boolean(timeline.launchDate || timeline.constructionStart || timeline.expectedCompletion || timeline.handoverDate) ||
    Number.isFinite(timeline.progressPercentage)
  const hasMapCoordinates = hasValidCoordinates(location.coordinates?.lat ?? null, location.coordinates?.lng ?? null)
  const roiLabel = safePercent(project.investmentHighlights?.expectedROI)
  const yieldLabel = safePercent(project.investmentHighlights?.rentalYield)
  const hasRoi = isPositiveNumber(project.investmentHighlights?.expectedROI)
  const hasYield = isPositiveNumber(project.investmentHighlights?.rentalYield)
  const showProgress = shouldShow(timeline.progressPercentage)
  const formatUnitSizeRange = (unit: { sizeFrom?: number; sizeTo?: number }) => {
    const sizes = [unit.sizeFrom, unit.sizeTo].filter(isPositiveNumber)
    if (!sizes.length) return ""
    const min = Math.min(...sizes)
    const max = Math.max(...sizes)
    return min === max
      ? `${min.toLocaleString()} sq ft`
      : `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`
  }
  const formatUnitAvailability = (value?: number) =>
    isPositiveNumber(value) ? `${value} available` : "Sold out"
  const hasSpecifications = Boolean(project.specifications && project.specifications.trim())
  
  // Gallery Deduplication (Fix 2.5)
  const projectGallery = toArray(project.gallery).filter(img => img !== project.heroImage)
  const hasGallery = projectGallery.length > 0

  const hasMedia =
    Boolean(project.heroVideo || project.virtualTour || project.masterplan || project.brochure) ||
    hasGallery
  const factItems = [
    { label: "Status", value: project.status?.replace("-", " ") },
    { label: "Area", value: location.area },
    { label: "District", value: location.district },
    { label: "City", value: location.city },
    { label: "Developer", value: developer.name },
    { label: "Property Types", value: unitTypes.length ? unitTypes.join(", ") : "" },
    { label: "Unit Sizes", value: sizeRange },
    {
      label: "Availability",
      value: availabilityCount ? `${availabilityCount.toLocaleString()} units` : "",
    },
    { label: "Freehold", value: location.freehold ? "Yes" : "No" },
    { label: "Handover", value: timeline.handoverDate || timeline.expectedCompletion || "" },
  ].filter((item) => item.value)

  return (
    <>
        <section className="relative h-[55vh] min-h-[450px]">
          <Image
            src={heroImage}
            alt={project.name}
            fill
            className={heroImageClass}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-black/40 to-black/10" />
        </section>

        {/* Project Header */}
        <section className="relative z-10 -mt-24 bg-[#FAF8F5] pb-8">
          <div className="container">
            <div className="grid w-full items-start gap-8 rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] lg:grid-cols-[1.5fr,1fr] lg:p-10">
                <div className="space-y-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C69B3E]">ORE Signature Development</p>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary" className="border-none bg-[#152E24]/[0.06] text-[#152E24]">
                      {project.status?.replace("-", " ")}
                    </Badge>
                    {project.investmentHighlights?.goldenVisaEligible && (
                      <Badge className="border-none ore-gradient text-[#152E24]">Golden Visa Eligible</Badge>
                    )}
                    {location.freehold && (
                      <Badge variant="outline" className="border-[#152E24]/10 bg-[#FAF8F5] text-[#152E24]">Freehold</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <h1 className="font-serif text-4xl font-bold text-[#152E24] md:text-5xl lg:text-6xl">
                      {project.name}
                    </h1>
                    <p className="max-w-2xl text-lg font-light text-[#152E24]/60">
                      {project.tagline}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-[#152E24] md:text-base">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-[#C69B3E]" />
                      <span>{location.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#C69B3E]" />
                      <span>{developer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-[#C69B3E]" />
                      <span>Handover: {timeline.handoverDate || timeline.expectedCompletion || "TBD"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-4">
                    <ProjectPdfDownload slug={project.slug} />
                    {hasMedia && (
                      <Button
                        size="lg"
                        variant="outline"
                        className={brandOutlineButtonClass}
                        asChild
                      >
                        <Link href="#media">
                          <PlayCircle className="mr-2 h-5 w-5" />
                          View Media
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="lg"
                      variant="outline"
                      className={brandOutlineButtonClass}
                      asChild
                    >
                      <a href={`https://wa.me/${phoneNumber.replace("+", "")}`} target="_blank" rel="noopener noreferrer">
                         <MessageCircle className="mr-2 h-5 w-5" />
                         WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Floating Glass Card for Key Stats */}
                <div className="hidden lg:block">
                  <div className="rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] p-6 shadow-none">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground">Starting Price</div>
                        <div className="mt-1 text-2xl font-bold text-amber-500">{priceRange}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Handover</div>
                        <div className="mt-1 text-lg font-semibold">{timeline.handoverDate || "TBD"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Payment Plan</div>
                        <div className="mt-1 text-lg font-semibold">
                           {paymentPlan.postHandover > 0 ? "Post-Handover" : "Standard"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Unit Types</div>
                        <div className="mt-1 text-sm font-medium line-clamp-1">
                          {unitTypes.slice(0, 2).join(", ")}
                          {unitTypes.length > 2 && "..."}
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border flex gap-3">
                       <Button className="w-full ore-gradient text-[#152E24] font-semibold hover:opacity-90" asChild>
                          <Link href="#contact">Enquire Now</Link>
                       </Button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* Key Stats Bar */}
        <section className="bg-[#FAF8F5] pb-6">
          <div className="container">
            <div className="grid gap-4 rounded-[28px] border border-[#152E24]/10 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
              {hasRoi && (
                <div className="flex items-center gap-4 rounded-2xl border border-[#152E24]/10 bg-[#FAF8F5] p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg ore-gradient flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-[#152E24]" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expected ROI</div>
                    <div className="text-xl font-bold">{roiLabel}</div>
                  </div>
                </div>
              )}
              {hasYield && (
                <div className="flex items-center gap-4 rounded-2xl border border-[#152E24]/10 bg-[#FAF8F5] p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg ore-gradient flex-shrink-0">
                    <Home className="h-6 w-6 text-[#152E24]" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Rental Yield</div>
                    <div className="text-xl font-bold">{yieldLabel}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 rounded-2xl border border-[#152E24]/10 bg-[#FAF8F5] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg ore-gradient flex-shrink-0">
                  <Calendar className="h-6 w-6 text-[#152E24]" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Handover</div>
                  <div className="text-xl font-bold">{timeline.handoverDate || timeline.expectedCompletion || "TBD"}</div>
                </div>
              </div>
              {showProgress && (
                <div className="flex items-center gap-4 rounded-2xl border border-[#152E24]/10 bg-[#FAF8F5] p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg ore-gradient flex-shrink-0">
                    <Maximize className="h-6 w-6 text-[#152E24]" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Progress</div>
                    <div className="text-xl font-bold">{timeline.progressPercentage}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="bg-[#FAF8F5] py-10 md:py-16">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
              <div className="grid gap-12 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[24px] bg-[#FAF8F5] p-2">
                    <TabsTrigger
                      value="overview"
                      className={projectTabTriggerClass}
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="units"
                      className={projectTabTriggerClass}
                    >
                      Units
                    </TabsTrigger>
                    {hasMedia && (
                      <TabsTrigger
                        value="media"
                        className={projectTabTriggerClass}
                      >
                        Media
                      </TabsTrigger>
                    )}
                    {hasMap && (
                      <TabsTrigger
                        value="location"
                        className={projectTabTriggerClass}
                      >
                        Location
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="payment"
                      className={projectTabTriggerClass}
                    >
                      Payment Plan
                    </TabsTrigger>
                    <TabsTrigger
                      value="developer"
                      className={projectTabTriggerClass}
                    >
                      Developer
                    </TabsTrigger>
                    {faqs.length > 0 && (
                      <TabsTrigger
                        value="faq"
                        className={projectTabTriggerClass}
                      >
                        FAQs
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="overview" className="mt-8 space-y-10">
                    <div>
                      <h2 className="font-serif text-2xl font-bold">About {project.name}</h2>
                      <p className="mt-4 text-muted-foreground leading-relaxed">
                        {project.longDescription}
                      </p>
                    </div>

                    {factItems.length > 0 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-4">Project Snapshot</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {factItems.map((item) => (
                            <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                {item.label}
                              </div>
                              <div className="mt-2 text-sm font-semibold">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasSpecifications && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-4">Project Specifications</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{project.specifications}</p>
                      </div>
                    )}

                    {highlights.length > 0 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-4">Investment Highlights</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {highlights.map((highlight: string, index: number) => (
                            <div key={index} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                              <span className="text-sm">{highlight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasTimeline && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-6">Timeline & Progress</h3>
                        <div className="grid gap-10 md:grid-cols-[2fr,1fr]">
                          <div>
                            <ProjectTimeline timeline={timeline} />
                          </div>
                          <div className="flex items-center">
                            <div className="w-full rounded-lg border border-border bg-muted/40 p-4 text-center">
                              <div className="text-sm text-muted-foreground">Construction Progress</div>
                              <div className="text-4xl font-bold ore-text-gradient my-2">
                                {timeline.progressPercentage ?? 0}%
                              </div>
                              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full ore-gradient"
                                  style={{ width: `${Math.min(100, Math.max(0, timeline.progressPercentage ?? 0))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {amenities.length > 0 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-6">Amenities & Lifestyle</h3>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {amenities.map((amenity: string, index: number) => (
                            <FeatureCard 
                              key={index}
                              icon={getAmenityIcon(amenity)}
                              title={amenity}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {constructionUpdates.length > 0 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-4">Construction Updates</h3>
                        <div className="space-y-4">
                          {constructionUpdates.map((update: any, index: number) => (
                            <Card key={`${update.date}-${index}`}>
                              <CardContent className="p-6 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="text-sm font-semibold">
                                    Update {index + 1}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{update.date}</div>
                                </div>
                                <p className="text-sm text-muted-foreground">{update.description}</p>
                                {toArray(update.images).length > 0 && (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {toArray(update.images).map((img: any, imgIndex: number) => (
                                      <div
                                        key={`${img}-${imgIndex}`}
                                        className="relative aspect-video overflow-hidden rounded-lg"
                                      >
                                        <Image
                                          src={img}
                                          alt={`${project.name} update ${index + 1}`}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {testimonials.length > 0 && (
                      <div>
                        <h3 className="font-serif text-xl font-semibold mb-4">Investor Testimonials</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          {testimonials.map((testimonial: any, index: number) => (
                            <Card key={`${testimonial.name}-${index}`}>
                              <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
                                <div className="mt-4 text-sm font-semibold">{testimonial.name}</div>
                                <div className="text-xs text-muted-foreground">{testimonial.country}</div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="units" className="mt-8">
                    <h2 className="font-serif text-2xl font-bold mb-6">Available Units</h2>
                    <div className="space-y-6">
                    {units.map((unit: any, index: number) => {
                      const unitSizeLabel = formatUnitSizeRange(unit)
                      return (
                      <Card key={index}>
                        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr,1fr]">
                          <div>
                            <h3 className="font-semibold text-lg">{unit.type || "Unit"}</h3>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {unitSizeLabel && (
                                  <div className="flex items-center gap-1">
                                    <Maximize className="h-4 w-4" />
                                    {unitSizeLabel}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Home className="h-4 w-4" />
                                  {formatUnitAvailability(unit.available)}
                                </div>
                              </div>
                              <div className="mt-4 font-semibold ore-text-gradient text-lg">
                                {getUnitPriceRange(unit)}
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {unit.floorPlan && (
                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                  <div className="text-xs text-muted-foreground mb-2">Floor Plan</div>
                                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-background">
                                    <Image
                                      src={unit.floorPlan}
                                      alt={`${project.name} floor plan`}
                                      fill
                                      className="object-contain p-2"
                                    />
                                  </div>
                                </div>
                              )}
                              {unit.interiorImage && (
                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                  <div className="text-xs text-muted-foreground mb-2">Interior</div>
                                  <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                                    <Image
                                      src={unit.interiorImage}
                                      alt={`${project.name} interior`}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )})}
                    </div>
                  </TabsContent>

                  {hasMedia && (
                    <TabsContent value="media" className="mt-8 space-y-10">
                      <div id="media">
                        <h2 className="font-serif text-2xl font-bold">Media & Downloads</h2>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Explore project visuals, masterplans, and available media assets.
                        </p>
                      </div>

                      {(project.heroVideo || project.virtualTour) && (
                        <div className="grid gap-6 lg:grid-cols-2">
                          {project.heroVideo && (
                            <div className="rounded-lg border border-border bg-card p-4">
                              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                                <PlayCircle className="h-4 w-4 text-primary" />
                                Project Video
                              </div>
                              <div className="relative aspect-video overflow-hidden rounded-md">
                                <iframe
                                  className="h-full w-full"
                                  src={project.heroVideo}
                                  title={`${project.name} video`}
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          )}
                          {project.virtualTour && (
                            <div className="rounded-lg border border-border bg-card p-4">
                              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Virtual Tour
                              </div>
                              <div className="relative aspect-video overflow-hidden rounded-md">
                                <iframe
                                  className="h-full w-full"
                                  src={project.virtualTour}
                                  title={`${project.name} virtual tour`}
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {project.masterplan && (
                        <div>
                          <h3 className="font-serif text-xl font-semibold mb-4">Masterplan</h3>
                          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border">
                            <Image
                              src={project.masterplan}
                              alt={`${project.name} masterplan`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                      )}

                      {projectGallery.length > 0 && (
                        <div>
                          <h3 className="font-serif text-xl font-semibold mb-4">Gallery</h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {projectGallery.map((img: string, index: number) => (
                              <div key={index} className="relative aspect-video overflow-hidden rounded-lg">
                                <Image
                                  src={img}
                                  alt={`${project.name} ${index + 1}`}
                                  fill
                                  className="object-cover transition-transform hover:scale-105"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {project.brochure && (
                        <div className="rounded-lg border border-border bg-card p-6">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <FileText className="h-4 w-4 text-primary" />
                                Project Brochure
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                Download the official project brochure and factsheet.
                              </p>
                            </div>
                            <Button className="ore-gradient" asChild>
                              <a href={project.brochure} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-2 h-4 w-4" />
                                Download PDF
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )}

                  {hasMap && (
                    <TabsContent value="location" className="mt-8 space-y-8">
                      <div>
                        <h2 className="font-serif text-2xl font-bold">Prime Location</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {location.area}, {location.city}
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Area</div>
                          <div className="mt-2 text-sm font-semibold">{location.area}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">District</div>
                          <div className="mt-2 text-sm font-semibold">{location.district}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Freehold</div>
                          <div className="mt-2 text-sm font-semibold">{location.freehold ? "Yes" : "No"}</div>
                        </div>
                      </div>

                      {landmarks.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="font-serif text-xl font-semibold">Nearby Landmarks</h3>
                          {landmarks.map((landmark: any, index: number) => (
                            <div key={index} className="flex items-center justify-between border-b border-border pb-3">
                              <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-primary" />
                                <span>{landmark.name}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{landmark.distance}</span>
                            </div>
                          ))}
                        </div>
                    )}

                  <ProjectMap
                    projectName={project.name}
                    area={location.area}
                    coordinates={hasMapCoordinates ? location.coordinates : undefined}
                  />
                </TabsContent>
                )}

                  <TabsContent value="payment" className="mt-8 space-y-8">
                    <div>
                      <h2 className="font-serif text-2xl font-bold">Flexible Payment Plan</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Structured installments with clear milestones for investors.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="p-6 text-center">
                          <div className="text-3xl font-bold ore-text-gradient">
                            {paymentPlan.downPayment}%
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">Down Payment</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6 text-center">
                          <div className="text-3xl font-bold ore-text-gradient">
                            {paymentPlan.duringConstruction}%
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">During Construction</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6 text-center">
                          <div className="text-3xl font-bold ore-text-gradient">
                            {paymentPlan.onHandover}%
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">On Handover</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6 text-center">
                          <div className="text-3xl font-bold ore-text-gradient">
                            {paymentPlan.postHandover}%
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">Post Handover</div>
                        </CardContent>
                      </Card>
                    </div>

                    {toArray(paymentPlan.installments).length > 0 && (
                      <div className="rounded-lg border border-border bg-card p-6">
                        <h3 className="font-serif text-xl font-semibold mb-4">Installment Schedule</h3>
                        <div className="space-y-3">
                          {toArray(paymentPlan.installments).map((installment: any, index: number) => (
                            <div key={`${installment.description}-${index}`} className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  {installment.description || `Installment ${index + 1}`}
                                </div>
                                <div className="text-xs text-muted-foreground">{installment.date}</div>
                              </div>
                              <div className="text-sm font-semibold">{installment.percentage}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="developer" className="mt-8 space-y-6">
                    <div>
                      <h2 className="font-serif text-2xl font-bold">About {developer.name}</h2>
                      <p className="mt-3 text-sm text-muted-foreground">{developer.description}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-6">
                      <div className="flex flex-wrap items-start gap-4">
                        {developer.logo ? (
                          <div className="rounded-xl border border-border bg-background p-3">
                            <Image
                              src={developer.logo}
                              alt={developer.name}
                              width={120}
                              height={60}
                              className="h-10 w-auto object-contain"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex h-16 w-16 items-center justify-center rounded-xl border border-border text-xl font-semibold text-white"
                            style={{ backgroundColor: nameToColor(developer.name) }}
                          >
                            {getAvatarInitial(developer.name)}
                          </div>
                        )}
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Track record</div>
                          <div className="mt-2 text-sm font-semibold">{developer.trackRecord}</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {faqs.length > 0 && (
                    <TabsContent value="faq" className="mt-8 space-y-4">
                      <h2 className="font-serif text-2xl font-bold">Frequently Asked Questions</h2>
                      <div className="space-y-4">
                        {faqs.map((faq: any, index: number) => (
                          <Card key={`${faq.question}-${index}`}>
                            <CardContent className="p-6">
                              <div className="text-sm font-semibold">{faq.question}</div>
                              <div className="mt-2 text-sm text-muted-foreground">{faq.answer}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>

              <aside id="contact" className="lg:col-span-1 space-y-8 lg:sticky lg:top-24 self-start scroll-m-20">
                <ProjectLeadForm projectName={project.name} projectSlug={project.slug} />
                
                {/* Market Intelligence Loop */}
                <Card className="border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                  <CardContent className="p-6 space-y-4">
                    <h4 className="font-semibold">Market Intelligence</h4>
                    <p className="text-sm text-[#152E24]/60">
                      Connect this project with area insights, developer track records, and market-wide trends.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className={brandOutlineButtonClass} asChild>
                        <Link href={`/areas/${areaSlug}`}>Explore {location.area} Analysis</Link>
                      </Button>
                      {developer.slug && (
                        <Button variant="outline" className={brandOutlineButtonClass} asChild>
                          <Link href={`/developers/${developer.slug}`}>Developer Profile</Link>
                        </Button>
                      )}
                      <Button variant="outline" className={brandOutlineButtonClass} asChild>
                        <Link href="/market/trends">Market Trends & Reports</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </aside>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-[#FAF8F5] pb-20">
          <div className="container">
            <div className="rounded-[32px] bg-[#152E24] px-6 py-12 text-center text-white shadow-[0_32px_100px_-50px_rgba(21,46,36,0.7)] md:px-10">
              <h2 className="font-serif text-3xl font-bold">Ready to Invest in {project.name}?</h2>
              <p className="mt-4 text-lg text-white/70">
                Schedule a private viewing or consultation with our investment team.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button size="lg" className="ore-gradient text-[#152E24]" asChild>
                  <Link href="#contact">Request Details</Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/chat">Ask AI About This Project</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        <Toaster />
        {prevSlug || nextSlug ? (
          <>
            <div className="sm:hidden pb-24" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-transparent sm:hidden">
              <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#152E24]/10 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur">
                {prevSlug ? (
                  <Link
                    href={`/projects/${prevSlug}`}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#152E24]/60 hover:text-[#152E24]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev listing
                  </Link>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#152E24]/35">
                    Start
                  </span>
                )}
                {nextSlug ? (
                  <Link
                    href={`/projects/${nextSlug}`}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#152E24]/60 hover:text-[#152E24]"
                  >
                    Next listing
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#152E24]/35">
                    Latest
                  </span>
                )}
              </div>
            </div>
          </>
        ) : null}
    </>
  )
}
