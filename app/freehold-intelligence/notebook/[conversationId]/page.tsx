import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pin, BookOpen, Sparkles } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

export async function generateStaticParams() {
  return notebookConversations.map((c) => ({ conversationId: c.id }))
}

export default async function NotebookConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params
  const conversation = notebookConversations.find((c) => c.id === conversationId)
  if (!conversation) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/notebook" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Notebook
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <BookOpen className="h-3.5 w-3.5" /> Conversation
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[44px]">
          {conversation.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {conversation.messages.length} messages · {conversation.savedOutputs.length} saved outputs
        </p>
      </section>

      {/* Conversation thread */}
      <section className="mt-10">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversation</div>
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
                  {message.role === 'assistant' ? 'Freehold AI' : 'You'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-[1.7] text-slate-100">{message.content}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Continue the conversation */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Continue this conversation…"
          suggestions={[
            'Expand on the last response.',
            'Create a follow-up WhatsApp for this.',
            'Export this as a client brief.',
          ]}
        />
      </section>

      {/* Saved outputs */}
      {conversation.savedOutputs.length > 0 && (
        <section className="mt-16">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saved outputs</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">From this conversation</h2>

          <div className="mt-6 grid gap-4">
            {conversation.savedOutputs.map((output) => (
              <article
                key={output.id}
                className="rounded-[22px] border border-line bg-surface p-6 transition hover:border-gold/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {output.type.replace(/_/g, ' ')}
                  </span>
                  {output.pinned && (
                    <span className="flex items-center gap-1 text-sm text-gold/70">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-white">{output.title}</h3>
                <p className="mt-3 line-clamp-4 text-sm leading-[1.7] text-slate-300">{output.content}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {output.tags.slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-xs text-slate-400">
                      #{t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
