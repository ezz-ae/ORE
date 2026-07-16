'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Network, EyeOff, FileCheck2, Loader2 } from 'lucide-react'
import { PageHeader, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

interface DataSecurityConfig {
  networkBenchmarksOptOut: boolean
  maskBenchmarkNumbers: boolean
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-emerald-400' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export default function DataSecurityPage() {
  const t = useT()
  const [config, setConfig] = useState<DataSecurityConfig | null>(null)
  const [saving, setSaving] = useState<keyof DataSecurityConfig | null>(null)

  useEffect(() => {
    fetch('/api/freehold/settings/data-security', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setConfig(d.config) })
      .catch(() => {})
  }, [])

  async function setField(field: keyof DataSecurityConfig, value: boolean) {
    if (!config) return
    const prev = config
    setConfig({ ...config, [field]: value })
    setSaving(field)
    try {
      const res = await fetch('/api/freehold/settings/data-security', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error()
      setConfig(d.config)
      toast.success(t('settings.dataSecurity.saved'))
    } catch {
      setConfig(prev)
      toast.error(t('settings.dataSecurity.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('settings.tab.dataSecurity')}
        Icon={ShieldCheck}
        title={t('settings.dataSecurity.title')}
        subtitle={t('settings.dataSecurity.subtitle')}
      />

      {!config ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : (
        <>
          {/* Network benchmark participation */}
          <Panel className="mt-6">
            <PanelHeader title={t('settings.dataSecurity.network.title')} icon={<Network className="h-4 w-4 text-gold" />} />
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <div className="text-sm font-semibold text-white">{t('settings.dataSecurity.network.optIn')}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('settings.dataSecurity.network.desc')}</p>
              </div>
              <Toggle
                on={!config.networkBenchmarksOptOut}
                disabled={saving === 'networkBenchmarksOptOut'}
                onChange={(v) => setField('networkBenchmarksOptOut', !v)}
              />
            </div>
          </Panel>

          {/* Number masking */}
          <Panel className="mt-6">
            <PanelHeader title={t('settings.dataSecurity.mask.title')} icon={<EyeOff className="h-4 w-4 text-gold" />} />
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <div className="text-sm font-semibold text-white">{t('settings.dataSecurity.mask.toggle')}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('settings.dataSecurity.mask.desc')}</p>
              </div>
              <Toggle
                on={config.maskBenchmarkNumbers}
                disabled={saving === 'maskBenchmarkNumbers'}
                onChange={(v) => setField('maskBenchmarkNumbers', v)}
              />
            </div>
          </Panel>

          {/* Upload security — always on, informational */}
          <Panel className="mt-6">
            <PanelHeader title={t('settings.dataSecurity.upload.title')} icon={<FileCheck2 className="h-4 w-4 text-emerald-400" />} />
            <div className="space-y-2 p-5 text-xs leading-relaxed text-slate-400">
              <p>{t('settings.dataSecurity.upload.scan')}</p>
              <p>{t('settings.dataSecurity.upload.validate')}</p>
            </div>
          </Panel>

          <p className="mt-6 text-xs leading-relaxed text-slate-500">{t('settings.dataSecurity.auditLink')}</p>
        </>
      )}
    </div>
  )
}
