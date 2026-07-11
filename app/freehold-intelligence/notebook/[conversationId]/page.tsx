import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react'
import { getConversation } from '@/lib/freehold/notebook-conversations'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getServerT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function NotebookConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params
  const { t } = await getServerT()
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) notFound()
  const conversation = await getConversation(conversationId, user.email, user.role)
  if (!conversation) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/notebook" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('pnbk.notebook')}
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <BookOpen className="h-3.5 w-3.5" /> {t('pnbk.conversation')}
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[44px]">
          {conversation.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {t('pnbk.msgMeta', { messages: conversation.messages.length })}
        </p>
      </section>

      {/* Conversation thread */}
      <section className="mt-10">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pnbk.conversation')}</div>
        <div className="mt-5 grid gap-3">
          {conversation.messages.map((message, i) => (
            <div
              key={i}
              className={
                message.role === 'assistant'
                  ? 'rounded-[20px] border border-gold/12 bg-gold/[0.04] px-5 py-5'
                  : 'rounded-[20px] border border-line bg-surface px-5 py-5'
              }
            >
              <div className="mb-2.5 flex items-center gap-2">
                {message.role === 'assistant' ? (
                  <Sparkles className="h-3 w-3 text-gold/70" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-surface-3" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {message.role === 'assistant' ? t('pnbk.assistant') : t('pnbk.you')}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-[1.7] text-slate-100">{message.content}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
