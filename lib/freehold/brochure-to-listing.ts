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

export type CreateResult = { ok: boolean; slug?: string; error?: 'name-required' | 'listing-failed' | 'landing-failed' | string }

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
    return { ok: false, error: (e as { error?: string })?.error || 'listing-failed' }
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
  // Listing was created but the landing page failed — surface it, don't pretend.
  return { ok: false, slug, error: 'landing-failed' }
}
