/**
 * NOTHING IS DELETED OUT FROM UNDER A PERSON — locked.
 *
 * Before this module, the content APIs could create and read and nothing else.
 * Removing one project from the public site meant opening the production
 * database and writing the statement by hand. That is not a strict permission
 * model — it is no permission model: anyone holding the credentials could
 * delete anything, anyone else could delete nothing, and neither case left a
 * record of who did it or what was attached to it.
 *
 * The rules that replaced it come down to one sentence: a listing is not only
 * a listing. Leads point at it by slug, deals point at it by slug, campaigns
 * point at it by slug. Destroying it does not tidy the site — it strands a
 * real enquiry from a real person, and a broker's commission record, against a
 * name that no longer resolves. So the hard delete is refused and ARCHIVE is
 * offered instead, which is what "take it off the website" almost always meant
 * anyway.
 *
 * Pure — no database, no session, no network. Runs in `pnpm guards`.
 */
import {
  CONTENT_ACTIONS, CONTENT_REFUSALS, EDITABLE_PROJECT_FIELDS,
  EDITABLE_DEVELOPER_FIELDS, UNLISTED_STATUSES,
  mayDeleteProject, mayDeleteDeveloper, mayArchiveProject, mayDestroy, mayEdit, isListed,
  type ProjectAttachments,
} from '../lib/freehold/content-authority'
import type { Role } from '../lib/freehold/session-types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const clean: ProjectAttachments = { leads: 0, deals: 0, campaigns: 0, landingPages: 0 }
const withCounts = (p: Partial<ProjectAttachments>): ProjectAttachments => ({ ...clean, ...p })

console.log('\n── a listing that somebody enquired about is never destroyed ──')
{
  // THE WHOLE POINT. A lead belongs to a person, not to the listing. Deleting
  // the project leaves the lead in its table pointing at a slug that resolves
  // to nothing — present, unreadable, and unattributable to any project.
  const v = mayDeleteProject('ceo', withCounts({ leads: 1 }))
  check('a project with a lead cannot be hard deleted', !v.allowed, JSON.stringify(v))
  check('…and the refusal names the lead, not something vaguer', v.refusal === 'has_leads', String(v.refusal))
  // A REFUSAL WITH NOWHERE TO GO is what sent people to the database in the
  // first place. The reversible act has to be offered in the same breath.
  check('…and archiving is offered in its place', v.archiveInstead === true)

  const deals = mayDeleteProject('ceo', withCounts({ deals: 1 }))
  check('a project carrying a deal cannot be hard deleted either',
    !deals.allowed && deals.refusal === 'has_deals', JSON.stringify(deals))
  check('…because a commission record is somebody\'s money', deals.archiveInstead === true)

  const campaigns = mayDeleteProject('ceo', withCounts({ campaigns: 3 }))
  check('nor one that ads have been run against',
    !campaigns.allowed && campaigns.refusal === 'has_campaigns', JSON.stringify(campaigns))

  // …AND THE REFUSALS ARE ORDERED BY WHAT A PERSON WOULD CARE ABOUT.
  const all = mayDeleteProject('ceo', withCounts({ leads: 2, deals: 1, campaigns: 5 }))
  check('when several apply, the lead is the one named',
    all.refusal === 'has_leads', String(all.refusal))
}

console.log('\n── and one nobody ever touched can be removed properly ──')
{
  const v = mayDeleteProject('ceo', clean)
  check('a listing with nothing pointing at it is deletable', v.allowed, JSON.stringify(v))

  // Landing pages belong to the project. They carry no third party's record,
  // so they travel with it rather than blocking it — otherwise every project
  // this product generated a page for would be undeletable forever.
  const withPages = mayDeleteProject('ceo', withCounts({ landingPages: 4 }))
  check('a landing page does not block the delete — it belongs to the project',
    withPages.allowed, JSON.stringify(withPages))
}

console.log('\n── destroying takes more authority than editing ──')
{
  // Editing and archiving are reversible; a hard delete is not. The split is
  // about who answers for an irreversible act, not about who is trusted.
  check('management may destroy', mayDestroy('ceo') && mayDestroy('director') && mayDestroy('admin'))
  check('marketing may not destroy', !mayDestroy('marketing'))
  check('…but marketing may edit and archive',
    mayEdit('marketing') && mayArchiveProject('marketing').allowed)
  check('a broker may do neither',
    !mayDestroy('broker') && !mayEdit('broker') && !mayArchiveProject('broker').allowed)

  // A ROLE REFUSAL STILL POINTS SOMEWHERE. Marketing asking to delete is told
  // it cannot, and told what it CAN do, in the same answer.
  const m = mayDeleteProject('marketing', clean)
  check('marketing is refused the delete but offered the archive',
    !m.allowed && m.refusal === 'insufficient_role' && m.archiveInstead === true, JSON.stringify(m))
  const b = mayDeleteProject('broker', clean)
  check('…while a broker is offered nothing, because it holds nothing',
    !b.allowed && b.archiveInstead === false, JSON.stringify(b))
}

console.log('\n── a developer never outlives its listings ──')
{
  const held = mayDeleteDeveloper('ceo', 2)
  check('a developer that still owns projects cannot be deleted',
    !held.allowed && held.refusal === 'has_projects', JSON.stringify(held))
  check('…and one that owns none can', mayDeleteDeveloper('ceo', 0).allowed)
  check('…and it still takes management', !mayDeleteDeveloper('marketing', 0).allowed)
}

console.log('\n── an edit cannot orphan what a delete is refused for ──')
{
  // The editable list is an ALLOW-list. If a PATCH could reach `slug`, renaming
  // a project would strand every lead, deal and campaign pointing at the old
  // one — silently doing the exact damage the delete refusals exist to stop.
  const fields = EDITABLE_PROJECT_FIELDS as readonly string[]
  for (const forbidden of ['id', 'slug', 'payload', 'developer_id', 'created_at']) {
    check(`\`${forbidden}\` is not editable`, !fields.includes(forbidden))
  }
  check('the presentation fields ARE editable',
    fields.includes('name') && fields.includes('status') && fields.includes('featured'))

  const dev = EDITABLE_DEVELOPER_FIELDS as readonly string[]
  check('a developer\'s slug and id are not editable either',
    !dev.includes('slug') && !dev.includes('id'), dev.join(','))
  check('…but its display name is, since that is the point', dev.includes('name'))
}

console.log('\n── the vocabulary is walkable, so nothing ships wordless ──')
{
  check('every action is distinct', new Set(CONTENT_ACTIONS).size === CONTENT_ACTIONS.length)
  check('every refusal is distinct', new Set(CONTENT_REFUSALS).size === CONTENT_REFUSALS.length)
  check('there is an action for taking it down and one for putting it back',
    (CONTENT_ACTIONS as readonly string[]).includes('project.archive')
      && (CONTENT_ACTIONS as readonly string[]).includes('project.restore'))

  // The scraper's own sold-out marker means the same thing to a visitor as our
  // archive does, so both count as off the site — reading only our own would
  // show a sold-out listing as live.
  check('archived is not listed', !isListed('archived'))
  check('…and neither is the scraper\'s sold-out marker', !isListed('might_be_sold_out'))
  check('…while a selling project is', isListed('selling'))
  check('…and an unknown status is treated as live, not hidden', isListed('something_new'))
  check('both unlisted statuses are declared', UNLISTED_STATUSES.length === 2)
}

console.log('\n── every role in the system gets a defined answer ──')
{
  // No role may fall through to `undefined` — an unhandled role that reads as
  // falsy is an accidental permission model.
  const ROLES: Role[] = ['broker', 'admin', 'sales_manager', 'director', 'ceo', 'marketing', 'team_leader']
  for (const r of ROLES) {
    const v = mayDeleteProject(r, clean)
    check(`\`${r}\` gets a boolean verdict with a reason when refused`,
      typeof v.allowed === 'boolean' && (v.allowed || !!v.refusal), JSON.stringify(v))
  }
  check('a team leader cannot destroy listings', !mayDestroy('team_leader'))
}

if (failures > 0) {
  console.error(`\n${failures} content rule(s) broken.`)
  console.error('A delete that strands somebody\'s enquiry is not a tidy-up.')
  process.exit(1)
}
console.log('\nNothing is destroyed that somebody else\'s record points at.\n')
