import { NextResponse } from "next/server"
import { getReviewItems } from "@/src/features/freehold-intelligence/data-access"

export async function GET() {
  const tasks = await getReviewItems("task")
  return NextResponse.json({ tasks })
}
