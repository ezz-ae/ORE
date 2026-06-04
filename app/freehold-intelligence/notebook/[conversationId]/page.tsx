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
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/notebook" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Notebook
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <BookOpen className="h-3.5 w-3.5" /> Conversation
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[44px]">
          {conversation.title}
        </h1>
        <p className="mt-3 text-[13px] text-white/35">
          {conversation.messages.length} messages · {conversation.savedOutputs.length} saved outputs
        </p>
      </section>

      {/* Conversation thread */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Conversation</div>
        <div className="mt-5 grid gap-3">
          {conversation.messages.map((message, i) => (
            <div
              key={i}
              className={
                message.role === 'assistant'
                  ? 'rounded-[20px] border border-[#D4AF37]/12 bg-[#D4AF37]/[0.04] px-5 py-5'
                  : 'rounded-[20px] border border-white/[0.06] bg-[#0A0D10] px-5 py-5'
              }
            >
              <div className="mb-2.5 flex items-center gap-2">
                {message.role === 'assistant' ? (
                  <Sparkles className="h-3 w-3 text-[#D4AF37]/70" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                )}
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                  {message.role === 'assistant' ? 'Freehold AI' : 'You'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-white/85">{message.content}</p>
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
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Saved outputs</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">From this conversation</h2>

          <div className="mt-6 grid gap-4">
            {conversation.savedOutputs.map((output) => (
              <article
                key={output.id}
                className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
                    {output.type.replace(/_/g, ' ')}
                  </span>
                  {output.pinned && (
                    <span className="flex items-center gap-1 text-[11px] text-[#D4AF37]/70">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-white">{output.title}</h3>
                <p className="mt-3 line-clamp-4 text-[13px] leading-[1.7] text-white/60">{output.content}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {output.tags.slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-0.5 text-[11px] text-white/45">
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
