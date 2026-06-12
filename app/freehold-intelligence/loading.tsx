/** Branded loading state shown during workspace route transitions. */
export default function Loading() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-gold" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    </div>
  )
}
