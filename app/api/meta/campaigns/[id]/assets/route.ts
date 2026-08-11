/**
 * A CAMPAIGN'S OWN KIT — attach, adopt, detach.
 *
 * POST with a `libraryId` attaches something already on the shelf.
 * POST with a `url` ADOPTS it: the file is filed into the Library under the
 * campaign's folder and then attached — which is what gives it a library id,
 * and a library id is what makes the editors openable. A picture with no
 * library row can be shown in the pool and cannot be edited, so "save it to
 * the campaign" and "make it editable" are the same action.
 *
 * DELETE detaches ONLY. The Library row survives: removing a picture from a
 * campaign's kit says "not for this campaign", never "destroy the file", and
 * that file may be the hero of a landing page or another campaign's best ad.
 *
 * See lib/freehold/campaign-assets.ts for why an asset is a Library item
 * rather than a second store.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { attachAsset, detachAsset, listAssetIds, adoptIntoCampaign } from '@/lib/freehold/campaign-assets'
import { listLibrary } from '@/lib/freehold/library'
import { getCampaign, isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const ids = new Set(await listAssetIds(id))
  if (ids.size === 0) return NextResponse.json({ assets: [] })
  // Resolved through the Library's OWN reader, so a campaign never shows a
  // teammate an asset the Library would not have shown them.
  const shelf = await listLibrary(auth.user.email, auth.user.role).catch(() => [])
  return NextResponse.json({ assets: shelf.filter((i) => ids.has(i.id)) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { libraryId?: string; url?: string; title?: string }

  const libraryId = String(body.libraryId ?? '').trim()
  if (libraryId) {
    const ok = await attachAsset(id, libraryId, auth.user.email)
    return ok
      ? NextResponse.json({ libraryId }, { status: 201 })
      : NextResponse.json({ error: 'Could not attach that item.' }, { status: 500 })
  }

  const url = String(body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'Provide a library item or a file.' }, { status: 400 })

  // The campaign's real name is what the folder is called, so the kit is
  // findable in the Library by someone who never opens this panel again.
  let campaignName = id
  if (await isMetaConfigured()) {
    const c = await getCampaign(id).catch(() => null)
    if (c?.name) campaignName = c.name
  }

  const adopted = await adoptIntoCampaign({
    campaignId: id, campaignName, email: auth.user.email,
    url, title: String(body.title ?? '').trim() || campaignName,
  })
  return adopted
    ? NextResponse.json(adopted, { status: 201 })
    : NextResponse.json({ error: 'That file type cannot be saved to a campaign.' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params
  const libraryId = String(req.nextUrl.searchParams.get('libraryId') ?? '').trim()
  if (!libraryId) return NextResponse.json({ error: 'libraryId required' }, { status: 400 })
  const ok = await detachAsset(id, libraryId)
  // The Library row is untouched — see the header.
  return ok
    ? NextResponse.json({ detached: libraryId, fileKept: true })
    : NextResponse.json({ error: 'Could not detach that item.' }, { status: 500 })
}
