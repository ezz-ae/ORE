import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Blocks, CircleAlert, MessageSquare, ShieldCheck } from "lucide-react"
import { getServerApp } from "@/src/features/freehold-intelligence/server-session"

export default async function GenericServerAppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getServerApp(appId)
  if (!app) notFound()

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Server app</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{app.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">{app.description}</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <Blocks className="h-5 w-5 text-[#D4AF37]" />
          <div className="mt-4 text-2xl font-semibold text-white">{app.status.replace("_", " ")}</div>
          <div className="mt-1 text-sm text-white/45">Current status</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <CircleAlert className="h-5 w-5 text-[#D4AF37]" />
          <div className="mt-4 text-2xl font-semibold text-white">{app.urgentCount}</div>
          <div className="mt-1 text-sm text-white/45">Urgent items</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <MessageSquare className="h-5 w-5 text-[#D4AF37]" />
          <div className="mt-4 text-2xl font-semibold text-white">{app.openComments}</div>
          <div className="mt-1 text-sm text-white/45">Open comments</div>
        </div>
      </section>

      <section className="mt-5 border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
          V1 app operating note
        </div>
        <p className="mt-3 text-sm leading-6 text-white/60">This app is registered in the private server launcher. Its detailed operating surface can be expanded without changing the public platform.</p>
        <div className="mt-5 text-sm text-white/70">Next action: {app.nextAction}</div>
        <Link href="/freehold-intelligence/apps" className="mt-5 inline-flex items-center gap-2 text-sm text-[#D4AF37]">
          Back to apps <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
