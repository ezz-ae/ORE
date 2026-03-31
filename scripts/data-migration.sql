-- ============================================================
-- Gold Century Real Estate — Data Migration Script
-- Notebook Agent Target: Neon PostgreSQL (NEON_DATABASE_URL)
-- Generated: 2026-03-10
-- Source: data-request.md
-- ============================================================
-- Run order:
--   1. Schema creation (gc_users, gc_leads, gc_brokers, gc_lead_activity)
--   2. Media uniqueness update on gc_projects
--   3. Verification queries
-- ============================================================


-- ============================================================
-- SECTION 1: TABLE SCHEMAS
-- ============================================================

-- 1A) gc_users — role-based CRM access
CREATE TABLE IF NOT EXISTS gc_users (
  id              text PRIMARY KEY,
  name            text,
  email           text UNIQUE,
  role            text,  -- 'admin' | 'broker' | 'sales_manager' | 'ceo'
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE gc_users
  ADD COLUMN IF NOT EXISTS phone                    text,
  ADD COLUMN IF NOT EXISTS org_title               text,
  ADD COLUMN IF NOT EXISTS commission_rate         numeric,
  ADD COLUMN IF NOT EXISTS language                text,
  ADD COLUMN IF NOT EXISTS ai_tone                 text,
  ADD COLUMN IF NOT EXISTS ai_verbosity            text,
  ADD COLUMN IF NOT EXISTS notifications           jsonb,
  ADD COLUMN IF NOT EXISTS password_hash           text,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_expires  timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at           timestamptz,
  ADD COLUMN IF NOT EXISTS ai_access               boolean DEFAULT false;


-- 1B) gc_brokers — broker detail (linked to gc_users)
CREATE TABLE IF NOT EXISTS gc_brokers (
  id           text PRIMARY KEY,
  user_id      text REFERENCES gc_users(id) ON DELETE CASCADE,
  display_name text,
  phone        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gc_brokers_user_id ON gc_brokers(user_id);


-- 1C) gc_leads — lead capture + CRM pipeline
CREATE TABLE IF NOT EXISTS gc_leads (
  id                  text PRIMARY KEY,
  name                text,
  phone               text,
  email               text,
  source              text,
  project_slug        text,
  assigned_broker_id  text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE gc_leads
  ADD COLUMN IF NOT EXISTS assigned_broker_id    text,
  ADD COLUMN IF NOT EXISTS status                text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority              text DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS last_contact_at       timestamptz,
  ADD COLUMN IF NOT EXISTS country               text,
  ADD COLUMN IF NOT EXISTS budget_aed            numeric,
  ADD COLUMN IF NOT EXISTS interest              text,
  ADD COLUMN IF NOT EXISTS message               text,
  ADD COLUMN IF NOT EXISTS landing_slug          text,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ai_ack_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS ai_ack_project_slug   text,
  ADD COLUMN IF NOT EXISTS ai_broker_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gc_leads_assigned_broker ON gc_leads(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_gc_leads_project_slug    ON gc_leads(project_slug);
CREATE INDEX IF NOT EXISTS idx_gc_leads_created_at      ON gc_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gc_leads_status          ON gc_leads(status);


-- 1D) gc_lead_activity — per-lead activity timeline
CREATE TABLE IF NOT EXISTS gc_lead_activity (
  id            text PRIMARY KEY,
  lead_id       text REFERENCES gc_leads(id) ON DELETE CASCADE,
  activity_type text,
  description   text,
  created_by    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gc_lead_activity_lead_id ON gc_lead_activity(lead_id);


-- 1E) gc_user_sessions — auth sessions
CREATE TABLE IF NOT EXISTS gc_user_sessions (
  id         text PRIMARY KEY,
  user_id    text REFERENCES gc_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gc_user_sessions_token    ON gc_user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_gc_user_sessions_user_id  ON gc_user_sessions(user_id);


-- 1F) gc_activity_log — audit trail
CREATE TABLE IF NOT EXISTS gc_activity_log (
  id         text PRIMARY KEY,
  user_id    text,
  action     text,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gc_activity_log_user_id  ON gc_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gc_activity_log_action   ON gc_activity_log(action);


-- ============================================================
-- SECTION 2: MEDIA UNIQUENESS — gc_projects
-- ============================================================
-- Strategy:
--   hero_image / og_image       → https://picsum.photos/seed/{slug}-hero/1600/1000
--   payload.heroImage           → same as hero_image
--   payload.ogImage             → same as hero_image
--   payload.gallery[0..11]      → https://picsum.photos/seed/{slug}-g{0..11}/1600/1000
--   payload.units[].floorPlan   → https://picsum.photos/seed/{slug}-{unitType}-plan/1200/900
--   payload.units[].interiorImage → https://picsum.photos/seed/{slug}-{unitType}-interior/1200/900
--   hero_video / masterplan / brochure / virtualTour → unchanged
-- ============================================================

-- 2A) Update top-level hero_image and og_image columns
UPDATE gc_projects
SET
  hero_image = 'https://picsum.photos/seed/' || slug || '-hero/1600/1000',
  og_image   = 'https://picsum.photos/seed/' || slug || '-hero/1600/1000'
WHERE slug IS NOT NULL AND slug <> '';


-- 2B) Sync payload.heroImage, payload.ogImage, and add 12-image gallery
--     Also sets floorPlan and interiorImage per unit type
UPDATE gc_projects
SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      payload,
      '{heroImage}',
      to_jsonb('https://picsum.photos/seed/' || slug || '-hero/1600/1000')
    ),
    '{ogImage}',
    to_jsonb('https://picsum.photos/seed/' || slug || '-hero/1600/1000')
  ),
  '{gallery}',
  (
    SELECT jsonb_agg(
      to_jsonb('https://picsum.photos/seed/' || slug || '-g' || i::text || '/1600/1000')
    )
    FROM generate_series(0, 11) AS i
  )
)
WHERE slug IS NOT NULL AND slug <> '';


-- 2C) Update floorPlan and interiorImage per unit in payload.units[]
--     Uses the unit type (lowercased, spaces→hyphens) as the seed component
UPDATE gc_projects
SET payload = jsonb_set(
  payload,
  '{units}',
  (
    SELECT jsonb_agg(
      unit ||
      jsonb_build_object(
        'floorPlan',
        'https://picsum.photos/seed/' || slug || '-' ||
          lower(regexp_replace(unit->>'type', '[^a-zA-Z0-9]+', '-', 'g')) ||
          '-plan/1200/900',
        'interiorImage',
        'https://picsum.photos/seed/' || slug || '-' ||
          lower(regexp_replace(unit->>'type', '[^a-zA-Z0-9]+', '-', 'g')) ||
          '-interior/1200/900'
      )
    )
    FROM jsonb_array_elements(payload->'units') AS unit
  )
)
WHERE
  slug IS NOT NULL
  AND slug <> ''
  AND jsonb_typeof(payload->'units') = 'array'
  AND jsonb_array_length(payload->'units') > 0;


-- ============================================================
-- SECTION 3: LEAD ASSIGNMENT RULES (documented as constraints)
-- ============================================================
-- Admin role:   can read/update all gc_leads rows (enforced in app layer)
-- Broker role:  can read/update only WHERE assigned_broker_id = their user id
-- Assignments:  stored in gc_leads.assigned_broker_id (FK advisory, not enforced at DB level
--               to allow flexibility for unassigned leads)
-- No RLS is applied here — enforcement is in lib/entrestate.ts query builders.


-- ============================================================
-- SECTION 4: VERIFICATION QUERIES
-- Run these after the migration to confirm success.
-- ============================================================

-- 4A) Media uniqueness check
SELECT
  COUNT(*)                          AS total_projects,
  COUNT(DISTINCT hero_image)        AS distinct_hero_images,
  COUNT(DISTINCT og_image)          AS distinct_og_images
FROM gc_projects;
-- Expected: total_projects = distinct_hero_images = distinct_og_images

SELECT COUNT(DISTINCT payload->'gallery'->>0) AS distinct_gallery0
FROM gc_projects
WHERE jsonb_typeof(payload->'gallery') = 'array';
-- Expected: equals total projects with gallery

-- 4B) Leads table
SELECT COUNT(*) AS lead_count FROM gc_leads;

-- 4C) Users table
SELECT COUNT(*) AS user_count FROM gc_users;

-- 4D) Brokers table
SELECT COUNT(*) AS broker_count FROM gc_brokers;

-- 4E) Sample hero image format
SELECT slug, hero_image
FROM gc_projects
WHERE slug IS NOT NULL
ORDER BY market_score DESC NULLS LAST
LIMIT 5;

-- 4F) Sample gallery format
SELECT slug, payload->'gallery'->0 AS gallery_0, payload->'gallery'->11 AS gallery_11
FROM gc_projects
WHERE jsonb_typeof(payload->'gallery') = 'array'
LIMIT 3;

-- 4G) Sample unit floor plans
SELECT
  slug,
  unit->>'type'         AS unit_type,
  unit->>'floorPlan'    AS floor_plan,
  unit->>'interiorImage' AS interior_image
FROM gc_projects,
     jsonb_array_elements(payload->'units') AS unit
WHERE jsonb_typeof(payload->'units') = 'array'
LIMIT 10;
