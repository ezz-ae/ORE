/**
 * CAMPAIGN ASSETS — the kit a campaign accumulates, and keeps.
 *
 * The creative pool as first shipped DERIVED everything, every time: the
 * project's photographs, the account Library, the images already on the ads.
 * Derivation is right for those three, and wrong for the fourth thing an
 * operator actually builds up — the file they uploaded for THIS campaign, the
 * frame they cut for it, the version they kept after three edits. That work
 * vanished the moment the panel closed, and reappeared next week as "where did
 * I put that".
 *
 * So a campaign now has a kit of its own, and the design decision that makes
 * it worth having is this:
 *
 *   A CAMPAIGN ASSET IS A LIBRARY ITEM, NOT A SECOND STORE.
 *
 * The Library already has the editors, the export paths, the folders, the
 * permissions and the team visibility. A parallel table of URLs would have
 * none of that, and every one of them would have to be rebuilt or lived
 * without — which is how a product ends up with media that can be shown and
 * not opened. So this table holds a LINK, and the asset itself lives where
 * every other asset in this product lives.
 *
 * That single choice is what delivers the rest of it for free: a campaign
 * asset is one click from the image or video editor, because the editors open
 * by library id; and an edit exported from there lands back on the shelf, in
 * any folder, because that is what the Library's own save already does.
 *
 * WHAT THE FOLDER IS FOR. Every asset attached to a campaign is filed under
 * that campaign's name. An operator who never opens this panel again still
 * finds the campaign's kit in the Library, grouped, because the grouping is a
 * real folder rather than a join table nothing else reads.
 */
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'

/** Where a campaign's own files are filed on the Library shelf. Prefixed so a
 *  campaign called "2026" cannot collide with a folder someone made by hand. */
export function campaignFolder(campaignName: string): string {
  const name = String(campaignName ?? '').trim().replace(/\s+/g, ' ')
  return `Campaign · ${(name || 'Untitled').slice(0, 60)}`
}

/**
 * What a file IS, from its URL. Deliberately extension-based and deliberately
 * NOT a guess: an unknown extension returns null and the caller refuses,
 * rather than filing a mystery as an image and putting a broken tile in the
 * pool. The pool's own kinds are the vocabulary — see lib/freehold/creative-pool.
 */
export type AssetKind = 'image' | 'video' | 'pdf'

const EXT: Array<[AssetKind, string[]]> = [
  ['image', ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']],
  ['video', ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']],
  ['pdf', ['.pdf']],
]

export function assetKindOf(url: string): AssetKind | null {
  const path = String(url ?? '').split('?')[0].split('#')[0].toLowerCase()
  // A data: URL carries its type in the header rather than in a path.
  const data = /^data:(image|video|application\/pdf)/.exec(path)
  if (data) return data[1] === 'application/pdf' ? 'pdf' : (data[1] as AssetKind)
  for (const [kind, exts] of EXT) if (exts.some((e) => path.endsWith(e))) return kind
  return null
}

export interface CampaignAsset {
  campaignId: string
  /** The Library row this points at. The asset itself lives there. */
  libraryId: string
  addedBy: string
  createdAt: string
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_assets (
      campaign_id text NOT NULL,
      library_id  text NOT NULL,
      added_by    text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (campaign_id, library_id)
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign ON meta_campaign_assets (campaign_id)`)
}
const ensureOnce = () => dbEnsureOnce('meta_campaign_assets', ensure)

/**
 * Attach a Library item to a campaign. Idempotent by (campaign, item): the
 * same file attached twice is one attachment, because two tiles of one file is
 * how an operator launches the same ad twice — the same rule the pool's own
 * dedup enforces, held here at the write instead of only at the read.
 */
export async function attachAsset(campaignId: string, libraryId: string, email: string): Promise<boolean> {
  if (!campaignId || !libraryId) return false
  try {
    await ensureOnce()
    await query(
      `INSERT INTO meta_campaign_assets (campaign_id, library_id, added_by) VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id, library_id) DO NOTHING`,
      [campaignId, libraryId, email],
    )
    return true
  } catch { return false }
}

/**
 * Detach — and ONLY detach. The Library row survives, deliberately: an
 * operator removing a picture from a campaign's kit is saying "not for this
 * campaign", never "destroy the file". Deleting the asset here would make
 * tidying one campaign's shelf silently destroy work another campaign, or a
 * landing page, or a brochure is still using.
 */
export async function detachAsset(campaignId: string, libraryId: string): Promise<boolean> {
  if (!campaignId || !libraryId) return false
  try {
    await ensureOnce()
    await query(
      `DELETE FROM meta_campaign_assets WHERE campaign_id = $1 AND library_id = $2`,
      [campaignId, libraryId],
    )
    return true
  } catch { return false }
}

/** The library ids attached to a campaign, newest first. */
export async function listAssetIds(campaignId: string): Promise<string[]> {
  if (!campaignId) return []
  try {
    await ensureOnce()
    const rows = await query<{ library_id: string }>(
      `SELECT library_id FROM meta_campaign_assets WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [campaignId],
    )
    return rows.map((r) => r.library_id)
  } catch { return [] }
}

/**
 * Take a file that is NOT yet on the shelf — a project photograph, an image
 * already running as an ad, a fresh upload — put it in the Library under the
 * campaign's folder, and attach it.
 *
 * This is the step that makes "Edit" possible at all: the editors open by
 * library id, so a picture with no library row can be shown in the pool and
 * cannot be opened. Saving it to the campaign is what gives it one.
 */
export async function adoptIntoCampaign(params: {
  campaignId: string
  campaignName: string
  email: string
  url: string
  title: string
}): Promise<{ libraryId: string } | null> {
  const kind = assetKindOf(params.url)
  // See assetKindOf: an unknown type is refused rather than filed as a guess.
  if (!kind) return null
  const { saveLibraryItem } = await import('@/lib/freehold/library')
  const item = await saveLibraryItem(params.email, {
    kind,
    title: params.title.slice(0, 200) || 'Untitled',
    url: params.url,
    folder: campaignFolder(params.campaignName),
  })
  if (!item) return null
  const ok = await attachAsset(params.campaignId, item.id, params.email)
  return ok ? { libraryId: item.id } : null
}
