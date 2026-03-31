import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface SectionShellProps {
  id?: string
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export function SectionShell({ id, title, subtitle, children, className }: SectionShellProps) {
  return (
    <section id={id} className={cn("py-14 md:py-20", className)}>
      <div className="container">
        {(title || subtitle) && (
          <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
            {title && <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>}
            {subtitle && <p className="mt-3 text-base text-muted-foreground md:text-lg">{subtitle}</p>}
            <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
