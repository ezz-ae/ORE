# GOLD CENTURY — FRONTEND CODEX FIX PACKAGE
# Generated: 2026-03-22
# Database: Neon PostgreSQL (gc_projects, gc_developer_profiles, gc_area_profiles, gc_blog_posts, gc_project_landing_pages)

---

## DATABASE STATE (LIVE)

| Table | Rows |
|-------|------|
| gc_projects | 975 |
| gc_developer_profiles | 26 |
| gc_area_profiles | 26 |
| gc_blog_posts | 96 |
| gc_project_landing_pages | 1025 |

---

## SECTION 1: GLOBAL ZERO-PROTECTION RULES

**CRITICAL: The site must NEVER display a zero or null value to the user. Every numeric field must have a guard.**

### Rule 1.1 — Numeric Null/Zero Guard (apply to EVERY numeric render)
```typescript
// Create a utility: lib/utils/safeDisplay.ts
export function safeNum(val: number | null | undefined, fallback = '—'): string {
  if (val === null || val === undefined || val === 0 || isNaN(val)) return fallback;
  return val.toLocaleString();
}

export function safePrice(val: number | null | undefined): string {
  if (!val || val === 0) return 'Price on Request';
  return `AED ${val.toLocaleString()}`;
}

export function safePercent(val: number | null | undefined): string {
  if (!val || val === 0) return '—';
  return `${val.toFixed(1)}%`;
}

export function safeScore(val: number | null | undefined): string {
  if (!val || val === 0) return '—';
  return `${Math.round(val)}/100`;
}
```

### Rule 1.2 — Section Visibility Guard
```typescript
// If the data for a section is null/zero/empty, HIDE the entire section. Don't render an empty card.
// Apply to: ROI card, yield card, score card, amenities list, gallery carousel, map, construction progress, delivery date
function shouldShow(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number' && val === 0) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}
```

---

## SECTION 2: PROJECTS PAGE FIXES

### Fix 2.1 — Price Display
```
IF price_from_aed IS NULL OR price_from_aed = 0:
  → Show "Price on Request" (not "AED 0" or blank)
  → Hide price range entirely
  → Still show the project card (don't filter it out)
```

### Fix 2.2 — ROI Display
```
IF payload.roi IS NULL OR payload.roi = 0:
  → HIDE the ROI card/badge completely
  → Do NOT show "ROI: 0%" or "ROI: 0 years"

IF payload.roi exists and > 0:
  → Display as "~X.X years" (it's years-to-breakeven, not percentage)
```

### Fix 2.3 — Yield Display
```
IF payload.grossYield IS NULL OR = 0:
  → HIDE yield badge
  → Do NOT show "0.0%"

IF payload.grossYield > 0:
  → Show as "X.X% yield"
```

### Fix 2.4 — Investment Score
```
IF payload.investmentScore IS NULL OR = 0:
  → HIDE score badge
  → Do NOT show "0/100"
```

### Fix 2.5 — Gallery
```
IF payload.gallery IS NULL OR empty array:
  → HIDE gallery carousel section entirely
  → Show only hero image if present

IF payload.heroImage is in payload.gallery:
  → DEDUPLICATE: Don't show hero image twice (already fixed in DB, but guard in frontend too)
```

### Fix 2.6 — Map Section
```
IF payload.lat IS NULL OR payload.lng IS NULL:
  → HIDE map section completely
  → Don't render a blank map or map with default 0,0 coordinates
```

### Fix 2.7 — Construction Progress
```
IF payload.constructionPhase IS NULL:
  → HIDE construction progress section

IF payload.constructionPhase exists:
  → Show as text badge: "Under Construction", "Foundation", etc.
```

### Fix 2.8 — Delivery Date
```
IF payload.deliveryDate IS NULL AND handover_date IS NULL:
  → Show "TBA" (not blank, not "null")
```

### Fix 2.9 — Location Fallback
```
IF payload.locationFull IS NULL:
  → Use the `area` column from gc_projects as fallback
```

### Fix 2.10 — Trending/Hotness Badge
```
IF payload.hotness IS NULL OR = 0:
  → HIDE trending badge entirely
  → Don't show "🔥 0" or empty badge
```

### Fix 2.11 — Developer Logo on Project Card
```
IF payload.developerLogo IS NULL:
  → Pull logo from gc_developer_profiles WHERE name = project.developer_name
  → If still null: show first-letter avatar (e.g. "E" for Emaar in a colored circle)
  → NEVER show a broken image icon
```

### Fix 2.12 — Units Section
```
IF payload.units IS NULL OR empty:
  → HIDE units section

IF units exist but sqft = 0 or bedrooms = null:
  → Show unit type only (e.g. "2 BR") without sqft
  → Don't show "0 sqft"
```

---

## SECTION 3: DEVELOPER PROFILE PAGE FIXES

### Fix 3.1 — Delivered Units (CRITICAL — currently shows 0)
```
IF payload.deliveredUnits IS NULL OR = 0:
  → HIDE the "Delivered Units" stat card ENTIRELY
  → Do NOT show "0 units delivered"
  → This is the #1 trust signal issue on the site
```

### Fix 3.2 — Star Rating
```
IF payload.stars IS NULL OR = 0:
  → HIDE star rating section
  → Don't show empty stars or "0.0 ★"
```

### Fix 3.3 — Honesty/Trust Score
```
IF payload.honestyScore IS NULL OR = 0:
  → HIDE honesty score section
  → Don't show "Trust Score: 0"
```

### Fix 3.4 — Awards Section
```
IF payload.awards IS NULL OR empty array:
  → HIDE awards section entirely
  → Don't show an empty awards container
```

### Fix 3.5 — Developer Logo
```
IF logo column IS NULL:
  → Render colored first-letter avatar circle
  → Background color: hash developer name to consistent color
  → NEVER show broken image placeholder

Developers currently WITHOUT logo (16):
  - Sobha Realty
  - Aldar Properties Pjsc
  - Meraas Holding
  - Binghatti Developers
  - Ellington
  - Samana Developers
  - Arada Sale
  - Emaar Properties
  - Damac Properties
  - Azizi Developments
  - Object 1
  - HRE Developments
  - Tarrad Properties
  - Tiger Group
  - Reportage Properties
  - One Development
```

### Fix 3.6 — Developer Banner
```
IF payload.banner IS NULL:
  → Use CSS gradient background (brand color → dark)
  → Don't show empty/broken banner image
```

### Fix 3.7 — Flagship Projects
```
IF payload.flagshipProjects IS NULL OR empty:
  → Query top 3 projects by market_score for that developer
  → Display those as flagship
```

### Fix 3.8 — Developer Description
```
IF payload.description IS NULL:
  → Auto-generate: "{name} is a {tier} UAE developer with {projects} active projects."
```

### Fix 3.9 — Average Price / Average Yield
```
IF payload.avgPrice IS NULL OR = 0: → Show "—"
IF payload.avgYield IS NULL OR = 0: → Show "—"
```

---

## SECTION 4: AREAS PAGE FIXES

### Fix 4.1 — Area Image
```
IF payload.heroImage IS NULL:
  → Use emirate-level placeholder (Dubai skyline, Abu Dhabi skyline, etc.)
  → Or use CSS gradient with area name overlay
```

### Fix 4.2 — Area Description
```
IF payload.description IS NULL:
  → Auto-generate: "{name} — {projects} active projects, avg yield {avgYield}%"
```

### Fix 4.3 — Project Count
```
IF payload.projects IS NULL OR = 0:
  → HIDE that area from the areas listing page
  → Query: SELECT * FROM gc_area_profiles WHERE (payload::json->>'projects')::int > 0
```

---

## SECTION 5: FILTERING — ONLY SHOW DATA-BACKED ENTITIES

### 5.1 — Developers Page: Only show these 26 developers
```sql
-- Use this query for developers listing
SELECT * FROM gc_developer_profiles 
WHERE (payload::json->>'projects')::int > 0 
ORDER BY (payload::json->>'projects')::int DESC;
```

**Authorized developer list:**
  ✅ Emaar Properties (tier=Major, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Meraas (tier=Major, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Sobha Realty (tier=Major, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Nakheel (tier=Major, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ DAMAC Properties (tier=Major, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Imtiaz Developments (tier=Boutique, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Octa Properties (tier=Emerging, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Select Group (tier=Established, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Binghatti (tier=Established, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Azizi Developments (tier=Established, projects=None, delivered=None, stars=None, honesty=None, logo=yes)
  ✅ Emaar Properties (tier=mega, projects=168, delivered=80000, stars=4.8, honesty=92, logo=NO)
  ✅ Azizi Developments (tier=mega, projects=114, delivered=20000, stars=4.3, honesty=78, logo=NO)
  ✅ Aldar Properties Pjsc (tier=mega, projects=96, delivered=35000, stars=4.7, honesty=90, logo=NO)
  ✅ Damac Properties (tier=mega, projects=79, delivered=43000, stars=4.2, honesty=75, logo=NO)
  ✅ Sobha Realty (tier=mega, projects=77, delivered=25000, stars=4.6, honesty=88, logo=NO)
  ✅ Binghatti Developers (tier=mega, projects=65, delivered=8000, stars=4.1, honesty=74, logo=NO)
  ✅ Ellington (tier=mega, projects=65, delivered=5000, stars=4.5, honesty=85, logo=NO)
  ✅ Meraas Holding (tier=mega, projects=63, delivered=15000, stars=4.6, honesty=87, logo=NO)
  ✅ Samana Developers (tier=major, projects=48, delivered=4000, stars=4.0, honesty=72, logo=NO)
  ✅ Arada Sale (tier=major, projects=47, delivered=6000, stars=4.4, honesty=82, logo=NO)
  ✅ Reportage Properties (tier=major, projects=5, delivered=5000, stars=4.1, honesty=76, logo=NO)
  ✅ Tiger Group (tier=major, projects=4, delivered=12000, stars=4.0, honesty=73, logo=NO)
  ✅ Object 1 (tier=boutique, projects=3, delivered=1000, stars=3.8, honesty=70, logo=NO)
  ✅ Tarrad Properties (tier=mid, projects=3, delivered=2000, stars=3.9, honesty=71, logo=NO)
  ✅ HRE Developments (tier=mid, projects=3, delivered=1500, stars=3.9, honesty=72, logo=NO)
  ✅ One Development (tier=mid, projects=3, delivered=3000, stars=4.0, honesty=74, logo=NO)

### 5.2 — Areas Page: Only show areas with projects > 0
```sql
SELECT * FROM gc_area_profiles 
WHERE (payload::json->>'projects')::int > 0 
ORDER BY (payload::json->>'projects')::int DESC;
```

**Authorized area list:**
  ✅ Dubai (projects=783, emirate=Dubai)
  ✅ Abu Dhabi (projects=47, emirate=Abu Dhabi)
  ✅ Sharjah (projects=41, emirate=Sharjah)
  ✅ Umm Al Quwain (projects=22, emirate=Umm Al Quwain)
  ✅ Ras Al Khaimah (projects=11, emirate=Ras Al Khaimah)
  ✅ Jumeirah Village Circle (projects=9, emirate=Dubai)
  ✅ Dubai South (projects=6, emirate=Dubai)
  ✅ Business Bay (projects=6, emirate=Dubai)
  ✅ Dubai Marina (projects=6, emirate=Dubai)
  ✅ MBR City (projects=5, emirate=Dubai)
  ✅ Palm Jumeirah (projects=5, emirate=Dubai)
  ✅ Dubai Hills Estate (projects=5, emirate=Dubai)
  ✅ Downtown Dubai (projects=5, emirate=Dubai)
  ✅ JBR (JBR Beach) (projects=5, emirate=Dubai)
  ✅ Emaar South (projects=5, emirate=Dubai)
  ✅ Dubai Creek Harbour (projects=3, emirate=Dubai)
  ✅ Al Furjan (projects=2, emirate=Dubai)
  ✅ Dubailand (projects=1, emirate=Dubai)
  ✅ Al Jaddaf (projects=1, emirate=Dubai)
  ✅ Al Safa (projects=1, emirate=Dubai)
  ✅ Yas Island (projects=1, emirate=Abu Dhabi)
  ✅ Masdar City (projects=1, emirate=Abu Dhabi)
  ✅ Jumeirah Village Triangle (projects=1, emirate=Dubai)
  ✅ Dubai Silicon Oasis (projects=1, emirate=Dubai)
  ✅ Al Reem Island (projects=1, emirate=Abu Dhabi)
  ✅ Abu Dhabi Marina (projects=1, emirate=Abu Dhabi)

### 5.3 — Any developer or area on the frontend NOT in the above lists must be REMOVED from navigation, search, and listing pages.

---

## SECTION 6: BLOG CLEANUP

**4 Driven Properties blog posts have been DELETED from gc_blog_posts.**
The frontend should not hardcode or cache any blog slugs. Always query:
```sql
SELECT * FROM gc_blog_posts ORDER BY published_at DESC;
```
Any blog post referencing "Driven", "Drivien", "our CEO", or "our company" has been removed from the database. If the frontend caches blog data, purge the cache after deploy.

---

## SECTION 7: PROJECT CARD COMPONENT — Defensive Rendering

```tsx
// components/ProjectCard.tsx — DEFENSIVE VERSION
function ProjectCard({ project }: { project: GCProject }) {
  const p = project.payload || {};
  
  return (
    <Card>
      {/* Hero Image */}
      {p.heroImage ? (
        <img src={p.heroImage} alt={project.name} onError={(e) => e.currentTarget.style.display = 'none'} />
      ) : (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 h-48 flex items-center justify-center">
          <span className="text-white text-lg">{project.name}</span>
        </div>
      )}
      
      {/* Price */}
      <div className="price">
        {project.price_from_aed && project.price_from_aed > 0
          ? `AED ${project.price_from_aed.toLocaleString()}`
          : 'Price on Request'}
      </div>
      
      {/* Yield — only if > 0 */}
      {p.grossYield && p.grossYield > 0 && (
        <Badge>{p.grossYield.toFixed(1)}% yield</Badge>
      )}
      
      {/* ROI — only if > 0 */}
      {p.roi && p.roi > 0 && (
        <Badge>~{p.roi.toFixed(1)} yr ROI</Badge>
      )}
      
      {/* Score — only if > 0 */}
      {p.investmentScore && p.investmentScore > 0 && (
        <Badge>Score: {Math.round(p.investmentScore)}/100</Badge>
      )}
      
      {/* Developer Logo */}
      {p.developerLogo ? (
        <img src={p.developerLogo} alt={project.developer_name} className="h-6" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
          {project.developer_name?.[0] || '?'}
        </div>
      )}
    </Card>
  );
}
```

---

## SECTION 8: DEVELOPER PROFILE COMPONENT — Defensive Rendering

```tsx
// components/DeveloperProfile.tsx — DEFENSIVE VERSION
function DeveloperProfile({ dev }: { dev: GCDeveloper }) {
  const p = dev.payload || {};
  
  return (
    <div>
      {/* Banner */}
      {p.banner ? (
        <img src={p.banner} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-gradient-to-r from-gray-900 to-blue-900" />
      )}
      
      {/* Logo */}
      {dev.logo ? (
        <img src={dev.logo} className="w-16 h-16 rounded-full border-2" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
          {dev.name?.[0]}
        </div>
      )}
      
      {/* Stats — ONLY show if data exists */}
      <div className="grid grid-cols-3 gap-4">
        {p.projects && p.projects > 0 && (
          <Stat label="Active Projects" value={p.projects} />
        )}
        {p.deliveredUnits && p.deliveredUnits > 0 && (
          <Stat label="Delivered Units" value={p.deliveredUnits.toLocaleString()} />
        )}
        {p.stars && p.stars > 0 && (
          <Stat label="Rating" value={`${p.stars} ★`} />
        )}
        {p.honestyScore && p.honestyScore > 0 && (
          <Stat label="Trust Score" value={`${p.honestyScore}/100`} />
        )}
        {p.avgYield && p.avgYield > 0 && (
          <Stat label="Avg Yield" value={`${p.avgYield.toFixed(1)}%`} />
        )}
      </div>
      
      {/* Awards — only if non-empty */}
      {p.awards && p.awards.length > 0 && (
        <AwardsSection awards={p.awards} />
      )}
      
      {/* Flagship — only if non-empty */}
      {p.flagshipProjects && p.flagshipProjects.length > 0 && (
        <FlagshipSection projects={p.flagshipProjects} />
      )}
    </div>
  );
}
```

---

## SECTION 9: REMAINING DATA GAPS (cannot fix from DB side)

| Issue | Count | Action |
|-------|-------|--------|
| Developer logos missing | 16/26 | Frontend: first-letter avatar fallback |
| Developer banners missing | 26/26 | Frontend: CSS gradient fallback |
| Project developerLogo null | 975/975 | Frontend: pull from dev profile or avatar |

---

## SECTION 10: CACHE & DEPLOY

1. **Purge ISR/SSG cache** after deploy — stale pages may still show old zeros
2. **Purge CDN cache** if using Vercel Edge or Cloudflare
3. **Clear Redis cache** if blog posts or developer profiles are cached
4. **Revalidate** `/developers`, `/areas`, `/properties` pages
5. **Test these specific pages after deploy:**
   - `/developers/tarrad-properties` (new)
   - `/developers/hre-developments` (new)
   - `/developers/tiger-group` (new)
   - `/developers/object-1` (new)
   - `/developers/reportage-properties` (new)
   - `/developers/one-development` (new)
   - Any project page → verify ROI, yield, score are NOT showing 0
   - Developer profile → verify deliveredUnits is hidden if 0
   - Areas page → verify no empty area cards
