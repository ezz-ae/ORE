import Link from 'next/link'
import { BookOpen, Pin, Sparkles, ArrowUpRight, MessageSquare, FileText, Megaphone, GitBranch, Hash } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function outputTypeIcon(type: string) {
  if (type === 'ad_copy' || type === 'script') return <Megaphone className="h-3 w-3" />
  if (type === 'comparison') return <GitBranch className="h-3 w-3" />
  if (type === 'brochure' || type === 'pdf') return <FileText className="h-3 w-3" />
  return <MessageSquare className="h-3 w-3" />
}

function statusTone(status: string) {
  if (status === 'approved') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10'
  if (status === 'sent_for_review') return 'text-[#F8E7AE] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  if (status === 'saved') return 'text-sky-200 border-sky-400/20 bg-sky-400/10'
  return 'text-white/45 border-white/10 bg-white/[0.03]'
}

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const allOutputs = notebookConversations.flatMap(c => c.savedOutputs)
const pinnedOutputs = allOutputs.filter(o => o.pinned)
const totalMessages = notebookConversations.reduce((s, c) => s + c.messages.length, 0)

export default function NotebookPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <BookOpen className="h-3.5 w-3.5" /> Notebook
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          Generate, save,
          <br />
          <span className="text-white/35">send what matters.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Brochures, ad copy, WhatsApp drafts, comparisons, offer letters — all grounded in live project, lead, and campaign context. Everything saved here is ready to use.
        </p>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{notebookConversations.length}</p>
          <p className="text-[10px] text-white/35 mt-1">Conversations</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{allOutputs.length}</p>
          <p className="text-[10px] text-[#D4AF37]/60 mt-1">Saved outputs</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{totalMessages}</p>
          <p className="text-[10px] text-white/35 mt-1">Messages</p>
        </div>
      </section>

      {/* New conversation prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Generate an offer, comparison, WhatsApp message, ad copy…"
          suggestions={[
            'Draft a WhatsApp for the hottest lead.',
            'Comparison: Palm vs Hills for AED 2.5M investor.',
            'Three Meta ad angles for Dubai Hills.',
            'Offer letter for Business Bay entry.',
          ]}
        />
      </section>

      {/* Pinned outputs */}
      {pinnedOutputs.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80 mb-4">
            <Pin className="h-3 w-3" /> Pinned outputs
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinnedOutputs.map(output => (
              <Link
                key={output.id}
                href={`/freehold-intelligence/notebook/${output.conversationId}`}
                className="group rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-5 transition hover:border-[#D4AF37]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#D4AF37]/70">
                    {outputTypeIcon(output.type)}
                    <span className="capitalize">{output.type.replace(/_/g, ' ')}</span>
                  </div>
                  <Pin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                </div>
                <h3 className="mt-2 text-[14px] font-semibold text-white">{output.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.6] text-white/55">{output.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone(output.status)}`}>
                    {output.status.replace(/_/g, ' ')}
                  </span>
                  {output.tags.slice(0, 3).map(t => (
                    <span key={t} className="flex items-center gap-0.5 text-[11px] text-white/30">
                      <Hash className="h-2.5 w-2.5" />{t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All conversations */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Threads</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{notebookConversations.length} conversations</h2>
          </div>
        </div>

        <div className="space-y-3">
          {[...notebookConversations].reverse().map(conv => {
            const lastMsg = conv.messages[conv.messages.length - 1]
            const outputCount = conv.savedOutputs.length
            return (
              <Link
                key={conv.id}
                href={`/freehold-intelligence/notebook/${conv.id}`}
                className="group flex items-start gap-5 rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/20 sm:p-6"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition group-hover:border-[#D4AF37]/20">
                  <Sparkles className="h-4 w-4 text-white/50" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-[14px] font-semibold text-white">{conv.title}</h3>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-white/30">
                      <span>{relativeTime(conv.updatedAt)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:text-[#D4AF37]" />
                    </div>
                  </div>

                  <p className="mt-1 line-clamp-1 text-[12px] text-white/45">
                    {lastMsg.role === 'assistant' ? 'AI: ' : 'You: '}{lastMsg.content.slice(0, 120)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/30">
                    <span>{conv.messages.length} messages</span>
                    {outputCount > 0 && (
                      <span className="text-[#D4AF37]/60">{outputCount} saved output{outputCount !== 1 ? 's' : ''}</span>
                    )}
                    {conv.relatedProjectIds.length > 0 && (
                      <span>{conv.relatedProjectIds.length} project{conv.relatedProjectIds.length !== 1 ? 's' : ''}</span>
                    )}
                    {conv.relatedLeadIds.length > 0 && (
                      <span>{conv.relatedLeadIds.length} lead{conv.relatedLeadIds.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* All saved outputs */}
      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40 mb-4">All saved outputs</div>
        <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <div className="divide-y divide-white/[0.04]">
            {allOutputs.map(output => (
              <Link
                key={output.id}
                href={`/freehold-intelligence/notebook/${output.conversationId}`}
                className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/[0.02]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/40">
                  {outputTypeIcon(output.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-white/85">{output.title}</span>
                    {output.pinned && <Pin className="h-3 w-3 shrink-0 text-[#D4AF37]" />}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-white/40">{output.content.slice(0, 100)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize sm:inline-flex ${statusTone(output.status)}`}>
                    {output.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-white/25">{relativeTime(output.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
