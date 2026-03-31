import { LucideIcon } from "lucide-react"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description?: string
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-primary flex-shrink-0">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}
