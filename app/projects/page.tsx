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

      <section className="py-16">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold">Featured Developments</h2>
              <p className="text-sm text-muted-foreground">
                {projects.length} curated projects across Dubai
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/properties">Browse Properties</Link>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
