'use client'

// The Creative Studio manages its own full-height node canvas, so it opts out
// of the default padded/scrolling content wrapper (mirrors the Notebook).
//
// It also ports v0 nodes that read the shadcn design tokens, which default to a
// light theme. We scope the Freehold dark palette here (`cs-dark`) plus `dark` so the
// Studio matches the rest of the product. `display:contents` keeps the wrapper
// invisible to layout while still cascading the CSS variables and enabling the
// `dark:` utility variants used inside the nodes.
//
// Guard: the app registry restricts Creative Studio to STUDIO_ROLES, but the
// parent shell only enforces sign-in — so this layout must gate the same roles
// or a broker/sales_manager could deep-link in. EXCEPTION: the design tools
// that moved here from Drive (ad-designer, reel, image, video) were open to
// every signed-in role there — the move must not tighten access, so those
// routes keep Drive's role set.
import { usePathname } from 'next/navigation'
import { useSessionGuard } from '@/lib/freehold/use-session'

const STUDIO_ROLES = ['admin', 'director', 'ceo', 'marketing'] as const
const MOVED_TOOL_ROLES = ['admin', 'sales_manager', 'director', 'ceo', 'marketing', 'broker'] as const

export default function CreativeStudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMovedTool = /^\/freehold-intelligence\/creative-studio\/(ad-designer|reel|image|video)(\/|$)/.test(pathname)
  const { ready } = useSessionGuard(isMovedTool ? [...MOVED_TOOL_ROLES] : [...STUDIO_ROLES])

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  return (
    <div className="dark cs-dark" style={{ display: "contents" }}>
      {children}
    </div>
  )
}
