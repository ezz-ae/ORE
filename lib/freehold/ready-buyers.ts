/**
 * THE READY-BUYER TEMPLATES — the market list, as data.
 *
 * One place, three consumers: the Targeting page gallery renders them, the
 * campaign wizard offers them directly as audiences (no save-first detour),
 * and the launch route resolves a picked template through the same kitchen
 * (`planPattern`) as every saved pattern audience.
 *
 * Every buyer is SINGLE-COUNTRY and SINGLE-LANGUAGE. Every card is a
 * conversion target. `cplAed` is a market estimate band; the suggested budget
 * derives from it at the mid point.
 */

export type BuyerGroup = 'uae' | 'gulf' | 'world'

const EXCLUDES = ['agents_and_brokers', 'job_seekers', 'bargain_hunters']

export interface ReadyBuyer {
  id: string
  group: BuyerGroup
  cplAed: [number, number]
  pattern: Record<string, unknown>
}

export const READY_BUYERS: ReadyBuyer[] = [
  // ── The UAE: buyers already here ──
  { id: 'arabicCashUAE', group: 'uae', cplAed: [250, 450], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'arabicPlanUAE', group: 'uae', cplAed: [120, 250], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'payment_plan',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },
  { id: 'allArabicUAE', group: 'uae', cplAed: [80, 180], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },
  // End-user motives are whole-market interests on Meta, so this card runs at
  // full strictness with the mortgage band — anything looser buys the whole UAE.
  { id: 'arabicEndUserUAE', group: 'uae', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['first_home', 'upgrade'], money: 'mortgage',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'arabicGoldenVisa', group: 'uae', cplAed: [300, 550], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['golden_visa', 'investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'englishMortgage', group: 'uae', cplAed: [150, 300], pattern: {
      speakers: ['english'], residency: ['resident', 'expat'], motive: ['investment'], money: 'mortgage',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },
  { id: 'englishCash', group: 'uae', cplAed: [280, 500], pattern: {
      speakers: ['english'], residency: ['resident'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'europeanUAE', group: 'uae', cplAed: [140, 280], pattern: {
      speakers: ['english'], residency: ['expat'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'russianCash', group: 'uae', cplAed: [200, 400], pattern: {
      speakers: ['russian'], residency: ['resident'], motive: ['investment', 'holiday_home'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },

  // ── The Gulf: every country its own campaign ──
  { id: 'saudiCash', group: 'gulf', cplAed: [90, 200], pattern: {
      speakers: ['arabic'], residency: ['saudi'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'saudiGoldenVisa', group: 'gulf', cplAed: [120, 260], pattern: {
      speakers: ['arabic'], residency: ['saudi'], motive: ['golden_visa', 'investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'qatarInvestor', group: 'gulf', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['qatar'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'kuwaitInvestor', group: 'gulf', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['kuwait'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'bahrainInvestor', group: 'gulf', cplAed: [90, 190], pattern: {
      speakers: ['arabic'], residency: ['bahrain'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'omanInvestor', group: 'gulf', cplAed: [80, 170], pattern: {
      speakers: ['arabic'], residency: ['oman'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'gccArabic', group: 'gulf', cplAed: [70, 160], pattern: {
      speakers: ['arabic'], residency: ['gcc'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },

  // ── The world: buyers who fly in ──
  { id: 'internationalEnglish', group: 'world', cplAed: [60, 150], pattern: {
      speakers: ['english'], residency: ['overseas'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },
  { id: 'arabicFrance', group: 'world', cplAed: [60, 140], pattern: {
      speakers: ['arabic'], residency: ['france'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'russianEgypt', group: 'world', cplAed: [50, 120], pattern: {
      speakers: ['russian'], residency: ['egypt'], motive: ['investment', 'holiday_home'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'englishEurope', group: 'world', cplAed: [70, 160], pattern: {
      speakers: ['english'], residency: ['europe'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'arabicEurope', group: 'world', cplAed: [60, 140], pattern: {
      speakers: ['arabic'], residency: ['europe'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
]

export const BUYER_GROUPS: BuyerGroup[] = ['uae', 'gulf', 'world']

export const getReadyBuyer = (id: string): ReadyBuyer | undefined =>
  READY_BUYERS.find((b) => b.id === id)
