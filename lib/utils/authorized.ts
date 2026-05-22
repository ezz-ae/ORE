import type { AreaProfile, DeveloperProfile } from "@/lib/types/project"
import { normalizeSlug } from "@/lib/utils/slug"

const AUTHORIZED_DEVELOPER_NAMES = [
  "Emaar Properties",
  "Meraas",
  "Sobha Realty",
  "Nakheel",
  "DAMAC Properties",
  "Imtiaz Developments",
  "Octa Properties",
  "Select Group",
  "Binghatti",
  "Azizi Developments",
  "Aldar Properties Pjsc",
  "Binghatti Developers",
  "Ellington",
  "Meraas Holding",
  "Samana Developers",
  "Arada Sale",
  "Reportage Properties",
  "Tiger Group",
  "Object 1",
  "Tarrad Properties",
  "HRE Developments",
  "One Development",
]

const AUTHORIZED_AREA_NAMES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Jumeirah Village Circle",
  "Dubai South",
  "Business Bay",
  "Dubai Marina",
  "MBR City",
  "Palm Jumeirah",
  "Dubai Hills Estate",
  "Downtown Dubai",
  "JBR (JBR Beach)",
  "JBR",
  "JBR Beach",
  "Emaar South",
  "Dubai Creek Harbour",
  "Al Furjan",
  "Dubailand",
  "Al Jaddaf",
  "Al Safa",
  "Yas Island",
  "Masdar City",
  "Jumeirah Village Triangle",
  "Dubai Silicon Oasis",
  "Al Reem Island",
  "Abu Dhabi Marina",
]

const developerSlugs = new Set(AUTHORIZED_DEVELOPER_NAMES.map((name) => normalizeSlug(name)))
const areaSlugs = new Set(AUTHORIZED_AREA_NAMES.map((name) => normalizeSlug(name)))

export function isAuthorizedDeveloper(developer?: Partial<DeveloperProfile>) {
  if (!developer) return false
  return Number(developer.projectCount ?? developer.activeProjects ?? 0) > 0 || Boolean(developer.name)
}

export function filterAuthorizedDevelopers(developers: DeveloperProfile[]) {
  return developers.filter((developer) => isAuthorizedDeveloper(developer))
}

export function isAuthorizedArea(area?: Partial<AreaProfile>) {
  if (!area) return false
  const hasPropertyCount = Number(area.propertyCount ?? 0) > 0
  return hasPropertyCount && Boolean(area.name || area.slug)
}

export function filterAuthorizedAreas(areas: AreaProfile[]) {
  return areas.filter((area) => isAuthorizedArea(area))
}

export function isAuthorizedAreaSlug(slug?: string) {
  const normalized = normalizeSlug(slug)
  return Boolean(normalized)
}

export function isAuthorizedDeveloperSlug(slug?: string) {
  const normalized = normalizeSlug(slug)
  return Boolean(normalized)
}
