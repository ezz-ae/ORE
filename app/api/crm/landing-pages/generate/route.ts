import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { inventoryProperties } from "@/src/features/freehold-intelligence/inventory"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type AudienceType = "investor" | "luxury" | "end_user" | "generic"

// Section pools per audience — order matters (it becomes the page order)
const SECTION_POOLS: Record<AudienceType, string[]> = {
  investor: [
    "hero",
    "key-facts",
    "description",
    "units",
    "market-intelligence",
    "roi",
    "payment-plan",
    "golden-visa",
    "why-dubai",
    "ai-concierge",
    "faq",
    "lead-form",
  ],
  luxury: [
    "hero",
    "key-facts",
    "description",
    "gallery",
    "amenities",
    "units",
    "developer-profile",
    "location",
    "social-proof",
    "why-dubai",
    "download-brochure",
    "ai-concierge",
    "lead-form",
  ],
  end_user: [
    "hero",
    "key-facts",
    "description",
    "units",
    "amenities",
    "neighborhood",
    "location",
    "payment-plan",
    "why-dubai",
    "faq",
    "lead-form",
  ],
  generic: [
    "hero",
    "key-facts",
    "description",
    "gallery",
    "units",
    "market-intelligence",
    "payment-plan",
    "roi",
    "golden-visa",
    "amenities",
    "location",
    "why-dubai",
    "ai-concierge",
    "faq",
    "download-brochure",
    "lead-form",
  ],
}

function buildGenerationPrompt(project: Record<string, unknown>, audience: AudienceType): string {
  const sections = SECTION_POOLS[audience]

  const projectContext = `
Project Name: ${project.name || "Dubai Property"}
Area: ${project.area || "Dubai"}
Developer: ${project.developerName || "Leading Developer"}
Price from: ${project.priceFromAed ? `AED ${Number(project.priceFromAed).toLocaleString()}` : "Competitive pricing"}
Price to: ${project.priceToAed ? `AED ${Number(project.priceToAed).toLocaleString()}` : ""}
Rental Yield: ${project.rentalYield ? `${project.rentalYield}%` : "Strong returns"}
Payment Plan: ${project.paymentPlan ? JSON.stringify(project.paymentPlan) : "Flexible plan"}
Amenities: ${Array.isArray(project.amenities) ? project.amenities.join(", ") : "Premium amenities"}
FAQs: ${Array.isArray(project.faqs) ? JSON.stringify(project.faqs).slice(0, 600) : ""}
Target audience: ${audience}
`.trim()

  const sectionInstructions: Record<string, string> = {
    hero: `{
  "type": "hero",
  "data": {
    "eyebrow": "<area> · <developer> (2-3 parts separated by ·)",
    "title": "<compelling headline, max 10 words, unique to this property and audience>",
    "subtitle": "<one sentence, 15-25 words, the strongest investment/lifestyle angle>",
    "chips": ["<price chip>", "<yield or key stat>", "<area or handover>"]
  }
}`,
    description: `{
  "type": "description",
  "data": {
    "title": "<property name> — a compelling 4-6 word subtitle",
    "body": "<Write 3 compelling paragraphs (200-280 words total) about this specific property. Paragraph 1: the property concept, architecture, and what makes it distinct. Paragraph 2: the lifestyle and community it offers. Paragraph 3: the investment case and why now is the right time. Separate paragraphs with a blank line. Write like a senior Dubai property expert, NOT generic copy.>",
    "highlights": [
      "<unique selling point 1 — specific to this property>",
      "<unique selling point 2>",
      "<unique selling point 3>",
      "<unique selling point 4>"
    ]
  }
}`,
    gallery: `{
  "type": "gallery",
  "data": {
    "title": "Inside ${project.name || "the Development"}",
    "labels": [
      "<specific space label 1, e.g. 'Grand Lobby' or 'Master Suite'>",
      "<specific space label 2>",
      "<specific space label 3>",
      "<specific space label 4>",
      "<specific amenity or view label>",
      "<another specific label>"
    ]
  }
}`,
    units: `{
  "type": "units",
  "data": {
    "title": "Residence Types & Pricing",
    "units": [
      {
        "type": "<e.g. '1 Bedroom Apartment'>",
        "size": "<realistic sqft range for ${project.area || "Dubai"}, e.g. '650–850 sqft'>",
        "price": "<realistic AED price range based on project data, e.g. 'AED 1.2M – 1.6M'>",
        "features": ["<feature 1>", "<feature 2>", "<feature 3>"]
      },
      {
        "type": "<e.g. '2 Bedroom Apartment'>",
        "size": "<realistic sqft range>",
        "price": "<realistic AED price range>",
        "features": ["<feature 1>", "<feature 2>", "<feature 3>"]
      },
      {
        "type": "<e.g. '3 Bedroom Penthouse' or '3BR + Maid'>",
        "size": "<realistic sqft range>",
        "price": "<realistic AED price range>",
        "features": ["<feature 1>", "<feature 2>", "<feature 3>"]
      }
    ]
  }
}`,
    "market-intelligence": `{
  "type": "market-intelligence",
  "data": {
    "title": "AI Market Analysis",
    "subtitle": "<12-word tagline for this specific property>",
    "summary": "<2-sentence investment case for ${project.name || "this property"}, specific and data-backed>",
    "bullets": ["<fact 1>", "<fact 2>", "<fact 3>", "<fact 4>"]
  }
}`,
    roi: `{
  "type": "roi",
  "data": {
    "expectedRoi": ${project.rentalYield || 0},
    "rentalYield": ${project.rentalYield || 0},
    "startPriceAed": ${project.priceFromAed || 0}
  }
}`,
    "payment-plan": `{
  "type": "payment-plan",
  "data": {
    "downPayment": <number>,
    "duringConstruction": <number>,
    "onHandover": <number>,
    "postHandover": <number, 0 if none>
  }
}`,
    "golden-visa": `{
  "type": "golden-visa",
  "data": {
    "threshold": "AED 2,000,000",
    "benefits": ["10-year renewable UAE residency", "Sponsor spouse and children", "No UAE sponsor required", "Own property in freehold zones", "Renewable with continued ownership"]
  }
}`,
    "key-facts": `{
  "type": "key-facts",
  "data": {
    "items": [
      {"label": "Project", "value": "${project.name || "Property"}"},
      {"label": "Area", "value": "${project.area || "Dubai"}"},
      {"label": "Developer", "value": "${project.developerName || "Freehold"}"},
      {"label": "Starting Price", "value": "<formatted AED price>"}
    ]
  }
}`,
    amenities: `{
  "type": "amenities",
  "data": {
    "title": "Amenities",
    "items": [<list of amenity strings from the project data>]
  }
}`,
    location: `{
  "type": "location",
  "data": {
    "area": "${project.area || "Dubai"}",
    "developer": "${project.developerName || "Freehold"}",
    "title": "<creative location headline>",
    "subtitle": "<why this location matters for this audience, 1 sentence>",
    "highlights": ["<connectivity highlight>", "<lifestyle highlight>", "<investment highlight>"]
  }
}`,
    "why-dubai": `{
  "type": "why-dubai",
  "data": {}
}`,
    "developer-profile": `{
  "type": "developer-profile",
  "data": {
    "name": "${project.developerName || "Developer"}",
    "description": "<2 sentences about why this developer is trusted in Dubai>",
    "stats": [
      {"label": "Projects Delivered", "value": "<estimate>"},
      {"label": "Years in Market", "value": "<estimate>"},
      {"label": "UAE Properties", "value": "<estimate>"}
    ]
  }
}`,
    "social-proof": `{
  "type": "social-proof",
  "data": {
    "testimonials": [
      {"quote": "<realistic investor/buyer testimonial, 25-35 words>", "name": "<first name + initial>", "role": "<nationality + buyer type>", "rating": 5},
      {"quote": "<another realistic testimonial>", "name": "<first name + initial>", "role": "<nationality + buyer type>", "rating": 5}
    ]
  }
}`,
    neighborhood: `{
  "type": "neighborhood",
  "data": {
    "area": "${project.area || "Dubai"}",
    "description": "<2 sentences describing the lifestyle and investment appeal of ${project.area || "this area"}>",
    "highlights": ["<connectivity or location feature>", "<lifestyle feature>", "<community feature>", "<investment appeal>"]
  }
}`,
    "ai-concierge": `{
  "type": "ai-concierge",
  "data": {
    "title": "Ask Freehold AI",
    "subtitle": "Get instant answers about ${project.name || "this property"} from our AI advisor",
    "prompts": [
      "<specific question about yield vs appreciation for this property>",
      "<question about buyer profile or who this is right for>",
      "<question comparing this area to another Dubai area>"
    ]
  }
}`,
    faq: `{
  "type": "faq",
  "data": {
    "items": [
      {"question": "<specific question about ${project.name || "this property"} ROI or yield>", "answer": "<clear, 2-sentence answer with specific numbers if available>"},
      {"question": "<question about the payment plan structure>", "answer": "<clear answer explaining the plan>"},
      {"question": "<question about handover date or construction timeline>", "answer": "<clear answer>"},
      {"question": "<question about rental management or income realization>", "answer": "<clear answer>"},
      {"question": "<question about Golden Visa eligibility>", "answer": "<clear answer about AED 2M threshold and process>"},
      {"question": "<question about ${project.area || "this area"} vs other Dubai areas>", "answer": "<clear comparison answer>"},
      {"question": "<question about resale or exit strategy>", "answer": "<clear answer about liquidity and market depth>"},
      {"question": "<question about service charges or running costs>", "answer": "<honest, clear answer>"}
    ]
  }
}`,
    "download-brochure": `{
  "type": "download-brochure",
  "data": {
    "title": "<CTA headline, 5-7 words>",
    "subtitle": "<one line explaining what's in the brochure>"
  }
}`,
    "lead-form": `{
  "type": "lead-form",
  "data": {
    "title": "<form headline, action-oriented, 5-8 words>",
    "subtitle": "<what happens after they submit, 15-20 words>"
  }
}`,
  }

  const sectionSchemas = sections
    .filter((s) => sectionInstructions[s])
    .map((s) => sectionInstructions[s])
    .join(",\n    ")

  return `You are a world-class Dubai real estate landing page copywriter for Freehold Property UAE.
Create compelling, UNIQUE landing page content for this specific property. Do NOT use generic templates.
Every word must be specific to this property, area, and audience. Write like a seasoned Dubai property expert.

PROJECT DATA:
${projectContext}

AUDIENCE: ${audience} buyers
- investor: ROI-focused, global, analytical, cares about yield/capital gains/Golden Visa
- luxury: lifestyle-driven, premium, wants exclusivity and prestige
- end_user: family/professional moving to Dubai, wants community, practicality, value
- generic: balanced mix

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "headline": "<page headline, max 10 words, compelling and specific>",
  "subheadline": "<page subheadline, 15-20 words, property's strongest angle>",
  "ctaText": "<CTA button text, 3-5 words, action-oriented for ${audience}>",
  "sections": [
    ${sectionSchemas}
  ]
}

Rules:
- Never invent financial guarantees or claim "guaranteed returns"
- Use "projected" or "estimated" for yield/ROI figures
- All copy must be publication-ready, zero placeholders
- Write as Freehold's expert team, not as an AI
- Headlines must be specific to ${project.name || "this property"}, not generic Dubai copy`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 })

    const body = await req.json()
    const projectSlug: string = (body.projectSlug || "").trim()
    const audience: AudienceType = (["investor", "luxury", "end_user", "generic"].includes(body.audience)
      ? body.audience
      : "generic") as AudienceType
    const saveToSlug: string = (body.slug || "").trim()

    if (!projectSlug) return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })

    // Fetch project data
    const rows = await query<{
      slug: string | null
      name: string | null
      area: string | null
      developer_name: string | null
      hero_image: string | null
      price_from_aed: number | null
      price_to_aed: number | null
      rental_yield: number | null
      payload: Record<string, unknown> | null
    }>(
      `SELECT slug, name, area, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, payload
       FROM freehold_site_projects
       WHERE lower(slug) = $1 OR lower(payload->>'slug') = $1
       LIMIT 1`,
      [projectSlug.toLowerCase()],
    )

    let row = rows[0]
    // Fall back to the static inventory seed for curated/seed-only projects.
    if (!row) {
      const seed = inventoryProperties.find(
        (p) => p.slug.toLowerCase() === projectSlug.toLowerCase(),
      )
      if (seed) {
        row = {
          slug: seed.slug,
          name: seed.name,
          area: seed.area,
          developer_name: seed.developer,
          hero_image: null,
          price_from_aed: seed.startingPriceAED,
          price_to_aed: seed.maxPriceAED,
          rental_yield: seed.roi,
          payload: null,
        }
      }
    }
    if (!row) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const payload = row.payload && typeof row.payload === "object" ? row.payload : {}
    const paymentPlan = payload.paymentPlan && typeof payload.paymentPlan === "object" ? payload.paymentPlan as Record<string, unknown> : {}
    const amenities = Array.isArray(payload.amenities) ? payload.amenities : []
    const faqs = Array.isArray(payload.faqs) ? payload.faqs : []

    const projectData: Record<string, unknown> = {
      name: row.name,
      area: row.area,
      developerName: row.developer_name,
      priceFromAed: row.price_from_aed,
      priceToAed: row.price_to_aed,
      rentalYield: row.rental_yield,
      paymentPlan,
      amenities,
      faqs,
    }

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured (GEMINI_API_KEY missing)" }, { status: 503 })
    }

    const prompt = buildGenerationPrompt(projectData, audience)
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp"

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      },
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => `HTTP ${geminiRes.status}`)
      console.error("[lp-generate] Gemini error:", errText)
      return NextResponse.json({ error: "AI generation failed", detail: errText }, { status: 502 })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ""

    let generated: {
      headline?: string
      subheadline?: string
      ctaText?: string
      sections?: unknown[]
    } = {}

    try {
      const start = rawText.indexOf("{")
      const end = rawText.lastIndexOf("}")
      if (start !== -1 && end > start) {
        generated = JSON.parse(rawText.slice(start, end + 1))
      }
    } catch {
      console.error("[lp-generate] Failed to parse Gemini response:", rawText.slice(0, 500))
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 })
    }

    const sections = Array.isArray(generated.sections) ? generated.sections : []
    if (!sections.length) {
      return NextResponse.json({ error: "AI returned no sections" }, { status: 502 })
    }

    // If a landing page slug was provided, save the generated sections to DB
    if (saveToSlug) {
      await query(
        `UPDATE freehold_site_project_landing_pages
         SET sections_json = $1::jsonb,
             sections = $1::jsonb,
             content_json = $1::jsonb,
             headline = COALESCE(NULLIF($2, ''), headline),
             subheadline = COALESCE(NULLIF($3, ''), subheadline),
             cta_text = COALESCE(NULLIF($4, ''), cta_text),
             updated_at = now()
         WHERE lower(slug) = $5`,
        [
          JSON.stringify(sections),
          generated.headline || "",
          generated.subheadline || "",
          generated.ctaText || "",
          saveToSlug.toLowerCase(),
        ],
      )
    }

    return NextResponse.json({
      ok: true,
      audience,
      headline: generated.headline,
      subheadline: generated.subheadline,
      ctaText: generated.ctaText,
      sections,
      savedToSlug: saveToSlug || null,
    })
  } catch (err) {
    console.error("[lp-generate] error:", err)
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
}
