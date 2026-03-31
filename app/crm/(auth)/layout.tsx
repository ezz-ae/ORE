
export default function DashboardAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted))_72%,hsl(var(--background)))] text-foreground">
      <div className="container py-12">{children}</div>
    </div>
  )
}
