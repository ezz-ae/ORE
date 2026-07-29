'use client'

import { useT } from '@/lib/i18n/provider'
import { PageHeader } from '@/components/freehold/ui'
import { Clapperboard } from 'lucide-react'

export function StudioHomeHeader() {
  const t = useT()
  return (
    <PageHeader
      eyebrow={t('cs.home.eyebrow')}
      Icon={Clapperboard}
      title={t('cs.home.title')}
      subtitle={t('cs.home.subtitle')}
      className="mb-6"
    />
  )
}

export function StudioRowText({ kind }: { kind: 'canvas' | 'drive' }) {
  const t = useT()
  return (
    <>
      <span className="block truncate text-sm font-semibold text-white">{t(`cs.home.${kind}.title`)}</span>
      <span className="block truncate text-xs text-slate-500">{t(`cs.home.${kind}.desc`)}</span>
    </>
  )
}
