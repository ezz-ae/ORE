/**
 * THE AD SET IS TOLD TO BUY QUALIFIED LEADS, OR TOLD WHY NOT — locked.
 *
 * capi.ts has been sending Meta a QualifiedLead for every lead a broker
 * qualifies, and createAdSet has been writing `custom_event_type: 'LEAD'`, so
 * the strongest signal this account owns was received and bid on by nothing.
 *
 * The switch is not free — an account that moves to an event it produces ten
 * of a week gets ad sets that never leave learning — so every assertion here
 * defends the GATE as hard as the switch.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  chooseQualifiedGoal, isPixelOptimised, QUALIFIED_GOALS, QUALIFIED_GOAL_REASONS,
  PIXEL_OPTIMISED_GOALS,
} from '../lib/meta/qualified-goal'
import { LEARNING_EVENTS, LEARNING_WINDOW_DAYS } from '../lib/freehold/learning-phase'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ask = (over: Partial<Parameters<typeof chooseQualifiedGoal>[0]> = {}) =>
  chooseQualifiedGoal({
    conversionId: 'cc1', optimizationGoal: 'OFFSITE_CONVERSIONS',
    qualifiedInWindow: 400, windowDays: 28, arms: 1, ...over,
  })

console.log('\n── only a pixel goal can carry a conversion ──')
{
  check('OFFSITE_CONVERSIONS can', isPixelOptimised('OFFSITE_CONVERSIONS'))
  check('an instant form cannot — it is promoted through the Page',
    !isPixelOptimised('LEAD_GENERATION'))
  check('a call ad cannot', !isPixelOptimised('QUALITY_CALL'))
  check('clicks and views cannot',
    !isPixelOptimised('LINK_CLICKS') && !isPixelOptimised('LANDING_PAGE_VIEWS'))
  check('the allowed list is stated, not inferred, so a new Meta goal is excluded until read',
    PIXEL_OPTIMISED_GOALS.length >= 1)
  check('an instant-form launch is refused with its own reason',
    ask({ optimizationGoal: 'LEAD_GENERATION' }).reason === 'notAPixelGoal')
}

console.log('\n── the gate refuses more often than it allows ──')
{
  check('no conversion object ⇒ keep buying leads',
    ask({ conversionId: null }).goal === 'lead' && ask({ conversionId: null }).reason === 'noConversion')
  check('nothing ever reported is its own answer, not "a bit short"',
    ask({ qualifiedInWindow: 0 }).reason === 'noneReported')
  check('…and it reports zero rather than null, because zero is what was measured',
    ask({ qualifiedInWindow: 0 }).perArmPerWeek === 0)
  check('a nonsense window refuses', ask({ windowDays: 0 }).goal === 'lead')

  const thin = ask({ qualifiedInWindow: 20 })
  check('twenty in four weeks cannot sustain the learning floor',
    thin.goal === 'lead' && thin.reason === 'tooFewToLearn', JSON.stringify(thin))
  check('…and it says how far short it is rather than just refusing',
    typeof thin.perArmPerWeek === 'number' && thin.perArmPerWeek! < thin.neededPerWeek)
  check('the floor it quotes is the platform one, not a local invention',
    thin.neededPerWeek === LEARNING_EVENTS)

  const plenty = ask({ qualifiedInWindow: 400 })
  check('four hundred in four weeks clears it',
    plenty.goal === 'qualified' && plenty.reason === 'learnable', JSON.stringify(plenty))
}

console.log('\n── the arms divide it, because the floor is per ad set ──')
{
  const one = ask({ qualifiedInWindow: 300, arms: 1 })
  check('one arm on 300/28d is learnable', one.goal === 'qualified', JSON.stringify(one))
  const many = ask({ qualifiedInWindow: 300, arms: 6 })
  check('the SAME account splitting across six arms clears it on none of them',
    many.goal === 'lead' && many.reason === 'tooFewToLearn', JSON.stringify(many))
  check('…and the number reported is per arm, not the account total',
    many.perArmPerWeek! < one.perArmPerWeek!)
  check('a zero or negative arm count is read as one, never as a division by zero',
    Number.isFinite(ask({ arms: 0 }).perArmPerWeek!) && ask({ arms: 0 }).goal === ask({ arms: 1 }).goal)
}

console.log('\n── the bound, never the average ──')
{
  // The average of 60 over 28 days is 15/week — over LEARNING_EVENTS/2 but the
  // interval on 60 observations still reaches below the floor, and a decision
  // that moves every ad set in the account may not ride on the point estimate.
  const avg = (n: number, days: number) => (n / days) * LEARNING_WINDOW_DAYS
  // 220 over 28 days averages 55/week — clear of the floor — while the bound
  // on 220 observations is 48. Four times the evidence at the SAME rate moves
  // the bound to 51 and the answer flips, which is the gate loosening itself.
  const borderline = 220
  const r = ask({ qualifiedInWindow: borderline })
  check('a sample whose AVERAGE clears the floor but whose bound does not is refused',
    avg(borderline, 28) >= LEARNING_EVENTS && r.goal === 'lead',
    `avg=${avg(borderline, 28).toFixed(1)} bound=${r.perArmPerWeek?.toFixed(1)} needed=${r.neededPerWeek}`)
  check('…and the bound it used is strictly below the average it did not',
    r.perArmPerWeek! < avg(borderline, 28))
  check('more evidence tightens it until the same rate passes',
    ask({ qualifiedInWindow: borderline * 4, windowDays: 112 }).goal === 'qualified')
}

console.log('\n── the launch actually sends it ──')
{
  const client = readFileSync(join(process.cwd(), 'lib/meta/client.ts'), { encoding: 'utf8' })
  check('a conversion id becomes custom_conversion_id on promoted_object',
    /custom_conversion_id: params\.qualifiedConversionId/.test(client))
  // MUTUALLY EXCLUSIVE. Graph rejects promoted_object carrying both, so the
  // enum must be the else branch and not merely overwritten.
  const block = client.slice(client.indexOf('body.promoted_object = params.qualifiedConversionId'))
    .slice(0, 400)
  check('…and the LEAD enum is the alternative, never sent alongside it',
    /\?\s*\{ pixel_id: pixelId, custom_conversion_id/.test(block) && /:\s*\{/.test(block), block.slice(0, 160))
  check('launchFullCampaign passes it to every ad set it creates',
    (client.match(/qualifiedConversionId: params\.qualifiedConversionId/g) ?? []).length >= 2,
    String((client.match(/qualifiedConversionId: params\.qualifiedConversionId/g) ?? []).length))

  const route = readFileSync(join(process.cwd(), 'app/api/meta/launch/route.ts'), { encoding: 'utf8' })
  check('the launch route asks before it launches', /readQualifiedGoal\(/.test(route))
  check('…counts the arms this launch will create', /armsForLaunch/.test(route))
  check('…and a failed read falls back to the unchanged behaviour rather than blocking a launch',
    /readQualifiedGoal\([\s\S]{0,400}?\.catch\(/.test(route))

  const db = readFileSync(join(process.cwd(), 'lib/meta/qualified-goal-db.ts'), { encoding: 'utf8' })
  check('the conversion is never created mid-launch, only found',
    !/createCustomConversion/.test(db))
  check('the count is of what Meta was SENT, not what the CRM believes',
    /meta_reported_stages/.test(db))
}

console.log('\n── walkable ──')
{
  check('goals are walkable', QUALIFIED_GOALS.length === 2)
  check('every reason is reachable', QUALIFIED_GOAL_REASONS.length === 5)
  const seen = new Set([
    ask({ optimizationGoal: 'LEAD_GENERATION' }).reason,
    ask({ conversionId: null }).reason,
    ask({ qualifiedInWindow: 0 }).reason,
    ask({ qualifiedInWindow: 20 }).reason,
    ask().reason,
  ])
  check('and all five are produced by real inputs', seen.size === QUALIFIED_GOAL_REASONS.length,
    [...seen].join(','))
}

if (failures > 0) {
  console.error(`\n${failures} qualified-goal guard(s) broken.`)
  process.exit(1)
}
console.log('\nThe auction buys qualified leads, or is told why it cannot.\n')
