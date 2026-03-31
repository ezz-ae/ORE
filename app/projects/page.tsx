import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getProjectsForGrid } from "@/lib/ore"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "New Projects & Master Communities in Dubai | ORE",
  description: "Explore the latest off-plan projects and master-planned communities in Dubai. Detailed insights into ROI, completion dates, and amenities.",
  openGraph: {
    title: "New Projects & Master Communities in Dubai | ORE",
    description: "Explore the latest off-plan projects and master-planned communities in Dubai.",
    images: ["/logo_blsck.png"],
  },
}

export default async function ProjectsPage() {
  const projects = await getProjectsForGrid(24)

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/10 bg-[#0a0a0a] py-16 md:py-24">
        <div className="absolute inset-0 z-0 opacity-50">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.05)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen" />
          <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.2)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen animate-pulse" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur-sm mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#AA8122] mr-2"></span>
              Curated Selection
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-white leading-tight">
              Dubai Projects <br/>
              <span className="italic text-[#D4AF37]">& Communities</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 font-light max-w-2xl mx-auto">
              Explore master communities and off-plan developments built for exceptional investment performance and lifestyle.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button className="ore-gradient text-black font-semibold" asChild>
                <Link href="/contact">Schedule Consultation</Link>
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/chat">Ask AI About Projects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0E241C] py-16 md:py-20">
        <div className="container">
          <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8 lg:p-10">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="secondary" className="mb-4 rounded-full border-none bg-[#C69B3E]/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                  Launch Inventory
                </Badge>
                <h2 className="font-serif text-2xl font-bold text-white md:text-3xl">Featured Developments</h2>
                <p className="mt-2 text-sm text-white/60">
                  {projects.length} curated projects across Dubai with a cleaner, brand-aligned browse experience.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.05] text-white/75 hover:border-[#C69B3E]/25 hover:bg-white/[0.08] hover:text-white"
                asChild
              >
                <Link href="/properties">Browse Properties</Link>
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
