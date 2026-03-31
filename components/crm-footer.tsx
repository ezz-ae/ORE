import Image from "next/image"

export function CrmFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#071811]/75">
      <div className="container flex flex-col gap-3 py-4 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/ore-logo-white.png"
            alt="ORE Real Estate"
            width={108}
            height={44}
            className="h-7 w-auto"
          />
          <p>ORE CRM workspace for listings, leads, AI operations, and campaign management.</p>
        </div>
        <p>Internal use only.</p>
      </div>
    </footer>
  )
}
