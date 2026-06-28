import { NextResponse } from 'next/server'
import type { GenerateRsaPayload, GeneratedRsaVariant } from '@/lib/google/types'

function fmtPrice(n: number | null): string {
  if (!n) return ''
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `AED ${Math.round(n / 1_000)}K`
  return `AED ${n}`
}

function buildRsaVariants(p: GenerateRsaPayload): GeneratedRsaVariant[] {
  const price     = fmtPrice(p.startingPrice)
  const priceStr  = price ? ` from ${price}` : ''
  const pp        = p.paymentPlan ? ` · ${p.paymentPlan}` : ''
  const id        = () => Math.random().toString(36).slice(2, 9)

  const base: Record<GenerateRsaPayload['angle'], GeneratedRsaVariant[]> = {
    investor: [
      {
        id: id(),
        note: 'ROI + location authority',
        headlines: [
          `Invest in ${p.area}`,
          `${p.listingName}${priceStr}`,
          `7%+ Net Yield Dubai`,
          `${p.developer} — Proven Track Record`,
          `Capital Growth + Rental Income`,
          `Freehold. No Property Tax`,
          `Senior Advisor On Call`,
          `Compare All Dubai Projects`,
          `Complimentary ROI Analysis`,
          `Register Interest Today`,
          `Limited Investor Allocation`,
          `${p.area} — Prime Location`,
        ],
        descriptions: [
          `${p.listingName} by ${p.developer}${priceStr}${pp}. High-yield freehold in ${p.area}. Speak to a senior property advisor — zero obligation.`,
          `Dubai has zero property tax and strong rental demand. ${p.area} delivers consistent yield and capital appreciation. Request your free investment briefing.`,
        ],
      },
      {
        id: id(),
        note: 'Numbers-first direct',
        headlines: [
          `${price ? price + ' Starting' : p.listingName}`,
          `Freehold ${p.area} Property`,
          `7–9% Gross Rental Yield`,
          `${p.developer} Developer`,
          `No Income Tax on Rentals`,
          `Post-Handover Payment Plan`,
          `AED 2M+ Qualifies for Golden Visa`,
          `Direct From Developer`,
          `Speak to an Advisor Now`,
          `${p.listingName} — Register Today`,
        ],
        descriptions: [
          `${p.listingName}${priceStr}. ${p.paymentPlan ?? 'Flexible payment plans available'}. Freehold title, no rental income tax, strong demand from expats and tourists.`,
          `Invest in Dubai real estate with ${p.developer}. ${p.area} consistently outperforms global markets. Request pricing and payment plan details now.`,
        ],
      },
    ],

    yield: [
      {
        id: id(),
        note: 'Yield headline + proof',
        headlines: [
          `7% Net Yield — ${p.area}`,
          `${p.listingName} — Rent Immediately`,
          `Dubai: No Property Tax`,
          `Strong Tenant Demand Here`,
          `${p.developer} Quality Assurance`,
          `Fully Managed Option Available`,
          `Short-Term Rental Permitted`,
          `Buy-to-Let ${p.area}`,
          `High Occupancy Zone Dubai`,
          `Rental Comparison Report Free`,
        ],
        descriptions: [
          `${p.area} properties average 6.5–8% gross yield. ${p.listingName}${priceStr} by ${p.developer}. Request a free rental yield projection for this unit.`,
          `Zero income tax on Dubai rental income. ${p.listingName} is positioned in a high-occupancy corridor. Download our buy-to-let guide.`,
        ],
      },
    ],

    golden_visa: [
      {
        id: id(),
        note: 'Residency angle',
        headlines: [
          `Get a 10-Year UAE Visa`,
          `AED 2M Property = Golden Visa`,
          `${p.listingName} Qualifies`,
          `Invest & Get UAE Residency`,
          `Visa + Investment in ${p.area}`,
          `${p.developer} — Visa Eligible`,
          `Live, Work, Invest in UAE`,
          `Golden Visa Expert Guidance`,
          `Renew Every 10 Years`,
          `UAE Family Residency Included`,
          `No Minimum Stay Required`,
          `Register for Visa Briefing`,
        ],
        descriptions: [
          `Properties starting from AED 2M in ${p.area} qualify for the UAE Golden Visa — 10-year renewable residency for you and your family. ${p.listingName}${priceStr}.`,
          `Secure UAE residency through real estate investment. ${p.developer}'s ${p.listingName} in ${p.area} is visa-eligible. Speak to an advisor about the process.`,
        ],
      },
    ],

    end_user: [
      {
        id: id(),
        note: 'Family lifestyle',
        headlines: [
          `Your New Home in ${p.area}`,
          `${p.listingName} — Move-In Ready`,
          `School, Parks, Community`,
          `${p.developer} Quality Build`,
          `${price ? price + ' — Own Today' : 'Own Your Home Today'}`,
          `3 & 4 Bed Apartments`,
          `Outdoor Spaces Included`,
          `Safe Family Community`,
          `World-Class Amenities`,
          `Book a Viewing Today`,
          `No Annual Property Tax`,
          `${p.area} — Dubai's Best Kept Secret`,
        ],
        descriptions: [
          `${p.listingName} by ${p.developer} in ${p.area}${priceStr}. Family-friendly community with parks, international schools nearby, and resort-style amenities. Book your site visit.`,
          `Own your home in one of Dubai's most connected neighbourhoods. ${p.listingName}${pp}. Register interest today — limited units remain.`,
        ],
      },
    ],

    urgency: [
      {
        id: id(),
        note: 'Scarcity + price lock',
        headlines: [
          `Last Units at Launch Price`,
          `${p.listingName} — Phase Closing`,
          `Price Increase Confirmed`,
          `${price ? price + ' — Last Chance' : 'Lock in Your Price Today'}`,
          `Only 12 Units Remaining`,
          `Prices Rise After Launch`,
          `${p.area} — Demand Surge 2025`,
          `Register Before Price Rise`,
          `Limited Allocation Remaining`,
          `Don't Miss This Project`,
          `${p.developer} Launch Closing`,
          `Act Before Price Revision`,
        ],
        descriptions: [
          `${p.listingName} by ${p.developer} in ${p.area}${priceStr}. Launch pricing closes this phase. Register your interest today to secure the current rate.`,
          `${p.area} has seen 23% capital growth in 12 months. Only limited units remain at this pricing. Speak to a senior advisor before the launch closes.`,
        ],
      },
    ],

    lifestyle: [
      {
        id: id(),
        note: 'Views + amenities',
        headlines: [
          `Waterfront Living — ${p.area}`,
          `${p.listingName} — Stunning Views`,
          `Resort-Style Dubai Living`,
          `${p.developer} Signature Finish`,
          `Pool, Gym, Concierge`,
          `Wake Up to the Dubai Skyline`,
          `Beachfront Access Included`,
          `5-Star Amenities Included`,
          `Private Terrace. City Views`,
          `The Best Address in ${p.area}`,
        ],
        descriptions: [
          `${p.listingName} offers panoramic views, resort-quality amenities, and the prestige of a ${p.developer} address in ${p.area}${priceStr}. Book a private viewing.`,
          `Experience Dubai's most coveted lifestyle in ${p.area}. ${p.listingName} — private pools, curated spaces, and world-class service. Limited residences available.`,
        ],
      },
    ],
  }

  return base[p.angle] ?? []
}

// Live Gemini RSA generation. Returns null on no-key / error / bad output so the
// caller falls back to the deterministic template (button always works).
async function geminiRsa(p: GenerateRsaPayload): Promise<GeneratedRsaVariant[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const price = fmtPrice(p.startingPrice)
  const prompt = `You are a senior Google Ads copywriter for Dubai freehold real estate.
Write Responsive Search Ad copy for: "${p.listingName}" by ${p.developer || 'the developer'} in ${p.area || 'Dubai'}.
Angle: ${p.angle}. Tone: ${p.tone}.${price ? ` Starting price ${price}.` : ''}${p.paymentPlan ? ` Payment plan: ${p.paymentPlan}.` : ''}
Produce exactly 2 distinct variants. Each variant: 12 headlines (each MAX 30 characters) and 3 descriptions (each MAX 90 characters).
Return ONLY JSON, no markdown:
{"variants":[{"note":"short label","headlines":["..."],"descriptions":["..."]}]}`
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048, responseMimeType: 'application/json' },
        }),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as { variants?: Array<{ note?: string; headlines?: string[]; descriptions?: string[] }> }
    if (!Array.isArray(parsed.variants) || parsed.variants.length === 0) return null
    const id = () => Math.random().toString(36).slice(2, 9)
    const out = parsed.variants.slice(0, 3).map((v) => ({
      id: id(),
      note: (v.note || 'AI variant').slice(0, 60),
      headlines: (v.headlines || []).filter(Boolean).slice(0, 15).map((h) => String(h).slice(0, 30)),
      descriptions: (v.descriptions || []).filter(Boolean).slice(0, 4).map((d) => String(d).slice(0, 90)),
    })).filter((v) => v.headlines.length >= 3 && v.descriptions.length >= 1)
    return out.length ? out : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as GenerateRsaPayload
    if (!body.listingName || !body.angle || !body.tone) {
      return NextResponse.json({ error: 'listingName, angle, and tone are required' }, { status: 400 })
    }
    const ai = await geminiRsa(body)
    const variants = ai ?? buildRsaVariants(body)
    return NextResponse.json({ variants, source: ai ? 'gemini' : 'template' })
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
