/** Standard card/panel surface. */
export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      {children}
    </div>
  )
}

/** Header row for a Panel — title on the left, optional action on the right. */
export function PanelHeader({
  title,
  icon,
  action,
  className = '',
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 ${className}`}>
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-300">
        {icon}
        {title}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
