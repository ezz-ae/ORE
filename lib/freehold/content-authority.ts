/**
 * WHO MAY CHANGE OR REMOVE A LISTING, AND WHAT MAY NEVER BE DESTROYED.
 *
 * Until this module existed the content APIs could create and read, and that
 * was all: no UPDATE and no DELETE anywhere. Removing one project from the
 * public site meant somebody opening the production database and writing the
 * statement by hand — which is not a permission model, it is the absence of
 * one. Whoever holds the database can delete anything; nobody else can delete
 * anything at all; and no record is kept either way.
 *
 * ── THE RULE THAT MATTERS: NOTHING ORPHANS A PERSON ──────────────────────
 *
 * A listing is not only a listing. Leads point at it by slug, deals point at
 * it by slug, and campaigns point at it by slug. Hard-deleting a project that
 * carries any of those does not tidy the site: it strands a real enquiry from
 * a real person and a broker's commission record against a name that no longer
 * resolves. The lead survives in its table and becomes unreadable — attached
 * to a project nobody can look up.
 *
 * So the delete is refused, and ARCHIVE is offered in its place. Archiving is
 * what "remove it from the website" almost always means: the public site stops
 * showing it, and every record that points at it still resolves. Hard delete
 * stays available for exactly the case it is safe for — a listing nobody has
 * ever enquired about, sold through, or advertised.
 *
 * The same logic one level up: a developer with projects is never deleted,
 * because its projects would be left carrying the name of something that no
 * longer exists.
 *
 * ── AND IT IS TWO DIFFERENT POWERS ───────────────────────────────────────
 *
 * Editing and archiving are reversible, so marketing holds them. Hard delete
 * destroys the row and is management-only — not because marketing is not
 * trusted, but because an irreversible act should require the authority that
 * answers for it.
 *
 * Pure — no database, no session, no network. Every caller decides with the
 * same function, and the guard suite asserts it in scripts/content-authority-test.ts.
 */
import type { Role } from './session-types'
import { MANAGEMENT_ROLES } from './session-types'

/** Every content action this product recognises. Walkable — the i18n audit
 *  enumerates it, so an action without words fails the build. */
export const CONTENT_ACTIONS = [
  'project.edit', 'project.archive', 'project.restore', 'project.delete',
  'developer.edit', 'developer.delete',
] as const
export type ContentAction = (typeof CONTENT_ACTIONS)[number]

/** Why a content action was refused. The UI translates these; never shown raw. */
export const CONTENT_REFUSALS = [
  'not_found',          // nothing by that slug
  'insufficient_role',  // this role never holds this power
  'has_leads',          // real people enquired — archive instead
  'has_deals',          // a commission record points here — archive instead
  'has_campaigns',      // live or historical ad spend points here
  'has_projects',       // a developer still owns listings
] as const
export type ContentRefusal = (typeof CONTENT_REFUSALS)[number]

/** Everything that points at a project by slug and would be orphaned by a
 *  hard delete. Landing pages are deliberately NOT here: they belong to the
 *  project, carry no third party's record, and are removed with it. */
export interface ProjectAttachments {
  leads: number
  deals: number
  campaigns: number
  /** Deleted alongside the project rather than blocking it. */
  landingPages: number
}

export interface ContentVerdict {
  allowed: boolean
  refusal?: ContentRefusal
  /**
   * True when the destructive act was refused but the reversible one would be
   * allowed. The screen offers it rather than leaving a dead end — a refusal
   * with no next step is how people end up asking for database access.
   */
  archiveInstead?: boolean
}

const ALLOW: ContentVerdict = { allowed: true }
const deny = (refusal: ContentRefusal, archiveInstead = false): ContentVerdict =>
  ({ allowed: false, refusal, archiveInstead })

/** Hard delete destroys a row and cannot be undone, so it takes management. */
export function mayDestroy(role: Role): boolean {
  return (MANAGEMENT_ROLES as readonly Role[]).includes(role)
}

/** Editing and archiving are reversible, so marketing holds them too. */
export function mayEdit(role: Role): boolean {
  return mayDestroy(role) || role === 'marketing'
}

/**
 * Can this project be destroyed outright?
 *
 * Checked in the order a person would care about: a stranded enquiry is worse
 * than a stranded campaign, so leads are named first when several apply.
 */
export function mayDeleteProject(role: Role, a: ProjectAttachments): ContentVerdict {
  if (!mayDestroy(role)) return deny('insufficient_role', mayEdit(role))
  if (a.leads > 0) return deny('has_leads', true)
  if (a.deals > 0) return deny('has_deals', true)
  if (a.campaigns > 0) return deny('has_campaigns', true)
  return ALLOW
}

/**
 * Can this developer be destroyed?
 *
 * A developer holding projects is never removed — the projects would keep a
 * developer_name that resolves to nothing, which reads on the public site as
 * a listing by a company that does not exist. Delete the projects first, or
 * move them, and the developer becomes deletable on its own.
 */
export function mayDeleteDeveloper(role: Role, projectCount: number): ContentVerdict {
  if (!mayDestroy(role)) return deny('insufficient_role')
  if (projectCount > 0) return deny('has_projects')
  return ALLOW
}

/** Archiving is reversible, so it is refused only for want of the role. */
export function mayArchiveProject(role: Role): ContentVerdict {
  return mayEdit(role) ? ALLOW : deny('insufficient_role')
}

/**
 * The project fields a person is allowed to type over.
 *
 * An allow-list, not a block-list. `payload` holds the scraped source record
 * and `id`/`slug` are what every other table points at — a PATCH that could
 * reach them would let an edit silently orphan the same records a delete is
 * refused for protecting.
 */
export const EDITABLE_PROJECT_FIELDS = [
  'name', 'area', 'developer_name', 'status', 'featured',
  'price_from_aed', 'price_to_aed', 'rental_yield', 'handover_date',
  'hero_image', 'brochure', 'virtual_tour', 'golden_visa_eligible',
] as const
export type EditableProjectField = (typeof EDITABLE_PROJECT_FIELDS)[number]

/** Same principle for a developer: identity is not editable, presentation is. */
export const EDITABLE_DEVELOPER_FIELDS = [
  'name', 'name_ar', 'tier', 'logo', 'banner_image',
] as const
export type EditableDeveloperField = (typeof EDITABLE_DEVELOPER_FIELDS)[number]

/**
 * Statuses that take a project off the public site.
 *
 * `archived` is this product's own; the scraper's `might_be_sold_out` came
 * from Property Finder and means the same thing to a visitor, so both are
 * treated as not-listed rather than only the one we write ourselves.
 */
export const UNLISTED_STATUSES = ['archived', 'might_be_sold_out'] as const

export const isListed = (status: string | null | undefined): boolean =>
  !(UNLISTED_STATUSES as readonly string[]).includes(String(status ?? ''))
