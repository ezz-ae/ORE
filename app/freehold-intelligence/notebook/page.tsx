import { BookOpen, Pin } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

export default function NotebookPage() {
  const conversation = notebookConversations[0]

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <BookOpen className="h-3.5 w-3.5" /> Notebook
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Generate, then
          <br />
          <span className="text-white/40">save what's worth saving.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          Brochures, sales offers, WhatsApp drafts, ad copy, landing copy and follow-up scripts — all grounded in real project, lead and campaign context.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Generate an offer, comparison, WhatsApp message, ad copy…"
          suggestions={[
            'Draft a WhatsApp for the hottest lead.',
            'Comparison: Palm vs Hills for investor.',
            'Three ad angles for Dubai Hills.',
            'Offer letter for Business Bay.',
          ]}
        />
      </section>

      {conversation && (
        <>
          <section className="mt-20">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Recent thread</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{conversation.title}</h2>

            <div className="mt-6 grid gap-3">
              {conversation.messages.map((message, i) => (
                <div
                  key={i}
                  className={
                    message.role === 'assistant'
                      ? 'rounded-3xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-5 py-4 text-[15px] leading-relaxed text-white/85'
                      : 'rounded-3xl border border-white/[0.06] bg-white/[0.025] px-5 py-4 text-[15px] leading-relaxed text-white/85'
                  }
                >
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                    {message.role === 'assistant' ? 'Freehold AI' : 'You'}
                  </div>
                  {message.content}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Saved outputs</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">From this conversation</h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {conversation.savedOutputs.map((output) => (
                <article
                  key={output.id}
                  className="rounded-3xl border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
                      {output.type.replace(/_/g, ' ')}
                    </div>
                    {output.pinned && <Pin className="h-3.5 w-3.5 text-[#D4AF37]" />}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{output.title}</h3>
                  <p className="mt-3 line-clamp-4 text-[14px] leading-[1.6] text-white/60">{output.content}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {output.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-0.5 text-[11px] text-white/50">
                        #{t}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
