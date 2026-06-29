import Link from "next/link"
import { ArrowRight, BookMarked, Megaphone, PlusCircle } from "lucide-react"
import type { Project } from "@/src/types/project"
import { formatAED } from "@/src/lib/freehold-format"
import { StatusBadge } from "@/src/components/command/StatusBadge"

function readinessTone(value: number) {
  if (value >= 88) return "green" as const
  if (value >= 80) return "gold" as const
  return "blue" as const
}

export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <div className="fh-table-wrap">
      <table className="fh-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Developer</th>
            <th>Area</th>
            <th>Starting price</th>
            <th>Units</th>
            <th>Payment plan</th>
            <th>Handover</th>
            <th>Readiness</th>
            <th>Ad angle</th>
            <th>Confidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <Link className="fh-strong" href={`/freehold-intelligence/inventory/${project.id}`}>
                  {project.projectName}
                </Link>
                <div className="fh-muted">{project.emirate}</div>
              </td>
              <td>{project.developer}</td>
              <td>{project.area}</td>
              <td>{formatAED(project.startingPrice)}</td>
              <td>{project.unitTypes.join(", ")}</td>
              <td>{project.paymentPlan}</td>
              <td>{project.handover}</td>
              <td>
                <StatusBadge tone={readinessTone(project.campaignReadiness)}>{project.campaignReadiness}%</StatusBadge>
              </td>
              <td>{project.adAngle}</td>
              <td>{project.confidence}%</td>
              <td>
                <div className="fh-button-row">
                  <Link className="fh-btn" href={`/freehold-intelligence/inventory/${project.id}`}>
                    <ArrowRight size={14} aria-hidden="true" />
                    View
                  </Link>
                  <Link className="fh-btn primary" href={`/ads-studio?projectId=${project.id}`}>
                    <Megaphone size={14} aria-hidden="true" />
                    Send
                  </Link>
                  <Link className="fh-btn" href={`/crm?projectId=${project.id}`}>
                    <PlusCircle size={14} aria-hidden="true" />
                    CRM
                  </Link>
                  <Link className="fh-btn" href={`/notebook?projectId=${project.id}`}>
                    <BookMarked size={14} aria-hidden="true" />
                    Note
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
