'use client'

/**
 * EDIT THE PUBLIC SITE'S OWN WORDS.
 *
 * Home, About, Services and Contact were hardcoded JSX — changing the hero
 * line or the office hours meant a code deploy. This screen edits the words
 * the public pages now read from the content store, field by field, with the
 * built-in text shown as the placeholder so the editor always sees what the
 * site says when a field is left empty.
 *
 * Saving an empty field is the "back to built-in" gesture, not a blank page:
 * the reader ignores empty overrides by design.
 */
import { useEffect, useState } from 'react'
import { Loader2, Globe, Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface FieldDef { key: string; label: string; kind: 'text' | 'textarea' }
interface PageContent { page: string; fields: FieldDef[]; values: Record<string, string> }

const PAGE_LABEL: Record<string, string> = {
  home: 'Home', about: 'About', services: 'Services', contact: 'Contact',
}

export default function SiteContentPage() {
  const t = useT()
  const [pages, setPages] = useState<PageContent[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [savingPage, setSavingPage] = useState('')
  const [savedPage, setSavedPage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/freehold/site-content', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const list: PageContent[] = Array.isArray(d?.pages) ? d.pages : []
        setPages(list)
        setDrafts(Object.fromEntries(list.map((p) => [p.page, { ...p.values }])))
      })
      .catch(() => setError(t('paim.content.loadFailed')))
      .finally(() => setLoading(false))
  }, [t])

  async function save(page: string) {
    setSavingPage(page); setSavedPage(''); setError('')
    try {
      const res = await fetch('/api/freehold/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, data: drafts[page] ?? {} }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('paim.content.saveFailed')); return }
      // Take back what the server kept — dropped keys and trimmed values.
      setPages((prev) => prev.map((p) => (p.page === page ? { ...p, values: d.values ?? {} } : p)))
      setDrafts((prev) => ({ ...prev, [page]: { ...(d.values ?? {}) } }))
      setSavedPage(page)
      setTimeout(() => setSavedPage(''), 2500)
    } catch {
      setError(t('paim.content.saveFailed'))
    } finally { setSavingPage('') }
  }

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-white"><Globe className="h-5 w-5 text-gold" /> {t('paim.content.title')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t('paim.content.sub')}</p>
      </div>

      {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-2.5 text-[13px] text-rose-200">{error}</p>}

      {pages.map((p) => (
        <div key={p.page} className="rounded-[20px] border border-line bg-surface-2 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-white">{PAGE_LABEL[p.page] ?? p.page}</h2>
              <a href={p.page === 'home' ? '/' : `/${p.page}`} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-gold underline">{t('paim.content.view')}</a>
            </div>
            <button
              type="button"
              onClick={() => void save(p.page)}
              disabled={savingPage === p.page}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
            >
              {savingPage === p.page ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : savedPage === p.page ? <Check className="h-3.5 w-3.5" /> : null}
              {savedPage === p.page ? t('paim.content.saved') : t('paim.content.save')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.fields.map((f) => (
              <div key={f.key} className={f.kind === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{f.label}</label>
                {f.kind === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={drafts[p.page]?.[f.key] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.page]: { ...prev[p.page], [f.key]: e.target.value } }))}
                    placeholder={t('paim.content.builtinPh')}
                    className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-slate-600 focus:border-gold/40"
                  />
                ) : (
                  <input
                    value={drafts[p.page]?.[f.key] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.page]: { ...prev[p.page], [f.key]: e.target.value } }))}
                    placeholder={t('paim.content.builtinPh')}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-white outline-none placeholder:text-slate-600 focus:border-gold/40"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] leading-relaxed text-slate-600">{t('paim.content.emptyHint')}</p>
    </div>
  )
}
