/**
 * KEYS THE i18n AUDIT CANNOT SEE — locked.
 *
 * `pnpm i18n` reports "full EN/AR/RU parity, all used keys resolve". It passed
 * on every run while a live campaign page printed the raw string
 * `lm.place.verdict.noClicks` to a client, in place of a word.
 *
 * Both statements are true. The audit walks LITERAL `t('...')` calls, and these
 * families are rendered through a computed key:
 *
 *     t(`lm.place.verdict.${r.verdict}`)
 *     t(`lm.setupCheck.${f.key}`)
 *     t(`lm.geo.${f.key}`)
 *
 * Parity across three dictionaries is not the same property as coverage of the
 * values the code can actually produce. A key absent from ALL THREE languages
 * is in perfect parity and renders as itself.
 *
 * So each family below is enumerated at runtime — as a `const` array the TYPE
 * is derived from, so a new member cannot be added without appearing here —
 * and checked against every language. This is the audit for the half the audit
 * cannot reach.
 *
 * Runs in `pnpm guards`.
 */
import { PLACEMENT_VERDICTS } from '../lib/freehold/placement-audit'
import { READY_BUYERS } from '../lib/freehold/ready-buyers'
import { REQUEST_STATUSES } from '../lib/freehold/campaign-requests'
import { personaIds } from '../lib/freehold/persona-audience'
import { WARM_AUDIENCES } from '../lib/freehold/warm-audiences'
import { DELIVERY_STATES } from '../lib/meta/delivery-status'
import { REC_KEYS, REC_ACTION_LABELS } from '../lib/freehold/recommendations'
import { LAUNCHABLE_PLACEMENTS } from '../lib/freehold/placement-memory'
import { AD_FORMATS } from '../lib/meta/adset-placements'
import { SIGNAL_IDS, SIGNAL_ACTIONS } from '../lib/freehold/live-signals'
import { LAB_LAYOUTS, LAB_ANGLES, WITHHELD_REASONS, RECIPE_VERDICTS } from '../lib/freehold/creative-lab'
import { lm_ads } from '../lib/i18n/dictionaries/lm_ads'
import { lm_core } from '../lib/i18n/dictionaries/lm_core'
import { lm_audiences } from '../lib/i18n/dictionaries/lm_audiences'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const LOCALES = ['en', 'ar', 'ru'] as const

/** Every key the code can compute, checked in every language. */
function family(label: string, prefix: string, members: readonly string[], dict: typeof lm_ads = lm_ads) {
  const missing: string[] = []
  for (const locale of LOCALES) {
    for (const m of members) {
      const key = `${prefix}${m}`
      const value = dict[locale][key]
      // Present but empty is the same failure with a quieter symptom.
      if (typeof value !== 'string' || value.trim() === '') missing.push(`${locale}:${key}`)
    }
  }
  check(`${label} — all ${members.length} values have words in all three languages`,
    missing.length === 0, missing.join(', '))

  // A value that merely echoes its own key is what the screen was showing.
  const echoes = LOCALES.flatMap((l) => members
    .filter((m) => dict[l][`${prefix}${m}`] === `${prefix}${m}`)
    .map((m) => `${l}:${prefix}${m}`))
  check(`${label} — none of them renders as its own key`, echoes.length === 0, echoes.join(', '))
}

console.log('\n── placement verdicts ──')
{
  // The exact family that broke, and the exact member that broke it.
  check('the verdict list is enumerable at runtime, not only a type',
    Array.isArray(PLACEMENT_VERDICTS) && PLACEMENT_VERDICTS.length > 0)
  check('…and it contains the click verdict that shipped without a word',
    (PLACEMENT_VERDICTS as readonly string[]).includes('noClicks'))
  family('lm.place.verdict', 'lm.place.verdict.', PLACEMENT_VERDICTS)
}

console.log('\n── setup-check findings ──')
{
  // Not derived from a type: `checkCampaignSetup` builds these keys as string
  // literals at each push site. Listed here so adding a finding without a word
  // fails the build rather than reaching a client.
  const SETUP_KEYS = [
    'noAdSets', 'adSetPaused', 'noAds', 'noLiveAd', 'noTargeting',
    'noPlace', 'place', 'manyCountries', 'visitors', 'residents',
    'noProperty', 'property', 'expansion', 'youngAge', 'age',
    'anyPlacement', 'offPlatform', 'loosePlacement', 'placements',
    'softGoal', 'noBudget', 'capped', 'capChoking',
  ]
  family('lm.setupCheck', 'lm.setupCheck.', SETUP_KEYS)
}

console.log('\n── geo delivery findings ──')
{
  family('lm.geo', 'lm.geo.', ['onTarget', 'strayed'])
}

console.log('\n── campaign-request statuses ──')
{
  // Broker screen and fulfilment queue both render t(`creq.status.${s}`).
  family('creq.status', 'creq.status.', REQUEST_STATUSES)
}

console.log('\n── launcher audience markets ──')
{
  // Step 2 renders t(`lm.newCampaign.s2.market.${m}`) over the market chips.
  // lm_core is a different shard than lm_ads, hence the explicit dict — the
  // family helper does not care which shard, only that words exist.
  family('lm.newCampaign.s2.market', 'lm.newCampaign.s2.market.', ['uae', 'gulf', 'world'], lm_core)
}

console.log('\n── recommendations ──')
{
  // The Recommended panel renders t(`lm.rec.${key}.t`), `.b`, and
  // t(`lm.rec.act.${labelKey}`) — three computed families off one catalog.
  family('lm.rec.*.t', 'lm.rec.', REC_KEYS.map((k) => `${k}.t`))
  family('lm.rec.*.b', 'lm.rec.', REC_KEYS.map((k) => `${k}.b`))
  family('lm.rec.act', 'lm.rec.act.', REC_ACTION_LABELS)

  // The creative pool names the ad set's REAL surfaces — t(`lm.place.name.${k}`)
  // — and the design shapes those surfaces can use, t(`lm.pool.shape.${f}`).
  // Both are computed off catalogs the types derive from, so a new surface or
  // a new shape cannot ship without a word behind it in all three languages.
  family('lm.place.name', 'lm.place.name.', LAUNCHABLE_PLACEMENTS)
  family('lm.pool.shape', 'lm.pool.shape.', AD_FORMATS)

  // The live screen says one line per campaign through t(`lm.live.sig.${id}`)
  // and buttons it through t(`lm.live.act.${action}`). A signal with no word
  // behind it ships as its own key on the busiest screen in the product.
  family('lm.live.sig', 'lm.live.sig.', SIGNAL_IDS)
  family('lm.live.act', 'lm.live.act.', SIGNAL_ACTIONS.filter((a) => a !== 'none'))

  // The creative lab names every layout, every argument, the reason each one
  // is withheld and the verdict on each recipe — four computed families off
  // four catalogs the types derive from. A layout with no word behind it is a
  // greyed-out row whose reason renders as its own key.
  family('lab.layout', 'lab.layout.', LAB_LAYOUTS)
  family('lab.angle', 'lab.angle.', LAB_ANGLES)
  family('lab.why', 'lab.why.', WITHHELD_REASONS)
  family('lab.verdict', 'lab.verdict.', RECIPE_VERDICTS)
}

console.log('\n── delivery states ──')
{
  // The campaign header and every DeliveryChip render t(`lm.delivery.${state}`)
  // — the family that answers "is it actually delivering", so a wordless
  // state blanks the one label the operator reads first. (There is also a
  // partial `lm.machine.delivery.*` set used by the Ads Machine screen with
  // its own snake_case vocabulary; this family is the one DeliveryState feeds.)
  family('lm.delivery', 'lm.delivery.', DELIVERY_STATES)
}

console.log('\n── warm audience rungs ──')
{
  // The warm panel renders t(`lm.aud.warmRung.${s.rung}`) and its blocked
  // states — from the WARM_AUDIENCES catalog, so a new rung cannot ship
  // wordless.
  family('lm.aud.warmRung', 'lm.aud.warmRung.', WARM_AUDIENCES.map((w) => w.rung), lm_audiences)
  family('lm.aud.warm.blocked', 'lm.aud.warm.blocked.', ['pixel', 'page'], lm_audiences)
}

console.log('\n── persona names ──')
{
  // The Persona Studio renders t(`lm.aud.persona.${id}.name`) per catalog
  // entry — the family that would break next time a persona is added without
  // words, exactly as noClicks broke. (.desc is not a rendered family.)
  family('lm.aud.persona.*.name', 'lm.aud.persona.', personaIds().map((id) => `${id}.name`), lm_audiences)
}

console.log('\n── ready-buyer names ──')
{
  // The launch receipt and the audiences gallery both render
  // t(`lm.aud.ready.${id}.name`) from the READY_BUYERS catalog — a computed
  // key per catalog entry, invisible to the literal audit like the rest.
  family('lm.aud.ready.*.name', 'lm.aud.ready.', READY_BUYERS.map((b) => `${b.id}.name`), lm_audiences)
}

if (failures > 0) {
  console.error(`\n${failures} computed-key rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery key the code can build has a word behind it.\n')
