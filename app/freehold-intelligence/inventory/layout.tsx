'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Plus, ArrowLeft } from 'lucide-react'

export function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // If we're on a detail or generate sub-page, show back link
  const isSubPage = pathname.includes('/inventory/')

  return (
    <>
      <div className="sticky top-[53px] z-30 border-b border-white/[0.06] bg-[#06080A]/80 backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between px-6">
          {/* Left: icon + breadcrumb or back link */}
          <div className="flex items-center gap-2.5">
            <Package className="h-4 w-4 text-sky-400" />
            {isSubPage ? (
              <Link
                href="/freehold-intelligence/inventory"
                className="flex items-center gap-1.5 text-[13px] font-medium text-white/60 transition hover:text-white/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Inventory
              </Link>
            ) : (
              <Link
                href="/freehold-intelligence/inventory"
                className="text-[13px] font-medium text-white/90"
              >
                Inventory
              </Link>
            )}
          </div>

          {/* Right: Add Property button */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Property
          </button>
        </div>
      </div>

      {children}
    </>
  )
}

export default InventoryLayout
