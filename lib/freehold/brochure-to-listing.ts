// Shared "brochure fields → listing + landing" creation, used by BOTH the
// Landing-pages "Create from brochure" flow and the Drive PDF editor's extract
// panel. One code path keeps the two entry points consistent — same slug rules,
// same endpoints, same best-effort AI enrichment.

export interface BrochureFields {
  name?: string | null
  slug?: string | null
  area?: string | null
  developer?: string | null
  priceFrom?: string | number | null
  priceTo?: string | number | null
  roi?: string | number | null
  paymentPlan?: string | null
  handoverDate?: string | null
  description?: string | null
}

// URL-safe slug, always namespaced `freehold-` so a brochure import can never
// clobber a curated inventory slug.
export function normalizedBrochureSlug(f: BrochureFields): string {
  let s = String(f.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  if (!s) s = String(f.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (s && !s.startsWith('freehold-')) s = `freehold-${s}`
  return s
}

export type CreateResult = {
  ok: boolean
  slug?: string
  error?: 'name-required' | 'listing-failed' | 'landing-failed' | string
  /** The REAL server message for the step that failed — surfaced verbatim so
   *  "couldn't create, try again" can never be the whole story again. */
  detail?: string
  /** True when the project row exists but its landing page did not get made.
   *  The caller must NOT present this as a total failure: retrying the whole
   *  flow would just re-upsert the same project. */
  partial?: boolean
}

/**
 * Upsert the listing, then create its landing page, then best-effort enrich the
 * landing copy with AI (never blocks success). Returns the project slug on success.
 */
export async function createListingAndLanding(f: BrochureFields): Promise<CreateResult> {
  const slug = normalizedBrochureSlug(f)
  const name = String(f.name || '').trim()
  if (!name || !slug) return { ok: false, error: 'name-required' }

  const pRes = await fetch('/api/crm/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug, name, area: f.area ?? '', developer: f.developer ?? '',
      priceFrom: f.priceFrom ?? '', priceTo: f.priceTo ?? '', roi: f.roi ?? '',
      paymentPlan: f.paymentPlan ?? '', handoverDate: f.handoverDate ?? '', description: f.description ?? '',
    }),
  }).catch(() => null)
  if (!pRes || !pRes.ok) {
    const e = pRes ? await pRes.json().catch(() => null) : null
    const detail = (e as { error?: string })?.error
    return {
      ok: false,
      error: 'listing-failed',
      detail: detail || (pRes ? `HTTP ${pRes.status}` : 'network error'),
    }
  }

  const lRes = await fetch('/api/crm/landing-pages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectSlug: slug, template: 'classic' }),
  }).catch(() => null)
  if (lRes && lRes.ok) {
    const lData = (await lRes.json().catch(() => null)) as { slug?: string } | null
    fetch('/api/crm/landing-pages/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug: slug, slug: lData?.slug || slug, audience: 'investor' }),
    }).catch(() => {})
    return { ok: true, slug }
  }
  // The project EXISTS now; only its landing page failed. Report that exactly:
  // partial=true so the UI says "project created, landing page didn't" instead
  // of claiming nothing was created and inviting a pointless retry.
  const le = lRes ? await lRes.json().catch(() => null) : null
  return {
    ok: false,
    slug,
    partial: true,
    error: 'landing-failed',
    detail: (le as { error?: string })?.error || (lRes ? `HTTP ${lRes.status}` : 'network error'),
  }
}
