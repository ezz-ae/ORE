/**
 * A titled content section with a consistent uppercase label and optional
 * right-aligned action. Use to group related content on a page.
 */
export function Section({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
