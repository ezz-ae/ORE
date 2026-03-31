
import Image from "next/image"
import Link from "next/link"

export default function DashboardAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted))_72%,hsl(var(--background)))] text-foreground">
      <div className="container py-10 sm:py-12">
        <div className="mx-auto mb-8 flex max-w-lg items-center justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <Link href="/" className="inline-flex transition-opacity hover:opacity-85">
            <Image
              src="/ore-logo-white.png"
              alt="ORE Real Estate"
              width={150}
              height={60}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AC50]">CRM Portal</div>
            <div className="text-xs text-white/50">Secure broker access</div>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
