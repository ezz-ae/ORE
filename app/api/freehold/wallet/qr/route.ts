/**
 * YOUR ADDRESS, AS A CODE SOMEBODY CAN POINT A PHONE AT.
 *
 * A wallet's receive screen is a QR and nothing else. Typing `FH-30-004472-9`
 * off a colleague's screen is where a mistyped digit becomes a payment to the
 * wrong person — the Luhn check digit catches one wrong character, and it
 * cannot catch a valid-looking wrong account.
 *
 * Rendered on the SERVER, from the caller's own wallet, so the code can only
 * ever be for the person who asked. A client-side generator taking an address
 * as a parameter is a phishing surface: a link with somebody else's account in
 * the query string would print their QR under your name.
 */
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { requireSession } from '@/lib/freehold/api-auth'
import { personId, walletFor, ensureBankWallets } from '@/lib/freehold/bank-db'
import { listWallets } from '@/lib/freehold/wallet-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { user } = auth

  try {
    await ensureBankWallets()
    const walletId = await walletFor(personId(user), user.name || user.email)
    const mine = (await listWallets()).find((w) => w.id === walletId)
    if (!mine) return NextResponse.json({ error: 'noSuchWallet' }, { status: 404 })

    const dataUrl = await QRCode.toDataURL(mine.accountNo, {
      margin: 1,
      width: 320,
      // High correction: these get screenshotted, cropped and photographed off
      // other people's monitors, and a code that fails to scan sends somebody
      // back to typing the number by hand.
      errorCorrectionLevel: 'H',
      color: { dark: '#0b1220', light: '#ffffff' },
    })

    return NextResponse.json({ accountNo: mine.accountNo, qr: dataUrl })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
