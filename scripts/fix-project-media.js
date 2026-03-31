import fs from "fs"
import { Client } from "pg"

const env = fs.readFileSync(".env.local", "utf8")
const match = env.match(/^DATABASE_URL=(.+)$/m)
if (!match) {
  throw new Error("DATABASE_URL missing in .env.local")
}

const client = new Client({ connectionString: match[1] })

const hero = (slug) => `https://picsum.photos/seed/${slug}-hero/1600/1000`
const galleryItem = (slug, index) => `https://picsum.photos/seed/${slug}-g${index}/1600/1000`
const floorPlan = (slug, unitType) =>
  `https://picsum.photos/seed/${slug}-${unitType}-plan/1200/900`
const interior = (slug, unitType) =>
  `https://picsum.photos/seed/${slug}-${unitType}-interior/1200/900`

const normalizeUnitType = (value) =>
  String(value || "unit")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

async function run() {
  await client.connect()

  const batchSize = 200
  const startOffset = Number(process.env.START_OFFSET || 0)
  const maxBatches = Number(process.env.MAX_BATCHES || 0)

  let offset = startOffset
  let processed = 0
  let batches = 0

  while (true) {
    const { rows } = await client.query(
      `SELECT id, slug, payload FROM gc_projects ORDER BY id LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    )

    if (rows.length === 0) break

    await client.query("BEGIN")

    for (const row of rows) {
      const payload = row.payload || {}
      const slug = row.slug

      const updatedGallery = Array.from({ length: 10 }, (_, i) => galleryItem(slug, i + 1))

      const updatedUnits = (payload.units || []).map((unit) => {
        const unitType = normalizeUnitType(unit.type)
        return {
          ...unit,
          floorPlan: floorPlan(slug, unitType),
          interiorImage: interior(slug, unitType),
        }
      })

      const updatedPayload = {
        ...payload,
        heroImage: hero(slug),
        ogImage: hero(slug),
        gallery: updatedGallery,
        units: updatedUnits,
      }

      await client.query(
        `UPDATE gc_projects
         SET hero_image = $1,
             og_image = $1,
             payload = $2
         WHERE id = $3`,
        [hero(slug), updatedPayload, row.id],
      )
    }

    await client.query("COMMIT")

    processed += rows.length
    offset += rows.length
    batches += 1
    console.log(`Updated ${processed} projects (offset ${offset})...`)

    if (maxBatches > 0 && batches >= maxBatches) break
  }

  await client.end()
  console.log("Done.")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
