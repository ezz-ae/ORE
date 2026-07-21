import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState, buttonClass } from '@/components/freehold/ui'
import { getServerT } from '@/lib/i18n/server'

/** Branded 404 for the workspace — keeps users inside the product. */
export default async function NotFound() {
  const { t } = await getServerT()
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
      <EmptyState
        Icon={Compass}
        title={t('nf.title')}
        description={t('nf.desc')}
        action={
          <Link href="/freehold-intelligence" className={buttonClass('primary', 'md')}>
            {t('nf.back')}
          </Link>
        }
        className="w-full"
      />
    </div>
  )
}
