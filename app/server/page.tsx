import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Server — Freehold",
  robots: { index: false, follow: false },
}

export default function ServerPage() {
  return (
    <div className="min-h-screen bg-[#06080A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          {/* Wordmark */}
          <div className="text-center">
            <p className="text-[24px] font-semibold tracking-[0.15em] text-[#D4AF37]">FREEHOLD</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-1">Private Intelligence Server</p>
          </div>

          {/* Access code input */}
          <input
            type="password"
            placeholder="Access code"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D4AF37]/30 mt-8"
          />

          {/* Enter button */}
          <button
            type="button"
            className="w-full mt-4 rounded-xl bg-[#D4AF37] py-3 text-sm font-semibold text-[#06080A] transition hover:bg-[#D4AF37]/90"
          >
            Enter
          </button>

          {/* Disclaimer */}
          <p className="mt-6 text-center text-[11px] text-white/25">
            This server is for Freehold team members only.
          </p>
        </div>

        {/* Entry link */}
        <div className="mt-10 text-center">
          <Link
            href="/freehold-intelligence"
            className="text-[11px] text-white/15 hover:text-white/40 transition-colors"
          >
            → Enter server
          </Link>
        </div>
      </div>
    </div>
  )
}
