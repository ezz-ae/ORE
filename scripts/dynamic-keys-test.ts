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
import { ADVISOR_ACTION_TYPES } from '../lib/freehold/advisor-actions'
import { CRM_FILTERS, CRM_FILTER_GROUPS } from '../lib/freehold/crm-filters'
import { RATING_BAND_IDS } from '../lib/freehold/rating-ladder'
import { FORM_ADVICE } from '../lib/freehold/form-funnel'
import { RATING_ACTIONS } from '../lib/freehold/rating-actions'
import { CALIBRATION_VERDICTS } from '../lib/freehold/lead-forecast'
import { BUYER_ELIGIBILITIES } from '../lib/freehold/buyer-eligibility'
import { crm } from '../lib/i18n/dictionaries/crm'
import { READY_BUYERS } from '../lib/freehold/ready-buyers'
import { REQUEST_STATUSES } from '../lib/freehold/campaign-requests'
import { personaIds } from '../lib/freehold/persona-audience'
import { WARM_AUDIENCES } from '../lib/freehold/warm-audiences'
import { DELIVERY_STATES } from '../lib/meta/delivery-status'
import { GOOGLE_DELIVERY_STATES, GOOGLE_BLOCKERS } from '../lib/google/delivery'
import { COMPETITION_VERDICTS } from '../lib/google/competition'
import { AD_GROUP_KINDS, PLAN_WITHHELD } from '../lib/google/keyword-plan'
import { REC_KEYS, REC_ACTION_LABELS } from '../lib/freehold/recommendations'
import { LAUNCHABLE_PLACEMENTS } from '../lib/freehold/placement-memory'
import { AD_FORMATS } from '../lib/meta/adset-placements'
import { CONTENT_REFUSALS } from '../lib/freehold/content-authority'
import { ACTION_KEYS, ACTION_SEVERITIES } from '../lib/freehold/campaign-action'
import { PROPOSAL_KINDS, PROPOSAL_RESPONSES, PROPOSAL_STATES } from '../lib/freehold/proposal'
import { ATTRIBUTION_REFUSALS, BILLING_STARTS } from '../lib/freehold/campaign-attribution'
import { wallet } from '../lib/i18n/dictionaries/wallet'
import { SIGNAL_IDS, SIGNAL_ACTIONS } from '../lib/freehold/live-signals'
import { LAB_ANGLES, WITHHELD_REASONS, RECIPE_VERDICTS } from '../lib/freehold/creative-lab'
import { LOOP_STEPS, LOOP_STATES } from '../lib/freehold/rating-loop'
import { SEED_SIGNALS, AVOID_SIGNALS } from '../lib/freehold/seed-cohort'
import { DESTINATION_KINDS, ATTRIBUTION_STATES } from '../lib/freehold/campaign-destination'
import { READINESS_CHECKS, REACHABLE } from '../lib/freehold/launch-readiness'
import { MONEY_RUNGS, MONEY_VERDICTS } from '../lib/freehold/money-truth'
import { DAY_BLOCKS, EXPLAINED_VERDICTS } from '../lib/freehold/hour-truth'
import { SPLIT_REASONS } from '../lib/freehold/budget-split'
import { DECAY_VERDICTS } from '../lib/freehold/creative-decay'
import { CLAIM_VERDICTS } from '../lib/freehold/points'
import {
  VIEW_TEMPLATES, VIEW_COLUMNS, RISK_KINDS, VIEW_RANGES, VIEW_ACCESS, VIEW_SCHEDULES,
} from '../lib/freehold/smart-view'
import { PULSE_STATES } from '../lib/freehold/machine-activity'
import {
  ACTIVITY_STATES, BANK_REFUSALS, CASH_ORIGINS, CASH_STATES, DEPOSIT_STATES,
  SPEND_KINDS, USE_STATES,
} from '../lib/freehold/bank'
import { POSTING_KINDS } from '../lib/freehold/wallet'
import { PAYOUT_STATES } from '../lib/freehold/deal-payout'

import { wallet as walletDict } from '../lib/i18n/dictionaries/wallet'
import { lm_ads } from '../lib/i18n/dictionaries/lm_ads'
import { inventory } from '../lib/i18n/dictionaries/inventory'
import { lm_core } from '../lib/i18n/dictionaries/lm_core'
import { DELIVERY_BARS, FORECAST_REFUSALS } from '../lib/freehold/delivery-commitment'
import { COPY_ANGLES, IMAGE_STYLES } from '../lib/freehold/campaign-copy'
import { lm_audiences } from '../lib/i18n/dictionaries/lm_audiences'
import { p_ads_google } from '../lib/i18n/dictionaries/p_ads_google'

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

console.log('\n── the lead rate ladder bands ──')
{
  // The table renders t(`lm.forms.band.${row.band}`) on every row and on each
  // audience button. A band without a word is a raw key printed eleven times
  // in a table somebody is reading to decide what to buy.
  family('lm.forms.band', 'lm.forms.band.', RATING_BAND_IDS, lm_core)
  // The funnel chip renders t(`lm.forms.funnel.${advice}`) on a leaking form.
  // 'none' is excluded because it is never rendered — the chip is guarded on
  // `advice !== 'none'`, and giving it an empty string would be a dictionary
  // entry that exists only to satisfy a checker.
  family('lm.forms.funnel', 'lm.forms.funnel.',
    FORM_ADVICE.filter((a) => a !== 'none'), lm_core)
  // The Rating page renders t(`lm.rating.action.${rule.action}`) on all eleven
  // rows and t(`lm.rating.verdict.${c.verdict}`) on every calibration row. A
  // missing word there is a raw key in a table somebody reads to decide what
  // to exclude from a live campaign.
  family('lm.rating.action', 'lm.rating.action.', RATING_ACTIONS, lm_core)
  family('lm.rating.verdict', 'lm.rating.verdict.', CALIBRATION_VERDICTS, lm_core)
}

console.log('\n── the CRM smart filters ──')
{
  // The panel renders t(`crm.filter.${f.id}`) and t(`crm.filter.group.${g}`).
  // A filter without a word is a blank row in a dropdown somebody is using to
  // narrow a list — worse than a missing filter, because it looks clickable.
  family('crm.filter', 'crm.filter.', CRM_FILTERS, crm)
  family('crm.filter.group', 'crm.filter.group.', CRM_FILTER_GROUPS, crm)
}

console.log('\n── advisor action labels ──')
{
  // The Accept button renders t(`lm.cmd.advisorDo.${s.action.type}`) — the
  // label IS the promise about what pressing it does to a live campaign, so a
  // missing one would put a raw key on a button that spends money. The
  // vocabulary widened from three actions to six in one change; this is what
  // stops the seventh shipping without a word.
  check('every advisor action type is enumerable at runtime',
    Array.isArray(ADVISOR_ACTION_TYPES) && ADVISOR_ACTION_TYPES.length >= 6)
  family('lm.cmd.advisorDo', 'lm.cmd.advisorDo.', ADVISOR_ACTION_TYPES)
}

console.log('\n── setup-check findings ──')
{
  // Not derived from a type: `checkCampaignSetup` builds these keys as string
  // literals at each push site. Listed here so adding a finding without a word
  // fails the build rather than reaching a client.
  const SETUP_KEYS = [
    'noAdSets', 'adSetPaused', 'noAds', 'noLiveAd', 'noTargeting',
    'noPlace', 'place', 'manyCountries', 'visitors', 'residents',
    'noProperty', 'property', 'moneyNotProperty', 'propertyNotBinding',
    'expansion', 'noExpansion', 'expansionUnknown',
    'youngAge', 'age',
    'anyPlacement', 'offPlatform', 'loosePlacement', 'placements',
    'softGoal', 'noBudget', 'capped', 'capChoking',
  ]
  family('lm.setupCheck', 'lm.setupCheck.', SETUP_KEYS)
}

console.log('\n── attribution refusals ──')
{
  // The panel renders t(`attr.refusal.${refusal}`). Attaching a wallet decides
  // who owes money, so a refusal without a sentence is a person told "no"
  // about their own bill with no way to learn why.
  family('attr.refusal', 'attr.refusal.', [...ATTRIBUTION_REFUSALS], wallet)
  family('attr.start', 'attr.start.', [...BILLING_STARTS], wallet)
}

console.log('\n── proposals: every finding ends in a decision ──')
{
  // The panel renders t(`lm.propose.kind.${kind}`), t(`lm.propose.${response}`)
  // and t(`lm.propose.state.${state}`). A proposal whose sentence is missing
  // is a decision with no question attached — worse than the narration it
  // replaced, because it carries a button.
  family('lm.propose.kind', 'lm.propose.kind.', [...PROPOSAL_KINDS])
  family('lm.propose', 'lm.propose.', [...PROPOSAL_RESPONSES])
  family('lm.propose.state', 'lm.propose.state.', [...PROPOSAL_STATES])
}

console.log('\n── auto targeting guard: one action per campaign ──')
{
  // The guard renders t(`lm.guard.action.${key}`) and t(`lm.guard.sev.${s}`).
  // A verdict without a sentence is a verdict nobody can act on, which is the
  // entire failure mode this guard was built to replace — a list instead of an
  // instruction.
  family('lm.guard.action', 'lm.guard.action.', [...ACTION_KEYS])
  family('lm.guard.sev', 'lm.guard.sev.', [...ACTION_SEVERITIES])
}

console.log('\n── content-admin refusals ──')
{
  // The manage panel renders t(`inv.manage.refusal.${refusal}`). Derived from
  // the walkable const so a new way to refuse a delete cannot ship without the
  // sentence that tells the person what to do instead — which is the whole
  // point of the refusal.
  // The fourth argument matters: family() defaults to lm_ads, and a family
  // living in another dictionary reports every member missing if it is not
  // passed — a true failure about the wrong thing.
  family('inv.manage.refusal', 'inv.manage.refusal.', [...CONTENT_REFUSALS], inventory)
}

console.log('\n── geo delivery findings ──')
{
  family('lm.geo', 'lm.geo.', ['onTarget', 'strayed'])
}

console.log('\n── campaign-request statuses ──')
{
  // Broker screen and fulfilment queue both render t(`creq.status.${s}`).
  family('creq.status', 'creq.status.', REQUEST_STATUSES)

  // The buyer's eligibility answer renders as t(`crm.eligibility.${v}`) on the
  // lead page — a computed family, so it is enumerated here from the walkable
  // const the classifier owns.
  family('crm.eligibility', 'crm.eligibility.', BUYER_ELIGIBILITIES, crm)
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
  // NOT lab.layout.*: the lab shows each design as a RENDER rather than as a
  // name, which is the whole point of the rebuild — "payBands" meant nothing
  // to anyone who had not written it.
  family('lab.angle', 'lab.angle.', LAB_ANGLES)
  family('lab.why', 'lab.why.', WITHHELD_REASONS)
  family('lab.verdict', 'lab.verdict.', RECIPE_VERDICTS)

  // The rating-loop widget renders t(`loop.step.${id}`) and — the wide one —
  // t(`loop.said.${id}.${state}`), a sentence per step PER STATE. Sixteen
  // computed keys off two catalogs; one missing renders as its own key on the
  // screen that tells a team whether their ten seconds a lead is working.
  family('loop.step', 'loop.step.', LOOP_STEPS)
  family('loop.said', 'loop.said.', LOOP_STEPS.flatMap((id) => LOOP_STATES.map((st) => `${id}.${st}`)))

  // …and the makeup line under the seeded step: t(`loop.sig.${signal}`) for
  // every reason a person is in a cohort. This is the half that proves the
  // seed is not just the rating column reshaped, so a wordless signal breaks
  // the exact claim the line exists to make.
  family('loop.sig', 'loop.sig.', [...SEED_SIGNALS, ...AVOID_SIGNALS])

  // The campaign page's "where the leads go" card renders three computed
  // families: the destination kind, the per-row sentence, and the headline
  // sentence. The headline is the one that says a campaign's cost per lead is
  // wrong — a missing word there prints a key where the warning should be.
  family('dest.kind', 'dest.kind.', DESTINATION_KINDS)
  family('dest.row', 'dest.row.', ATTRIBUTION_STATES)
  family('dest.said', 'dest.said.', ATTRIBUTION_STATES)

  // The launcher's readiness strip: a label per check, and a sentence per
  // check PER STATE — but only the states each check can actually reach, and
  // never 'ok', which needs no sentence. Walking the full 8x4 cross product
  // would demand two dozen strings that can never appear, and dead copy is
  // how a dictionary stops being trustworthy.
  // The hub badge renders t(`lm.pulse.state.${state}`). It used to print
  // "1 running" from the switch beside "0 live campaigns · AED 0"; a wordless
  // state here would blank the first thing anybody reads on that page.
  family('lm.pulse.state', 'lm.pulse.state.', PULSE_STATES, lm_core)

  // The money ladder renders three computed families: the verdict sentence,
  // the rung's word (which appears INSIDE that sentence and on every bar), and
  // the ladder steps. A missing rung word prints a raw key in the middle of a
  // sentence about somebody's money.
  // The hour report: a word per block, and a sentence per verdict EXCEPT
  // 'even'. A missing block word blanks a bar label; a missing verdict
  // sentence prints a key where the instruction should be, and the two
  // instructions here are opposite ("stop buying this hour" vs "cover it").
  // The budget split: a reason per row. Each one is a different instruction —
  // "stop this" and "held on purpose" are opposite actions — so a missing word
  // here prints a key where the decision should be.
  // Smart views: the question, its one-liner, every column header, and every
  // risk badge. A missing column header blanks a table heading; a missing
  // question blanks the card somebody is choosing between.
  // Is this design still working. The two verdicts that render have OPPOSITE
  // fixes — a new picture, or leave the picture alone and look at the audience
  // — so a missing word here prints a key where the instruction should be.
  family('lm.designs.decay', 'lm.designs.decay.', DECAY_VERDICTS.filter((v) => v !== 'fresh' && v !== 'tooEarly'))

  // The broker's points page shows EVERY verdict, including the ones that paid
  // nothing — a missing word there leaves a raw key on somebody's payout
  // screen, which is the screen they will trust least to begin with.
  family('points.verdict', 'points.verdict.', CLAIM_VERDICTS)
  family('points.why', 'points.why.', CLAIM_VERDICTS)

  family('sv.q', 'sv.q.', VIEW_TEMPLATES)
  family('sv.qsub', 'sv.qsub.', VIEW_TEMPLATES)
  family('sv.col', 'sv.col.', VIEW_COLUMNS)
  family('sv.risk', 'sv.risk.', RISK_KINDS)
  family('sv.range', 'sv.range.', VIEW_RANGES)
  family('sv.access', 'sv.access.', VIEW_ACCESS)
  family('sv.sched', 'sv.sched.', VIEW_SCHEDULES)

  family('split.why', 'split.why.', SPLIT_REASONS)

  family('hours.block', 'hours.block.', DAY_BLOCKS)
  family('hours.why', 'hours.why.', EXPLAINED_VERDICTS)

  family('money.said', 'money.said.', MONEY_VERDICTS)
  family('money.rung', 'money.rung.', MONEY_RUNGS)
  family('money.step', 'money.step.', ['spend', 'leads', 'qualified', 'deals', 'revenue'])

  family('ready.check', 'ready.check.', READINESS_CHECKS)
  family('ready.said', 'ready.said.',
    READINESS_CHECKS.flatMap((c) => REACHABLE[c].map((st) => `${c}.${st}`)))
}

console.log('\n── delivery states ──')
{
  // The campaign header and every DeliveryChip render t(`lm.delivery.${state}`)
  // — the family that answers "is it actually delivering", so a wordless
  // state blanks the one label the operator reads first. (There is also a
  // partial `lm.machine.delivery.*` set used by the Ads Machine screen with
  // its own snake_case vocabulary; this family is the one DeliveryState feeds.)
  family('lm.delivery', 'lm.delivery.', DELIVERY_STATES)

  // Google's own two families, off the same kind of walkable catalog. The
  // chip renders t(`gdel.state.${state}`) and t(`gdel.block.${blocker}`) — a
  // wordless blocker is a link labelled with its own key, sitting on the badge
  // that tells an operator why a live campaign is not running.
  family('gdel.state', 'gdel.state.', GOOGLE_DELIVERY_STATES, p_ads_google)
  family('gdel.block', 'gdel.block.', GOOGLE_BLOCKERS, p_ads_google)

  // The auction panel renders t(`gcomp.verdict.${v}`) — the sentence that
  // names WHICH lever to pull. A missing one prints its own key in the place
  // where the product either saves the budget or wastes it.
  family('gcomp.verdict', 'gcomp.verdict.', COMPETITION_VERDICTS, p_ads_google)

  // The keyword plan names every ad group it built — t(`gkw.kind.${kind}`) —
  // and every group it did NOT, with the reason: t(`gkw.why.${why}`). The
  // second family is the one that matters: a wordless reason turns "one blank
  // field away from being bought" into a line of punctuation.
  family('gkw.kind', 'gkw.kind.', AD_GROUP_KINDS, p_ads_google)
  family('gkw.why', 'gkw.why.', PLAN_WITHHELD, p_ads_google)
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

console.log('\n── the wallet and the bank ──')
{
  // EVERY ONE OF THESE IS RENDERED THROUGH A COMPUTED KEY on the wallet screen,
  // and every list is a walkable `const` the type is derived from — so a new
  // spend kind or a new refusal cannot ship wordless the way `noClicks` did.
  //
  //   t(`wal.kind.${m.kind}`)          t(`bank.origin.${lot.origin}`)
  //   t(`wal.no.${code}`)              t(`bank.state.${lot.state}`)
  //   t(`bank.kind.${w.kind}`)         t(`bank.use.state.${u.state}`)
  //   t(`bank.deposit.${lot.deposit}`)
  //
  // A refusal rendering as `wal.no.notYourCheque` would be worse here than
  // anywhere else in the product: it appears at the exact moment somebody is
  // being told they may not move money, which is when they least need a riddle.
  // `deposit` is not a POSTING kind — a recorded claim has no posting, which
  // is the whole point of it — but the activity feed renders a row for one, so
  // the word has to exist alongside the eight real ones.
  family('wal.kind', 'wal.kind.', [...POSTING_KINDS, 'deposit'], walletDict)
  family('wal.state', 'wal.state.', ACTIVITY_STATES, walletDict)
  family('wal.no', 'wal.no.', [...BANK_REFUSALS, 'notEnough', 'noSuchLot', 'error'], walletDict)
  family('bank.origin', 'bank.origin.', CASH_ORIGINS, walletDict)
  family('bank.state', 'bank.state.', CASH_STATES, walletDict)
  family('bank.deposit', 'bank.deposit.', DEPOSIT_STATES, walletDict)
  family('bank.kind', 'bank.kind.', SPEND_KINDS, walletDict)
  family('bank.use.state', 'bank.use.state.', USE_STATES, walletDict)
  // The commission panel renders t(`wal.comm.state.${c.state}`) per deal.
  family('wal.comm.state', 'wal.comm.state.', PAYOUT_STATES, walletDict)
}

console.log('\n── Rocket writes the ad with you ──')
{
  // The angle chips and the picture styles are rendered through computed keys.
  // A member added to either union and not translated shows as its own key on
  // the screen somebody launches from.
  family('lm.quick.write.angle', 'lm.quick.write.angle.', COPY_ANGLES, lm_core)
  family('lm.quick.gen.style', 'lm.quick.gen.style.', IMAGE_STYLES, lm_core)
}

console.log('\n── the delivery promise ──')
{
  // The panel renders THREE computed families: the bar's own word, the
  // sentence under the count, and the named refusal when a forecast cannot
  // honestly be given. A missing member here renders as the raw key on the one
  // screen that decides whether this account gets paid this month.
  family('promise.bar', 'promise.bar.', DELIVERY_BARS, lm_core)
  family('promise.said', 'promise.said.', DELIVERY_BARS, lm_core)
  // Walked from the union in the pure module rather than typed out, so a
  // refusal added there cannot reach the screen unreadable.
  family('promise.cannot', 'promise.cannot.', FORECAST_REFUSALS, lm_core)
}

if (failures > 0) {
  console.error(`\n${failures} computed-key rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery key the code can build has a word behind it.\n')
