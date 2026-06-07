import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState, buttonClass } from '@/components/freehold/ui'

/** Branded 404 for the workspace — keeps users inside the product. */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
      <EmptyState
        Icon={Compass}
        title="Page not found"
        description="This page doesn't exist or may have moved. Head back to your workspace home to keep going."
        action={
          <Link href="/freehold-intelligence" className={buttonClass('primary', 'md')}>
            Back to home
          </Link>
        }
        className="w-full"
      />
    </div>
  )
}
