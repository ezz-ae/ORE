'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, ChevronRight } from 'lucide-react'

interface Props {
  price: string
  ctaText: string
  slug: string
}

export function StickyLpCta({ price, ctaText, slug }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const waUrl = `https://wa.me/971504173622?text=${encodeURIComponent(`Hi, I'm interested in this property: freeholdproperty.ae/lp/${slug}`)}`

  return (
    <>
      {/* Floating WhatsApp */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/30 transition-all hover:scale-110 hover:shadow-[#25D366]/50"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="h-7 w-7 fill-white text-white" />
      </a>

      {/* Mobile sticky bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#07080D]/95 backdrop-blur-lg px-4 py-3 transition-all duration-300 sm:hidden ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Starting from</div>
            <div className="text-[16px] font-bold text-[#D4AF37]">{price}</div>
          </div>
          <div className="flex gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2.5 text-[13px] font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href="#lead-form"
              className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2.5 text-[13px] font-bold text-[#06080A]"
            >
              {ctaText} <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
