'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * Generate/Regenerate button for the Intelligence Profile panel. POSTs to the
 * role-gated project-profile API (management/marketing — the server page only
 * renders this for those roles) and refreshes the server component so the new
 * profile + generated_at come straight from the table. Generation is EXPLICIT
 * only — it costs an AI call, so nothing regenerates on page load.
 */
export function ProfileGenerateButton({ slug, hasProfile }: { slug: string; hasProfile: boolean }) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/freehold/project-profile/${encodeURIComponent(slug)}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error((body && typeof body.error === 'string' && body.error) || `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold/80 transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {busy ? t('inv.profile.generating') : hasProfile ? t('inv.profile.regenerate') : t('inv.profile.generate')}
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </span>
  )
}
