import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "group h-full border-border/60 bg-card hover:-translate-y-1 hover:border-[#C69B3E]/25 hover:shadow-[0_20px_40px_-24px_rgba(21,46,36,0.2)]",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#C69B3E]/15 bg-[#C69B3E]/[0.06] text-[#C69B3E] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="font-semibold text-foreground">{title}</h4>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Premium lifestyle amenity
            </p>
          )}
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C69B3E]/75">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C69B3E]" />
            Curated for livability
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
