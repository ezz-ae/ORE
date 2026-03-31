import { getProjectsForGrid } from "@/lib/ore"
import { ProjectComparatorClient } from "@/components/project-comparator-client"

export default async function ComparatorPage() {
  const projects = await getProjectsForGrid(30)

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <ProjectComparatorClient projects={projects} />
      </main>
    </div>
  )
}
