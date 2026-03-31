import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ensureAnalyticsSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_lp_analytics (
      id text PRIMARY KEY,
      landing_slug text,
      project_slug text,
      event_name text,
      event_value text,
      session_id text,
      path text,
      referrer text,
      utm_source text,
      utm_medium text,
      utm_campaign text,
      utm_term text,
      utm_content text,
      utm_id text,
      device jsonb,
      geo_country text,
      geo_region text,
      geo_city text,
      meta jsonb,
      created_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE gc_lp_analytics
      ADD COLUMN IF NOT EXISTS landing_slug text,
      ADD COLUMN IF NOT EXISTS project_slug text,
      ADD COLUMN IF NOT EXISTS event_name text,
      ADD COLUMN IF NOT EXISTS event_value text,
      ADD COLUMN IF NOT EXISTS session_id text,
      ADD COLUMN IF NOT EXISTS path text,
      ADD COLUMN IF NOT EXISTS referrer text,
      ADD COLUMN IF NOT EXISTS utm_source text,
      ADD COLUMN IF NOT EXISTS utm_medium text,
      ADD COLUMN IF NOT EXISTS utm_campaign text,
      ADD COLUMN IF NOT EXISTS utm_term text,
      ADD COLUMN IF NOT EXISTS utm_content text,
      ADD COLUMN IF NOT EXISTS utm_id text,
      ADD COLUMN IF NOT EXISTS device jsonb,
      ADD COLUMN IF NOT EXISTS geo_country text,
      ADD COLUMN IF NOT EXISTS geo_region text,
      ADD COLUMN IF NOT EXISTS geo_city text,
      ADD COLUMN IF NOT EXISTS meta jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()
  `)
}

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const landingSlug = toText(body.landingSlug)
    const eventName = toText(body.eventName)

    if (!landingSlug || !eventName) {
      return NextResponse.json({ error: "landingSlug and eventName are required" }, { status: 400 })
    }

    await ensureAnalyticsSchema()

    const utm = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>
    const device = body.device && typeof body.device === "object" ? body.device : {}

    await query(
      `INSERT INTO gc_lp_analytics (
        id, landing_slug, project_slug, event_name, event_value, session_id, path, referrer,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
        device, geo_country, geo_region, geo_city, meta, created_at
      )
      VALUES (
        $1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''),
        NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''),
        $15::jsonb, NULLIF($16, ''), NULLIF($17, ''), NULLIF($18, ''), $19::jsonb, now()
      )`,
      [
        randomUUID(),
        landingSlug,
        toText(body.projectSlug),
        eventName,
        toText(body.eventValue),
        toText(body.sessionId),
        toText(body.path),
        toText(body.referrer),
        toText(utm.source),
        toText(utm.medium),
        toText(utm.campaign),
        toText(utm.term),
        toText(utm.content),
        toText(utm.id),
        JSON.stringify(device),
        toText(req.headers.get("x-vercel-ip-country")),
        toText(req.headers.get("x-vercel-ip-country-region")),
        toText(req.headers.get("x-vercel-ip-city")),
        JSON.stringify({
          ipHash: toText(req.headers.get("x-forwarded-for")).slice(0, 64),
        }),
      ],
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[lp-analytics] create error", error)
    return NextResponse.json({ error: "Unable to log analytics event" }, { status: 500 })
  }
}
