import { NextRequest, NextResponse } from 'next/server'
import type { GenerateCreativePayload, GeneratedCreativeVariant, MetaCta } from '@/lib/meta/types'

function fmtPrice(n: number | null) {
  if (!n) return 'AED TBD'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  return `AED ${Math.round(n / 1000)}K`
}

function buildVariants(p: GenerateCreativePayload): GeneratedCreativeVariant[] {
  const price = fmtPrice(p.startingPrice)
  const plan  = p.paymentPlan ?? 'flexible payment plan'
  const cta   = p.cta

  const sets: Record<string, { primaryText: string; headline: string; description: string }[]> = {

    investor: [
      {
        primaryText: `Investors are moving fast on ${p.projectName}. Starting at ${price} with a ${plan} — this is the yield corridor Dubai advisors are recommending first.\n\nLimited allocation at this price. Enquire today for a private comparison.`,
        headline:    `${p.projectName} — ${price} · ${plan}`,
        description: `${p.area} · ${p.developer} · Investor-grade ROI`,
      },
      {
        primaryText: `${p.area} is outperforming the Dubai average on rental yield. ${p.developer}'s ${p.projectName} starts at ${price}.\n\nFull payment plan, handover timeline, and yield projection available — request yours now.`,
        headline:    `${price} · ${p.area} · ${plan}`,
        description: `${p.developer} · ${p.area} · Investment briefing`,
      },
      {
        primaryText: `If you're comparing ${p.area} with Downtown or Beachfront, the numbers favour ${p.projectName}. ${price} entry. ${plan}. Higher net yield. Same quality developer.\n\nBook a 10-minute comparison call today.`,
        headline:    `Why ${p.area}? The numbers.`,
        description: `${p.projectName} · from ${price} · ${p.developer}`,
      },
    ],

    yield: [
      {
        primaryText: `${p.projectName} is generating the strongest net yield in ${p.area}. Entry from ${price} with ${plan}.\n\nRequest the full yield projection before this allocation closes.`,
        headline:    `Highest yield in ${p.area} — from ${price}`,
        description: `${p.developer} · ${p.area} · Yield comparison included`,
      },
      {
        primaryText: `Dubai yields don't last. ${p.developer}'s ${p.area} project is live at ${price}.\n\n${plan} available. Handover timeline confirmed. Request your investor pack today.`,
        headline:    `${p.area} investor pack — act now`,
        description: `From ${price} · ${plan} · ${p.developer}`,
      },
    ],

    golden_visa: [
      {
        primaryText: `Qualify for UAE Golden Visa residency through ${p.projectName}.\n\nFrom ${price} — above the AED 2M threshold. ${plan}. ${p.developer}.\n\nRequest the full eligibility guide and property comparison today.`,
        headline:    `Golden Visa eligible — from ${price}`,
        description: `${p.projectName} · UAE residency · ${p.area}`,
      },
      {
        primaryText: `${p.area} + UAE Golden Visa in a single purchase.\n\n${p.projectName} from ${price} qualifies. ${p.developer} developer. ${plan}.\n\nSpeak to an advisor about the pathway today.`,
        headline:    `Live in Dubai. Own it. ${price}.`,
        description: `${p.developer} · Golden Visa eligible · ${p.area}`,
      },
    ],

    end_user: [
      {
        primaryText: `${p.projectName} in ${p.area} — the kind of home families don't leave.\n\nFrom ${price} with ${plan}. Schools, green space, and community all nearby.\n\nRequest a private viewing now.`,
        headline:    `Your family's next home — ${p.area}`,
        description: `${p.projectName} · from ${price} · ${p.developer}`,
      },
      {
        primaryText: `${p.area} is consistently rated one of the best places to raise a family in Dubai. ${p.developer}'s ${p.projectName} starts at ${price}.\n\n${plan}. Community living. Excellent access to schools.\n\nBook a guided viewing.`,
        headline:    `${p.area} family living — from ${price}`,
        description: `${p.developer} · ${p.projectName} · Community home`,
      },
    ],

    urgency: [
      {
        primaryText: `Last units at ${price} in ${p.developer}'s ${p.projectName}. Once this allocation closes, prices move up.\n\n${plan} available. ${p.area}.\n\nEnquire now — availability confirmed in 24 hours.`,
        headline:    `Last chance — ${price} in ${p.area}`,
        description: `${p.developer} · Limited allocation · ${plan}`,
      },
      {
        primaryText: `${p.area} prices have moved 18% this year. ${p.projectName} is still at ${price} — for now.\n\n${plan}. Handover confirmed. ${p.developer}.\n\nThis window closes when the allocation is sold.`,
        headline:    `Price hold ends soon — ${p.area}`,
        description: `${p.projectName} · ${price} · ${p.developer}`,
      },
    ],

    lifestyle: [
      {
        primaryText: `Living in ${p.area} means waking up to the best of Dubai every morning.\n\n${p.developer}'s ${p.projectName} — from ${price} with ${plan}.\n\nSee the interiors. Book a private tour.`,
        headline:    `${p.area} lifestyle — from ${price}`,
        description: `${p.projectName} · ${p.developer} · Private tour`,
      },
    ],
  }

  const angleVariants = sets[p.angle] ?? sets.investor
  return angleVariants.map((v, i) => ({ id: `variant_${i + 1}`, cta, ...v }))
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateCreativePayload

    const required: (keyof GenerateCreativePayload)[] = ['listingId', 'listingName', 'area', 'developer', 'angle', 'tone', 'cta']
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
    }

    const variants = buildVariants(body)
    return NextResponse.json({ variants })
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
