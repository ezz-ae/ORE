/**
 * THE WORDS ON THE PUBLIC SITE, EDITABLE AT LAST.
 *
 * Every public page — home, about, services, contact — was hardcoded JSX.
 * "Edit any website content" was impossible by construction: the words lived
 * in the build, and changing a phone-answering-hours line meant a deploy. The
 * repo even carried an orphaned content table (freehold_site_web_content,
 * kind 'page' whitelisted since the day it shipped) that no public page ever
 * read — machinery built and never connected, again.
 *
 * This module is the connection, built the way the developers-profile fix was
 * built: a narrow table the public pages actually read, and a writer the
 * management screen actually calls.
 *
 * THE FALLBACK IS THE CODE. Every field's default stays in the page's JSX,
 * and the override only wins when someone saved one. An empty database, a
 * missing row, a blank field — all render the site exactly as it renders
 * today. The public site must never white-screen because a table is empty.
 *
 * THE FIELD LIST IS A CONTRACT. `PAGE_CONTENT_FIELDS` is the single registry
 * of what is editable: the editor renders from it, the API validates against
 * it, and the guard suite walks it. A key not in the registry does not exist,
 * so a typo'd save cannot plant invisible content nothing displays.
 *
 * One deliberate omission: locales. The public site renders `lang="en"` and
 * carries no locale plumbing — pretending these fields are trilingual would
 * store translations nothing shows. The `locale` column exists so the day the
 * public site learns languages, the content store already speaks them.
 */
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'

export interface ContentField {
  key: string
  /** Editor label — the English name of an English sentence on an English
   *  page; deliberately not an i18n key (the CONTENT is what's edited). */
  label: string
  kind: 'text' | 'textarea'
}

export const PAGE_CONTENT_FIELDS: Record<string, ContentField[]> = {
  home: [
    { key: 'heroTitle', label: 'Hero title', kind: 'text' },
    { key: 'heroSubtitle', label: 'Hero subtitle', kind: 'textarea' },
  ],
  about: [
    { key: 'heroTitle', label: 'Hero title', kind: 'text' },
    { key: 'heroIntro', label: 'Hero intro paragraph', kind: 'textarea' },
  ],
  services: [
    { key: 'heroTitle', label: 'Hero title', kind: 'text' },
    { key: 'heroSubtitle', label: 'Hero subtitle', kind: 'textarea' },
  ],
  contact: [
    { key: 'heroTitle', label: 'Hero title', kind: 'text' },
    { key: 'heroSubtitle', label: 'Hero subtitle', kind: 'textarea' },
    { key: 'address', label: 'Office address', kind: 'textarea' },
    { key: 'hours', label: 'Opening hours', kind: 'textarea' },
    { key: 'rera', label: 'RERA ORN number', kind: 'text' },
  ],
}

export const CONTENT_PAGES = Object.keys(PAGE_CONTENT_FIELDS)

async function ensure() {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_page_content (
      page       text NOT NULL,
      locale     text NOT NULL DEFAULT 'en',
      data       jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (page, locale)
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_page_content', ensure)

/**
 * The overrides for one page. Missing table, missing row, no DB configured —
 * all return {}, and the page renders its built-in words.
 */
export async function getPageContent(page: string): Promise<Record<string, string>> {
  try {
    await ensureOnce()
    const rows = await query<{ data: unknown }>(
      `SELECT data FROM freehold_site_page_content WHERE page = $1 AND locale = 'en'`,
      [page],
    )
    const raw = rows[0]?.data
    if (!raw || typeof raw !== 'object') return {}
    const allowed = new Set((PAGE_CONTENT_FIELDS[page] ?? []).map((f) => f.key))
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      // Only registered keys, only non-empty strings. A stale key from a
      // removed field must not resurface, and an empty save means "use the
      // built-in words", never "render nothing".
      if (allowed.has(k) && typeof v === 'string' && v.trim()) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/** Merge a partial save over what is stored. Unknown keys are dropped, an
 *  empty string DELETES the override (back to the built-in words). */
export async function setPageContent(
  page: string,
  data: Record<string, unknown>,
  updatedBy: string,
): Promise<Record<string, string>> {
  if (!PAGE_CONTENT_FIELDS[page]) throw new Error(`Unknown page: ${page}`)
  await ensureOnce()
  const current = await getPageContent(page)
  const allowed = new Set(PAGE_CONTENT_FIELDS[page].map((f) => f.key))
  const next: Record<string, string> = { ...current }
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.has(k) || typeof v !== 'string') continue
    if (v.trim()) next[k] = v.trim()
    else delete next[k]
  }
  await query(
    `INSERT INTO freehold_site_page_content (page, locale, data, updated_by, updated_at)
     VALUES ($1, 'en', $2::jsonb, $3, now())
     ON CONFLICT (page, locale) DO UPDATE SET data = $2::jsonb, updated_by = $3, updated_at = now()`,
    [page, JSON.stringify(next), updatedBy],
  )
  return next
}
