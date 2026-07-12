import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { genImage } from '@/lib/creative-studio/providers'
import { CREATIVE_FORMATS } from '@/lib/creative-studio/constants'
import { getPresenterFace, personaById } from '@/lib/creative-studio/presenters'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Smart-form generation: the one-screen alternative to the node canvas. Pick a
// presenter + property + format, and this composes a grounded prompt and
// generates the creative — reusing the account's saved presenter face as the
// character reference so it's the same person every time.
//
// POST { presenterId?, projectName?, area?, developer?, unitType?, price?,
//        brief?, format } → { url, provider }

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`quick-gen:${auth.user.email}`, { limit: 12, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const b = await req.json().catch(() => ({})) as {
    presenterId?: string; projectName?: string; area?: string; developer?: string
    unitType?: string; price?: string; brief?: string; format?: string
  }

  const fmt = CREATIVE_FORMATS.find((f) => f.value === b.format) ?? CREATIVE_FORMATS.find((f) => f.value === 'insta_ad')!
  if (fmt.kind === 'video') {
    return NextResponse.json({ error: 'Video formats are generated on the canvas — pick an image format here (Story / Insta Ad / Creative).' }, { status: 400 })
  }

  const persona = b.presenterId ? personaById(b.presenterId) : null
  const face = persona ? await getPresenterFace(persona.id) : null

  const project = [
    b.projectName && `${b.projectName}`,
    b.area && `in ${b.area}`,
    b.developer && `by ${b.developer}`,
  ].filter(Boolean).join(' ')
  const details = [
    b.unitType && b.unitType,
    b.price && `starting from AED ${b.price}`,
  ].filter(Boolean).join(', ')

  const layout = fmt.value === 'story'
    ? 'Vertical full-screen composition with clear empty space at the top and bottom for a headline and a price callout.'
    : fmt.value === 'insta_ad'
    ? 'Square feed composition, subject slightly off-centre, clean negative space for a short headline.'
    : 'Versatile landscape-leaning composition with room for a headline.'

  const prompt = [
    'Professional, photorealistic real-estate marketing creative for a premium Dubai off-plan property.',
    project ? `Property: ${project}.` : '',
    details ? `${details}.` : '',
    persona ? `Feature a presenter on camera: ${persona.description} Keep the SAME face as the reference image — natural, confident, looking at the viewer.` : 'Show an elegant architectural / lifestyle scene (no people unless implied).',
    b.brief ? `Art direction: ${String(b.brief).slice(0, 400)}.` : '',
    layout,
    'Warm Dubai golden-hour light, cinematic, high-end, sharp focus, magazine quality. Do NOT bake in any text, price numbers, logos, or watermark — leave clean space for those to be added later.',
  ].filter(Boolean).join(' ')

  try {
    const { url, provider } = await genImage(prompt, { aspectRatio: fmt.aspect, imageUrl: face || undefined })
    return NextResponse.json({ url, provider, usedPresenter: !!face })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image generation failed' }, { status: 502 })
  }
}
