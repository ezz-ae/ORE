'use client'

import { useT } from '@/lib/i18n/provider'
import { PageHeader } from '@/components/freehold/ui'
import { Clapperboard, Users } from 'lucide-react'

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

export function PresentersHeader() {
  const t = useT()
  return (
    <PageHeader
      eyebrow={t('cs.home.eyebrow')}
      Icon={Users}
      title={t('cs.presenters.title')}
      subtitle={t('cs.presenters.subtitle')}
      className="mb-6"
    />
  )
}
