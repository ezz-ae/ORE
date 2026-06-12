"use client"

import { usePathname } from "next/navigation"
import { buildWhatsAppUrl } from "@/lib/site"

const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.113.55 4.1 1.513 5.826L0 24l6.335-1.492A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-4.991-1.366l-.358-.212-3.76.885.924-3.661-.233-.376A9.772 9.772 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
  </svg>
)

const HIDDEN_PREFIXES = ["/freehold-intelligence", "/chat"]

export function WhatsAppFloat() {
  const pathname = usePathname() || "/"
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null

  const href = buildWhatsAppUrl(
    "Hello Freehold Property UAE, I'd like to speak with an advisor about Dubai real estate.",
  )

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Freehold on WhatsApp"
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-[#25D366] py-3 pl-3 pr-4 text-white shadow-xl shadow-black/20 transition-all hover:scale-105 hover:bg-[#1FB855] sm:bottom-6 sm:right-6"
    >
      <WhatsAppGlyph className="h-6 w-6" />
      <span className="hidden text-sm font-semibold sm:inline">Chat on WhatsApp</span>
    </a>
  )
}
