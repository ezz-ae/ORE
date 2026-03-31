import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import { getProjectsForGrid } from "@/lib/entrestate"
import { AIMarketPanel } from "@/components/ai-market-panel"

export const metadata: Metadata = {
  title: "Project Search | ORE",
  description: "Browse curated Dubai investment projects with detailed specs, ROI insight, and developer intelligence.",
}

export default async function ProjectSearchPage() {
  const projects = await getProjectsForGrid(12)

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Project Explorer
              </p>
              <h1 className="font-serif text-4xl font-bold md:text-5xl mt-4">
                Search Dubai Investments
              </h1>
              <p className="mt-4 text-muted-foreground">
                A live lineup of developer-backed projects handpicked for investors. Filter by area,
                delivery status, and Golden Visa eligibility while you browse the latest launches.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        <AIMarketPanel />
      </main>
    </div>
  )
}
