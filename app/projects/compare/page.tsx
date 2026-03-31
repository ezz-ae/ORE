import { ProjectComparatorClient } from "@/components/project-comparator-client"
import { getProjectsForGrid } from "@/lib/entrestate"

export default async function ProjectComparatorPage() {
  const projects = await getProjectsForGrid(1000) // Fetch all projects
  return <ProjectComparatorClient projects={projects} />
}
