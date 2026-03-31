import { NextResponse } from "next/server"
import { canManageCrmUsers, getSessionUser } from "@/lib/auth"
import { resolveAccessRole, setUserAiAccess } from "@/lib/ore"

const ensureAdmin = (user: Awaited<ReturnType<typeof getSessionUser>>) => {
  if (!user) return false
  return resolveAccessRole(user.role) === "admin" && canManageCrmUsers(user.role, user.org_title)
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!ensureAdmin(user)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    const { id, aiAccess } = await req.json()
    if (!id || typeof aiAccess !== "boolean") {
      return NextResponse.json({ message: "Missing id or access flag" }, { status: 400 })
    }

    const updated = await setUserAiAccess(id, aiAccess)
    if (!updated) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ message: "Unable to update access" }, { status: 500 })
  }
}
