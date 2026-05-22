import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { outputId?: string; exportType?: string }
  return NextResponse.json({
    export: {
      outputId: body.outputId ?? "mock-output",
      exportType: body.exportType ?? "pdf",
      status: "queued_for_future_backend",
      message: "V1 does not perform external export actions without approval.",
    },
  })
}
