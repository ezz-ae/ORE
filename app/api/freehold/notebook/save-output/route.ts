import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { title?: string; content?: string; type?: string }
  if (!body.content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })
  return NextResponse.json({
    output: {
      id: `mock_output_${Date.now()}`,
      title: body.title ?? "Untitled output",
      type: body.type ?? "note",
      content: body.content,
      status: "saved",
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
