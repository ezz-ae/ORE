import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const ArrowUpRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M7 17 17 7" /><path d="M7 7h10v10" />
  </svg>
)
const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" />
  </svg>
)
const DollarSignIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)
const Building2Icon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18" /><path d="M4 22h16" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
  </svg>
)
const UsersIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const marketStats = [
  { label: "Average Price Growth", value: "+12.4%", change: "vs last year", icon: TrendingUpIcon, trend: "up" },
  { label: "Transaction Volume", value: "24,500", change: "Q4 2025", icon: DollarSignIcon, trend: "up" },
  { label: "Active Projects", value: "3,500+", change: "across Dubai", icon: Building2Icon, trend: "neutral" },
  { label: "International Buyers", value: "68%", change: "of total sales", icon: UsersIcon, trend: "up" },
]

export function MarketSnapshot() {
  return (
    <section className="py-16">
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-semibold text-[#C69B3E] uppercase tracking-[0.2em] mb-2">Real-Time Data</p>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#152E24] md:text-4xl">
              Dubai Market Snapshot
            </h2>
            <p className="mt-2 text-sm text-[#152E24]/40">
              Live insights from the Dubai real estate market
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 rounded-lg border-[#152E24]/10 text-[#152E24]/60 hover:bg-[#152E24]/[0.03] text-[11px] font-semibold uppercase tracking-[0.1em]" asChild>
            <Link href="/market/trends">
              Full Report
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {marketStats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="border-[#152E24]/[0.06] bg-white/60 rounded-xl shadow-none hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[12px] font-medium text-[#152E24]/40">
                      {stat.label}
                    </CardTitle>
                    <div className={`rounded-lg p-2 ${
                      stat.trend === 'up'
                        ? 'bg-[#C69B3E]/10 text-[#C69B3E]'
                        : 'bg-[#152E24]/[0.04] text-[#152E24]/30'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#152E24]">
                    {stat.value}
                  </div>
                  <p className="mt-1 text-[11px] text-[#152E24]/30 font-medium">
                    {stat.change}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="mt-6 border-[#C69B3E]/15 bg-gradient-to-br from-[#C69B3E]/[0.04] to-[#152E24]/[0.02] rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#152E24]">
                  Why Now is the Perfect Time to Invest in Dubai
                </h3>
                <p className="mt-1 text-sm text-[#152E24]/40">
                  Strong market fundamentals, government support, and high rental yields make Dubai a top investment destination
                </p>
              </div>
              <Button className="ore-gradient shrink-0 rounded-lg" asChild>
                <Link href="/market/why-dubai">Learn More</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
