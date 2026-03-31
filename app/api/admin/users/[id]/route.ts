import { NextRequest, NextResponse } from "next/server"
import { canDeleteCrmUsers, getSessionUser, logActivity, normalizeCrmRole } from "@/lib/auth"
import { deleteUserAccess, getUserProfileById } from "@/lib/ore"

export const runtime = "nodejs"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    if (!canDeleteCrmUsers(sessionUser.role, sessionUser.org_title)) {
      return NextResponse.json({ error: "Only the CEO can delete CRM users." }, { status: 403 })
    }

    const { id } = await params
    const targetUser = await getUserProfileById(id)
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    if (targetUser.id === sessionUser.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 })
    }

    if (normalizeCrmRole(targetUser.org_title || targetUser.role) === "ceo") {
      return NextResponse.json({ error: "CEO accounts cannot be deleted from CRM." }, { status: 403 })
    }

    const deleted = await deleteUserAccess(id)
    if (!deleted) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    await logActivity("crm_user_deleted", sessionUser.id, {
      deletedUserId: deleted.id,
      deletedUserEmail: deleted.email,
      deletedUserRole: deleted.role,
    })

    return NextResponse.json({ deleted })
  } catch (error) {
    console.error("[crm-user-delete] error", error)
    return NextResponse.json({ error: "Failed to delete CRM user." }, { status: 500 })
  }
}
