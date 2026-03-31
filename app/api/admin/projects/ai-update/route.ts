import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { logAiProjectUpdate, ProjectUpdateType, updateProjectStatus } from "@/lib/ai-project-updates"
import { resolveAccessRole } from "@/lib/entrestate"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || resolveAccessRole(user.role) !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    const { projectSlug, projectName, updateType, targetStatus, notes } = await req.json()
    if (!projectSlug || !updateType) {
      return NextResponse.json({ message: "Missing project slug or update type" }, { status: 400 })
    }

    const parsedType = String(updateType) as ProjectUpdateType
    const entry = await logAiProjectUpdate({
      projectSlug,
      projectName,
      updateType: parsedType,
      targetStatus: targetStatus || null,
      notes: notes || null,
      createdBy: user.id,
    })

    if (parsedType === "expired" || parsedType === "status") {
      const statusToApply = targetStatus || "expired"
      await updateProjectStatus(projectSlug, statusToApply)
    }

    return NextResponse.json(entry)
  } catch (error) {
    return NextResponse.json({ message: "Unable to log project update" }, { status: 500 })
  }
}
