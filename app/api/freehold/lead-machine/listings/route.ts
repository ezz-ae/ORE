import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

function score(value: boolean, points: number) {
  return value ? points : 0
}

function mapListing(row: any) {
  const hasPrice = Boolean(row.price_from_aed)
  const hasPaymentPlan = Boolean(row.payment_plan)
  const hasMedia = Boolean(row.hero_image)
  const hasArea = Boolean(row.area)
  const hasDeveloper = Boolean(row.developer_name)
  const dataQualityScore = score(Boolean(row.name), 15) + score(hasArea, 15) + score(hasDeveloper, 15) + score(hasPrice, 15) + score(hasPaymentPlan, 15) + score(hasMedia, 15) + score(Boolean(row.handover_date), 10)
  const landingIsReady = row.landing_slug && !String(row.landing_status || '').toLowerCase().includes('draft')
  const landingReadinessScore = landingIsReady ? Math.min(100, dataQualityScore + 10) : row.landing_slug ? Math.min(80, dataQualityScore) : Math.min(70, dataQualityScore)
  const adReadinessScore = row.landing_slug ? Math.min(85, landingReadinessScore - (hasPaymentPlan ? 0 : 20)) : Math.min(40, dataQualityScore)
  const opportunityScore = Math.min(100, Math.round((dataQualityScore + landingReadinessScore + adReadinessScore) / 3))
  const missingRequirements = [
    ...(!row.landing_slug ? ['Landing page'] : []),
    ...(!hasPaymentPlan ? ['Payment plan'] : []),
    ...(!hasMedia ? ['Project media'] : []),
  ]
  return {
    id: `lm_${row.id}`,
    projectId: row.id,
    projectName: row.name,
    area: row.area || 'Unknown area',
    developer: row.developer_name || 'Unknown developer',
    imageUrl: row.hero_image || null,
    startingPrice: row.price_from_aed,
    paymentPlan: row.payment_plan,
    priceStatus: hasPrice ? 'Ready' : 'Pending',
    paymentPlanStatus: hasPaymentPlan ? 'Ready' : 'Pending',
    mediaStatus: hasMedia ? 'Ready' : 'Pending',
    hasMedia,
    dataQualityScore,
    landingReadinessScore,
    adReadinessScore,
    opportunityScore,
    landingStatus: landingIsReady ? 'Landing Active' : row.landing_slug ? 'Landing Draft' : 'Setup Required',
    adStatus: adReadinessScore >= 70 ? 'Ready for Ads' : hasPaymentPlan ? 'In Review' : 'Data Incomplete',
    blockerStatus: adReadinessScore >= 70 ? 'Clear' : hasPaymentPlan ? 'Access Required' : 'Data Incomplete',
    currentCampaignStatus: landingIsReady ? 'Approved' : 'Landing Draft',
    leadFormStatus: row.landing_slug ? 'Ready' : 'Pending',
    whatsappFlowStatus: row.landing_slug ? 'Ready' : 'In Review',
    missingRequirements,
    linkedMilestoneId: row.landing_slug ? 'M5' : 'M3',
    owner: row.landing_slug ? 'Marketing' : 'Data Manager',
    nextAction: row.landing_slug ? 'Review ad readiness and approval requirements.' : 'Request landing page setup.',
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query<any>(`
    SELECT p.id, p.slug, p.name, p.area, p.developer_name, p.hero_image,
           p.price_from_aed, COALESCE(p.payload->>'payment_plan', p.payload->>'paymentPlan') AS payment_plan, p.handover_date, l.slug AS landing_slug,
           COALESCE(l.status, l.publish_status, '') AS landing_status
    FROM freehold_site_projects p
    LEFT JOIN freehold_site_project_landing_pages l ON l.project_slug = p.slug
    ORDER BY p.updated_at DESC NULLS LAST, p.name ASC
    LIMIT 100
  `)
  const listings = rows.map(mapListing)
  const matrix = listings.map((listing: any) => ({
    project: listing.projectName,
    area: listing.area,
    developer: listing.developer,
    landingStatus: listing.landingStatus,
    dataQuality: listing.dataQualityScore,
    mediaReady: listing.mediaStatus === 'Ready',
    paymentPlanReady: listing.paymentPlanStatus === 'Ready',
    adReadiness: listing.adReadinessScore,
    opportunityScore: listing.opportunityScore,
    blocker: listing.missingRequirements[0] || 'None',
    nextAction: listing.nextAction,
  }))
  return NextResponse.json({
    data: { listings, matrix },
    count: listings.length,
    generatedAt: new Date().toISOString(),
  })
}
