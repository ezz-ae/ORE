import { Copy, FileText, FolderClock, MessageSquarePlus, Pin, Save, Search, Send, Sparkles } from "lucide-react"
import { notebookConversations } from "@/src/features/freehold-intelligence/server-session"

const outputActions = ["Save output", "Copy output", "Convert to task", "Send for review", "Create PDF", "Create brochure", "Create offer", "Create ad request", "Attach to project", "Add to memory"]
const outputTypes = ["brochure", "PDF", "sales offer", "WhatsApp message", "email", "ad copy", "caption", "landing copy", "image prompt", "video prompt", "comparison", "follow-up script"]

export default function NotebookPage() {
  const conversation = notebookConversations[0]

  return (
    <div className="grid min-h-full lg:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="border-r border-white/10 bg-[#07110D]/85 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FolderClock className="h-4 w-4 text-[#D4AF37]" />
          Notebook memory
        </div>
        <div className="mt-4 flex gap-2 border border-white/10 bg-black/20 p-2">
          <Search className="h-4 w-4 text-white/35" />
          <input className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30" placeholder="Search project, lead, tag..." />
        </div>
        <div className="mt-4 grid gap-2">
          {notebookConversations.map((item) => (
            <button key={item.id} className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-3 text-left">
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-1 text-xs text-white/45">{item.savedOutputs.length} saved outputs</div>
            </button>
          ))}
        </div>
        <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Output filters</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {outputTypes.slice(0, 8).map((type) => (
            <span key={type} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/50">{type}</span>
          ))}
        </div>
      </aside>

      <section className="min-w-0 px-4 py-5 sm:px-6">
        <div className="border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Generative workspace</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Notebook</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Create sales and marketing assets with project, area, developer, campaign and CRM context according to permission level.</p>
        </div>

        <div className="mt-5 grid gap-4">
          {conversation.messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`max-w-3xl border p-4 ${message.role === "assistant" ? "border-[#D4AF37]/25 bg-[#D4AF37]/10" : "ml-auto border-white/10 bg-white/[0.04]"}`}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                {message.role === "assistant" ? <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" /> : <MessageSquarePlus className="h-3.5 w-3.5 text-white/45" />}
                {message.role}
              </div>
              <p className="text-sm leading-6 text-white/70">{message.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 border border-white/10 bg-black/20 p-3">
          <textarea className="min-h-28 w-full resize-none bg-transparent p-2 text-sm text-white outline-none placeholder:text-white/30" placeholder="Generate an offer, comparison, WhatsApp message, ad copy, brochure, PDF outline, prompt or follow-up script..." />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {["Project context", "Lead context", "Campaign context"].map((item) => (
                <button key={item} className="border border-white/10 px-3 py-1.5 text-xs text-white/50">{item}</button>
              ))}
            </div>
            <button className="flex items-center gap-2 bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#07110D]">
              <Send className="h-4 w-4" />
              Generate
            </button>
          </div>
        </div>
      </section>

      <aside className="border-l border-white/10 bg-[#07110D]/85 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4 text-[#D4AF37]" />
          Saved outputs
        </div>
        <div className="mt-4 grid gap-3">
          {conversation.savedOutputs.map((output) => (
            <article key={output.id} className="border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#D4AF37]">{output.type}</div>
                  <h2 className="mt-1 text-sm font-semibold text-white">{output.title}</h2>
                </div>
                {output.pinned ? <Pin className="h-3.5 w-3.5 text-[#D4AF37]" /> : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-white/55">{output.content}</p>
              <div className="mt-3 flex gap-2">
                <button className="grid h-8 w-8 place-items-center border border-white/10 text-white/50"><Copy className="h-3.5 w-3.5" /></button>
                <button className="grid h-8 w-8 place-items-center border border-white/10 text-white/50"><Save className="h-3.5 w-3.5" /></button>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-2">
          {outputActions.slice(0, 7).map((action) => (
            <button key={action} className="border border-white/10 bg-black/15 px-3 py-2 text-left text-xs text-white/55 hover:border-[#D4AF37]/35 hover:text-white">{action}</button>
          ))}
        </div>
      </aside>
    </div>
  )
}
