/**
 * THE ASSISTANT CAN WORK THE CRM, NOT ONLY DESCRIBE IT — locked.
 *
 * "the chat need to be affective more than that its currently not that
 * affective." Reading the toolbelt says exactly what that meant.
 *
 * On ads it held twenty tools: list campaigns, read insights, pause, resume,
 * move a budget, edit an ad, build a form, launch. On the CRM — where the
 * operator spends the day, and where the complaint came from — it held ONE,
 * `crm_search_leads`, and it was read-only. So asked about a lead going cold
 * it wrote a confident paragraph and offered "Draft WhatsApp Message" and
 * "Mark as Contacted": two buttons that mapped to no capability in the
 * product, because there was nothing underneath them to map to.
 *
 * ── AND THE FIX HAD TO NOT BE A SECOND WRITE PATH ────────────────────────
 *
 * PATCH /api/freehold/crm/leads/[id] carries the broker-ownership rule, the
 * reassignment grace window, the value-rating points claim, the Ads Machine
 * bridge, the activity log and the Meta write-back. A copy of that for the
 * machine would have missed two on day one and drifted on the rest inside a
 * month — and the drift that matters is the permission check, because it is
 * the one nobody notices is gone until somebody uses it.
 *
 * So the logic moved whole into lib/freehold/crm-write.ts and BOTH callers are
 * thin. These assertions pin that: the tools exist, they act, and they cannot
 * become a way around the rules the screen enforces.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COORDINATOR_TOOLS, toolsForRole } from '../lib/freehold/coordinator-tools'
import { EDITABLE_PROJECT_FIELDS } from '../lib/freehold/content-authority'
import { LEAD_STATUSES } from '../lib/freehold/lead-stages'
import { CONTACT_CHANNELS, LEAD_WRITABLE_FIELDS } from '../lib/freehold/crm-write'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const byName = (n: string) => COORDINATOR_TOOLS.find((t) => t.name === n)
const crm = COORDINATOR_TOOLS.filter((t) => t.agent === 'crm_agent')

console.log('\n── the CRM can be worked, not only read ──')
{
  // The gap, stated as the property that was missing: an agent with no
  // destructive tool cannot change anything, however much it says it will.
  check('the crm agent has tools that ACT, not only search',
    crm.some((t) => t.destructive), crm.map((t) => t.name).join(','))

  // The two buttons that had nothing behind them.
  check('"mark as contacted" is a real tool now', !!byName('crm_log_contact'))
  check('moving a lead through the funnel is a real tool', !!byName('crm_set_lead_status'))
  check('the 0–10 value rating is a real tool', !!byName('crm_rate_lead'))
  check('assigning a lead is a real tool', !!byName('crm_assign_lead'))
  // "at high risk of going cold" was asserted with nothing behind it. This is
  // where that claim has to come from.
  check('the going-cold list is a real read, not a claim',
    !!byName('crm_overdue_followups'))
}

console.log('\n── every CRM write is confirmation-gated like the ads writes ──')
{
  for (const name of ['crm_log_contact', 'crm_set_lead_status', 'crm_rate_lead', 'crm_assign_lead']) {
    const t = byName(name)!
    check(`${name} is marked destructive`, t.destructive === true)
    // The server gate reads args.confirm; a tool that never accepts it can
    // never be confirmed, and would either always refuse or always run.
    check(`…and takes a confirm argument`, /confirm/.test(t.params), t.params)
  }
  // Reading who has gone quiet changes nothing and must not need a ceremony,
  // or nobody will let the assistant look.
  check('reading the follow-up queue is not destructive',
    byName('crm_overdue_followups')!.destructive !== true)
}

console.log('\n── the rules are not bypassable by asking the assistant ──')
{
  const tools = readFileSync(join(process.cwd(), 'lib/freehold/coordinator-tools.ts'), 'utf8')
  // ONE WRITE PATH. A tool writing its own UPDATE would skip the ownership
  // check, the grace window, the activity log and the Meta write-back.
  check('the CRM tools write through the shared lead-write path',
    /updateLead\(/.test(tools) && /logLeadContact\(/.test(tools))
  check('…and no CRM tool writes the leads table itself',
    !/UPDATE\s+freehold_site_leads/i.test(tools),
    (tools.match(/UPDATE\s+freehold_site_leads/gi) ?? []).join(','))

  // Reassignment is a decision about a person's commission, so at autonomy 2
  // it still needs a human yes — "the rules permitted it" is not "somebody
  // asked for it".
  check('reassignment still needs an explicit yes at autonomy 2',
    /L2_STILL_CONFIRM = new Set\(\['ads_resume_campaign', 'crm_assign_lead'\]\)/.test(tools))

  // The two role vocabularies differ (sales_agent/owner vs broker/ceo). An
  // unmapped role must fall to the MOST restricted one, never the least.
  check('an unmapped chat role falls back to broker, not to management',
    /SESSION_ROLE\[ctx\.role\] \?\? 'broker'/.test(tools))
  check('viewer and data_manager are mapped to broker',
    /data_manager: 'broker'/.test(tools) && /viewer: 'broker'/.test(tools))

  // A broker asking the assistant must hit the same wall as a broker pressing
  // the button.
  const write = readFileSync(join(process.cwd(), 'lib/freehold/crm-write.ts'), 'utf8')
  check('the shared path still refuses a broker reassigning a lead',
    /Brokers cannot reassign leads/.test(write))
  check('…and still refuses a broker touching somebody else\'s lead',
    /ownerKeys\.includes/.test(write))
  check('…and still asks the reassignment authority before allowing one',
    /authorizeReassign\(/.test(write))
}

console.log('\n── the route kept nothing of its own ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/crm/leads/[id]/route.ts'), 'utf8')
  check('PATCH delegates to the shared path',
    /await updateLead\(id, body, \{/.test(route))
  // If the route still built its own UPDATE, the two callers would be free to
  // drift — which is the whole reason for the move.
  check('the route no longer builds the update itself',
    !/UPDATE freehold_site_leads SET/.test(route))
  check('…and turns a refusal back into its status code',
    /return NextResponse\.json\(rest, \{ status \}\)/.test(route))

  // The side effects that make a lead update mean something. Losing any of
  // these silently is the drift a copy would have caused.
  const write = readFileSync(join(process.cwd(), 'lib/freehold/crm-write.ts'), 'utf8')
  for (const [what, re] of [
    ['the activity timeline', /logPatchActivity\(/],
    ['the Meta write-back', /reportLeadToMeta\(/],
    ['the rating points claim', /openRatingClaim\(/],
    ['the ads machine bridge', /answerLeadScore\(/],
  ] as const) {
    check(`${what} travelled with it`, re.test(write))
  }
}

console.log('\n── logging contact moves the clock, not just the timeline ──')
{
  const write = readFileSync(join(process.cwd(), 'lib/freehold/crm-write.ts'), 'utf8')
  const fn = write.slice(write.indexOf('export async function logLeadContact'))
  // A lead called this morning that still shows in the chase queue at lunch is
  // the bug this pairing prevents. last_contact_at is what the queue reads.
  check('a logged contact stamps last_contact_at',
    /last_contact_at: new Date\(\)\.toISOString\(\)/.test(fn), fn.slice(0, 300))
  // The stamp goes through updateLead, so the permission check IS the gate on
  // writing history onto somebody else's lead.
  check('…through the shared path, so ownership is checked first',
    /await updateLead\(leadId, \{ last_contact_at/.test(fn))
  check('…and a refusal logs nothing at all',
    /if \(!stamped\.ok\) return stamped/.test(fn))
}

console.log('\n── the vocabularies are walkable and agree with the database ──')
{
  // A status the tool accepts and the database rejects is a tool that reports
  // success and changes nothing.
  check('every lead status is enumerable', LEAD_STATUSES.length === 8)
  const data = readFileSync(join(process.cwd(), 'lib/data.ts'), 'utf8')
  const constraint = data.slice(data.indexOf("('new','contacted'"))
  check('…and matches the database CHECK constraint',
    LEAD_STATUSES.every((st) => constraint.slice(0, 200).includes(`'${st}'`)),
    constraint.slice(0, 140))

  check('contact channels are enumerable', CONTACT_CHANNELS.length >= 4)
  // The tools build patches from this list; a field missing from it would be
  // dropped silently and the tool would report a change that never happened.
  check('the writable fields the tools set are all on the allow-list',
    ['status', 'assigned_broker_id', 'last_contact_at'].every((f) =>
      (LEAD_WRITABLE_FIELDS as readonly string[]).includes(f)))
}

console.log('\n── brokers keep their own book ──')
{
  const t = byName('crm_overdue_followups')!
  check('everyone can read their follow-ups', t.roles.includes('sales_agent'))
  // Only management may move a lead between people.
  check('only management can reassign',
    !byName('crm_assign_lead')!.roles.includes('sales_agent'),
    byName('crm_assign_lead')!.roles.join(','))
  check('a broker still gets the acting tools for their own leads',
    toolsForRole('sales_agent').some((x) => x.name === 'crm_log_contact'))

  const tools = readFileSync(join(process.cwd(), 'lib/freehold/coordinator-tools.ts'), 'utf8')
  const q = tools.slice(tools.indexOf("name: 'crm_overdue_followups'"))
  // Scoped in SQL, not filtered after: a broker must not be able to learn
  // another broker's book from a row count.
  check('a broker\'s queue is scoped in the query itself',
    /assigned_broker_id = \$2/.test(q.slice(0, 2500)))
  // "nothing is overdue" when the read fell over is the lie most of this
  // product's guards exist to prevent.
  check('a failed read is not reported as an empty queue',
    /Could not read the follow-up queue/.test(q.slice(0, 3000)))
}

console.log('\n── the inventory can be worked too, and not destroyed ──')
{
  const inv = COORDINATOR_TOOLS.filter((t) => t.agent === 'inventory_agent')
  check('the inventory agent has tools that ACT, not only read',
    inv.some((t) => t.destructive), inv.map((t) => t.name).join(','))

  // The catalogue, enumerable. This is also the answer to describing a
  // property that does not exist: the model can look instead of guessing.
  check('the catalog can be listed, so a project need never be guessed',
    !!byName('listing_list'))
  check('a listing’s facts can be changed', !!byName('listing_update'))
  check('a listing can be taken off the site and put back', !!byName('listing_archive'))
  // The launch reads a property's expiry to set the ad set end date and the
  // Ads Machine reads it to stop a lapsed campaign. A listing with no permit
  // is an ad the compliance stop cannot stop.
  check('the Trakheesi permit can be recorded', !!byName('listing_set_permit'))

  for (const name of ['listing_update', 'listing_archive', 'listing_set_permit']) {
    check(`${name} is destructive and confirmable`,
      byName(name)!.destructive === true && /confirm/.test(byName(name)!.params))
  }
  check('listing_list is not destructive', byName('listing_list')!.destructive !== true)

  // THE LINE THE MACHINE DOES NOT CROSS. deleteProject destroys the row and
  // the landing pages attached to it, it is owner-only, and it does not come
  // back. Archiving covers the request people actually make.
  check('there is no delete tool — the irreversible act stays a human’s',
    !COORDINATOR_TOOLS.some((t) => /listing_delete|project_delete|delete_listing/.test(t.name)),
    COORDINATOR_TOOLS.map((t) => t.name).filter((n) => n.includes('delete')).join(','))

  const tools = readFileSync(join(process.cwd(), 'lib/freehold/coordinator-tools.ts'), 'utf8')
  check('…and no tool calls deleteProject at all', !/deleteProject\(/.test(tools))

  // ONE WRITE PATH, same rule as the CRM half.
  check('listing writes go through the screen’s own functions',
    /updateProject\(/.test(tools) && /archiveProject\(/.test(tools) && /setProjectPermit\(/.test(tools))
  check('…and no listing tool writes the projects table itself',
    !/UPDATE\s+freehold_site_projects/i.test(tools))

  // Identity is not editable: an edit that could reach slug/id would orphan
  // exactly the records a delete is refused for protecting.
  check('the editable-field list is the authority module’s, not a copy',
    /EDITABLE_PROJECT_FIELDS/.test(tools))
  check('…and identity is not on it',
    !(EDITABLE_PROJECT_FIELDS as readonly string[]).includes('slug')
    && !(EDITABLE_PROJECT_FIELDS as readonly string[]).includes('id'))
  // A tool that silently drops a field reports a change the user then goes
  // looking for.
  const upd = tools.slice(tools.indexOf("name: 'listing_update'"))
  check('a field it cannot change is named back, not dropped in silence',
    /rejected/.test(upd.slice(0, 2000)))

  // Content authority and lead ownership must read the same role for the same
  // person, or a role could be management to one checker and a broker to the
  // other.
  check('both authority checks read the role from one mapping',
    /const projectActor = \(ctx: ToolCtx\) => \(\{[\s\S]{0,140}SESSION_ROLE\[ctx\.role\]/.test(tools))

  // Only operators change the catalog; everyone may read it.
  check('only operators change the catalog',
    ['listing_update', 'listing_archive', 'listing_set_permit']
      .every((n) => !byName(n)!.roles.includes('sales_agent')))
  check('anyone may read it', byName('listing_list')!.roles.includes('sales_agent'))
}

console.log('\n── the permit route kept nothing of its own ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/inventory/[slug]/permit/route.ts'), 'utf8')
  check('the permit route delegates to the shared write',
    /await setProjectPermit\(slug, body\)/.test(route))
  check('…and no longer writes the payload itself',
    !/jsonb_build_object\('permitNumber'/.test(route))

  // A compliance record holding a plausible but wrong value is worse than an
  // empty one, because it reads as done and nobody looks again. That refusal
  // has to apply to a permit typed into the chat exactly as to one typed into
  // the form — which is the whole reason it moved.
  const write = readFileSync(join(process.cwd(), 'lib/freehold/inventory-write.ts'), 'utf8')
  check('an unreal permit number is refused, not stored',
    /does not look like a Trakheesi permit number/.test(write))
  check('an unreal expiry is refused, not stored',
    /must be a real date/.test(write))
  check('the state returned is the one the launch gate uses',
    /permitState\(permitNumber, permitExpiry\)/.test(write))
}

console.log('\n── the assistant is told to look before it names a property ──')
{
  const chat = readFileSync(join(process.cwd(), 'app/api/freehold/expert/chat/route.ts'), 'utf8')
  // Both prompt paths (the JSON protocol and the SDK one) carry it, or the
  // rule applies only on whichever path happens to be on that day.
  check('both prompt paths tell it to call listing_list first',
    (chat.match(/call listing_list and use a project from it/g) ?? []).length === 2,
    String((chat.match(/call listing_list/g) ?? []).length))
}

console.log(failures === 0
  ? '\n✅ the assistant can work the CRM and the catalog, through the same rules as the screens.'
  : `\n❌ ${failures} CRM/inventory tool guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
