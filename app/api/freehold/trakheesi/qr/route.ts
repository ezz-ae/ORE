import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { normalizePermit, permitVerificationUrl } from '@/lib/freehold/trakheesi'

export const runtime = 'nodejs'

/**
 * Trakheesi permit QR — a real PNG that encodes the official DLD verification
 * URL for the given permit. Public by design: the permit and its QR are printed
 * on every ad and shown on public landing pages, so no auth. Rejects anything
 * that isn't a valid permit rather than encoding junk.
 */
export async function GET(req: NextRequest) {
  const permit = normalizePermit(req.nextUrl.searchParams.get('permit'))
  if (!permit) {
    return NextResponse.json({ error: 'A valid Trakheesi permit is required.' }, { status: 400 })
  }
  const png = await QRCode.toBuffer(permitVerificationUrl(permit), {
    width: 240,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
