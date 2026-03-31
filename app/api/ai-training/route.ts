import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createAiTrainingRequest, markAiTrainingRequestTrained } from "@/lib/ai-training"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { projectSlug, projectName, notes, tags } = await req.json()
    if (!notes || typeof notes !== "string") {
      return NextResponse.json({ message: "Notes are required" }, { status: 400 })
    }

    const normalizedTags =
      typeof tags === "string"
        ? tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : Array.isArray(tags)
          ? tags.map((tag) => String(tag).trim()).filter(Boolean)
          : []

    const request = await createAiTrainingRequest({
      projectSlug: projectSlug || null,
      projectName: projectName || null,
      notes,
      tags: normalizedTags.length ? normalizedTags : undefined,
      createdBy: user.id,
    })
    return NextResponse.json(request)
  } catch (error) {
    return NextResponse.json({ message: "Unable to submit training request" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 })
    }

    const updated = await markAiTrainingRequestTrained(id, user.id)
    if (!updated) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ message: "Unable to update training status" }, { status: 500 })
  }
}
