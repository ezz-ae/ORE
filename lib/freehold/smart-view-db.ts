/**
 * SAVED SMART VIEWS, AND THE SHEETS THEY WERE BUILT INTO.
 *
 * Two tables and they hold different kinds of thing, which is the whole reason
 * they are two:
 *
 *   · the VIEW is what somebody asked for — a name, a question, a narrowing.
 *     It changes only when a person edits it.
 *   · the SNAPSHOT is what the answer was at a moment. It is replaced whole on
 *     every build and carries the time it was built, so a screen can say how
 *     old the answer is instead of implying it is live.
 *
 * Storing the built rows is the point. A saved view that recomputes on every
 * visit is a loading spinner with a name; this one opens instantly because the
 * work already happened, on a schedule, before anybody asked.
 *
 * Fail-soft on reads: a views page that cannot reach the database shows no
 * views, which is true, rather than an error.
 */
import { ensureOnce, query } from '@/lib/db'
import { randomUUID } from 'node:crypto'
import {
  VIEW_TEMPLATES, VIEW_RANGES, VIEW_ACCESS, VIEW_SCHEDULES,
  type SmartView, type ViewRow, type ViewTemplate, type ViewRange,
  type ViewAccess, type ViewSchedule,
} from '@/lib/freehold/smart-view'

async function ensure(): Promise<void> {
  await ensureOnce('freehold_smart_views', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_smart_views (
        id           text PRIMARY KEY,
        name         text NOT NULL,
        description  text NOT NULL DEFAULT '',
        template     text NOT NULL,
        range_key    text NOT NULL DEFAULT 'last30',
        access       text NOT NULL DEFAULT 'onlyMe',
        schedule     text NOT NULL DEFAULT 'everyMorning',
        project_slug text NOT NULL DEFAULT '',
        channel      text NOT NULL DEFAULT '',
        created_by   text NOT NULL DEFAULT '',
        created_at   timestamptz NOT NULL DEFAULT now(),
        built_at     timestamptz
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_smart_view_sheets (
        view_id   text PRIMARY KEY,
        built_at  timestamptz NOT NULL DEFAULT now(),
        rows      jsonb NOT NULL DEFAULT '[]'::jsonb
      )
    `)
  })
}

/** Anything not in the walkable list falls back to the safe member, so a row
 *  written by an older version can never render a blank control. */
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  (list as readonly string[]).includes(String(v)) ? (v as T) : fallback

type Row = {
  id: string; name: string; description: string; template: string
  range_key: string; access: string; schedule: string
  project_slug: string; channel: string; created_by: string
  created_at: string; built_at: string | null
}

const mapView = (r: Row): SmartView => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  template: oneOf<ViewTemplate>(VIEW_TEMPLATES, r.template, 'moneyToday'),
  range: oneOf<ViewRange>(VIEW_RANGES, r.range_key, 'last30'),
  access: oneOf<ViewAccess>(VIEW_ACCESS, r.access, 'onlyMe'),
  schedule: oneOf<ViewSchedule>(VIEW_SCHEDULES, r.schedule, 'everyMorning'),
  projectSlug: r.project_slug ?? '',
  channel: r.channel === 'meta' || r.channel === 'google' ? r.channel : '',
  createdBy: r.created_by ?? '',
  createdAt: r.created_at,
  builtAt: r.built_at,
})

/**
 * The views this person may open.
 *
 * 'onlyMe' means only its author. There is no team model on a view beyond
 * that: 'myTeam' and 'everyone' both open to everybody signed in, and the
 * difference is recorded because it is what the author chose, not because the
 * two are enforced differently today. Saying so here is better than a comment
 * in the UI implying a boundary that is not there.
 */
export async function listSmartViews(viewerEmail: string): Promise<SmartView[]> {
  try {
    await ensure()
    const rows = await query<Row>(
      `SELECT * FROM freehold_smart_views
        WHERE access <> 'onlyMe' OR created_by = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [viewerEmail],
    )
    return rows.map(mapView)
  } catch {
    return []
  }
}

export async function getSmartView(id: string): Promise<SmartView | null> {
  try {
    await ensure()
    const [r] = await query<Row>(`SELECT * FROM freehold_smart_views WHERE id = $1`, [id])
    return r ? mapView(r) : null
  } catch {
    return null
  }
}

export async function createSmartView(v: {
  name: string; description?: string; template: ViewTemplate; range: ViewRange
  access: ViewAccess; schedule: ViewSchedule; projectSlug?: string
  channel?: '' | 'meta' | 'google'; createdBy: string
}): Promise<SmartView | null> {
  try {
    await ensure()
    const id = randomUUID()
    await query(
      `INSERT INTO freehold_smart_views
         (id, name, description, template, range_key, access, schedule, project_slug, channel, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, v.name.slice(0, 100), (v.description ?? '').slice(0, 350), v.template,
        v.range, v.access, v.schedule, v.projectSlug ?? '', v.channel ?? '', v.createdBy,
      ],
    )
    return await getSmartView(id)
  } catch {
    return null
  }
}

/** Deleting is the author's call alone — the same position the campaign
 *  delete takes. A shared view somebody else built is not yours to remove. */
export async function deleteSmartView(id: string, viewerEmail: string): Promise<boolean> {
  try {
    await ensure()
    const rows = await query<{ id: string }>(
      `DELETE FROM freehold_smart_views WHERE id = $1 AND created_by = $2 RETURNING id`,
      [id, viewerEmail],
    )
    if (rows.length > 0) {
      await query(`DELETE FROM freehold_smart_view_sheets WHERE view_id = $1`, [id]).catch(() => undefined)
      return true
    }
    return false
  } catch {
    return false
  }
}

export interface StoredSheet {
  builtAt: string
  rows: ViewRow[]
}

export async function getSheet(viewId: string): Promise<StoredSheet | null> {
  try {
    await ensure()
    const [r] = await query<{ built_at: string; rows: ViewRow[] }>(
      `SELECT built_at, rows FROM freehold_smart_view_sheets WHERE view_id = $1`, [viewId],
    )
    return r ? { builtAt: r.built_at, rows: Array.isArray(r.rows) ? r.rows : [] } : null
  } catch {
    return null
  }
}

/** Replaced WHOLE on every build. A sheet merged row by row would keep rows
 *  for campaigns that no longer exist, and nothing on screen would say so. */
export async function putSheet(viewId: string, rows: ViewRow[]): Promise<string | null> {
  try {
    await ensure()
    const [r] = await query<{ built_at: string }>(
      `INSERT INTO freehold_smart_view_sheets (view_id, built_at, rows)
       VALUES ($1, now(), $2::jsonb)
       ON CONFLICT (view_id) DO UPDATE SET built_at = now(), rows = $2::jsonb
       RETURNING built_at`,
      [viewId, JSON.stringify(rows)],
    )
    await query(`UPDATE freehold_smart_views SET built_at = now() WHERE id = $1`, [viewId])
      .catch(() => undefined)
    return r?.built_at ?? null
  } catch {
    return null
  }
}
