'use client'

import { useState, useEffect } from 'react'
import { BRAND } from '@/lib/freehold/brand'
import { buildWhatsAppUrl } from '@/lib/site'
import { MessageCircle, ChevronRight } from 'lucide-react'
import type { LpPalette } from '@/lib/landing-theme'

interface Props {
  price: string
  ctaText: string
  slug: string
  L: Record<string, string>
  palette: LpPalette
}

export function StickyLpCta({ price, ctaText, slug, L, palette }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const waUrl = buildWhatsAppUrl(`Hi, I'm interested in this property: ${BRAND.domain}/lp/${slug}`)

  return (
    <>
      {/* No floating WhatsApp circle: the fixed topbar already carries a
          WhatsApp action on every scroll position, and stacked floating
          buttons were overlapping. Mobile gets the sticky bar below. */}

      {/* Mobile sticky bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg px-4 py-3 transition-all duration-300 sm:hidden ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{ borderTopColor: palette.surfaceBorder, background: palette.topbarBg }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: palette.textFaint }}>{L['sticky.startingFrom']}</div>
            <div className="text-[16px] font-bold text-gold">{price}</div>
          </div>
          <div className="flex gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2.5 text-[13px] font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> {L['sticky.whatsapp']}
            </a>
            <a
              href="#lead-form"
              className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-[13px] font-bold text-[#06080A]"
            >
              {ctaText} <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
