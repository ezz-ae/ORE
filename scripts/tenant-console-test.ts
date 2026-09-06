/**
 * CREATE AN ACCOUNT, DESIGN IT, GO — locked.
 *
 * "i need this to be fully brandless with a dashboard external where i create
 *  account, design the ui and go."
 *
 * Everything behind it existed: `saas_tenants`, a Postgres schema created per
 * tenant, trial dates, and company/product/accent/logo on the row. What did
 * not exist was a screen. Provisioning a customer meant curling an endpoint
 * with a secret header, and changing one meant editing a production table by
 * hand — which is how control planes get damaged: not by a bad design, by
 * somebody in a hurry with psql open.
 *
 * Three rules, each with a failure that looks like nothing at the time.
 *
 *   THE ADDRESS IS NOT EDITABLE. The subdomain names the schema holding the
 *   tenant's data. Renaming it from a settings screen orphans everything they
 *   own while the row still looks healthy.
 *
 *   NULL IS NOT ZERO. A tenant with no trial date has no countdown; rendering
 *   "0 days left" says it expires today.
 *
 *   PROVISIONING CAN PARTLY FAIL. A tenant can exist with its schema unfilled,
 *   and a green tick over that is worse than the error.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { trialDaysLeft, subdomainLooksValid } from '../app/wl-admin/_tenants'
import { RESERVED_SUBDOMAINS as RESERVED } from '../lib/tenancy/reserved'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = Date.parse('2026-09-06T12:00:00Z')
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString()

console.log('\n── the trial countdown ──')
{
  check('a trial fourteen days out reads as fourteen',
    trialDaysLeft(inDays(14), NOW) === 14, String(trialDaysLeft(inDays(14), NOW)))
  check('a trial that ended reads as past', (trialDaysLeft(inDays(-3), NOW) ?? 0) < 0)

  // NULL IS NOT ZERO. "0 days left" on a tenant that has no trial says it
  // expires today, and somebody acts on that.
  check('no trial date is no countdown, not zero',
    trialDaysLeft(null, NOW) === null)
  check('…and an unparseable date is not a countdown either',
    trialDaysLeft('whenever', NOW) === null)
}

console.log('\n── the address is checked before it is claimed ──')
{
  check('a normal subdomain is fine', subdomainLooksValid('acme'))
  check('…with hyphens inside', subdomainLooksValid('acme-properties'))
  check('…and digits', subdomainLooksValid('acme2'))

  // A leading or trailing hyphen is not a valid hostname label, and the error
  // must arrive while they are typing: the subdomain cannot be changed after
  // creation, so a typo means the tenant has to be made again.
  check('a leading hyphen is refused', !subdomainLooksValid('-acme'))
  check('a trailing hyphen is refused', !subdomainLooksValid('acme-'))
  check('uppercase is refused', !subdomainLooksValid('Acme'))
  check('a dot is refused', !subdomainLooksValid('acme.co'))
  check('an empty subdomain is refused', !subdomainLooksValid(''))
  // THE RULE IS THE SERVER'S, NOT A SECOND COPY. The first version of this
  // carried its own regex — which is how a client says yes and the server
  // says no on the one field that cannot be changed afterwards.
  const ui = readFileSync(join(process.cwd(), 'app/wl-admin/_tenants.tsx'), 'utf8')
  check('the client validates with the server\'s own regex',
    /SUBDOMAIN_RE/.test(ui) && !/\/\^\[a-z0-9\]/.test(ui),
    'a second copy of the rule would drift')
  check('…and refuses a reserved name before the round trip',
    /RESERVED_SUBDOMAINS\.has/.test(ui))
  check('a reserved subdomain is refused', !subdomainLooksValid([...RESERVED][0] ?? 'www'))
}

console.log('\n── what the console will not let anybody do ──')
{
  const ui = readFileSync(join(process.cwd(), 'app/wl-admin/_tenants.tsx'), 'utf8')
  const api = readFileSync(join(process.cwd(), 'app/api/wl/tenants/route.ts'), 'utf8')
  const store = readFileSync(join(process.cwd(), 'lib/tenancy/store.ts'), 'utf8')

  // THE ONE THAT ORPHANS DATA. The subdomain names the schema.
  const editBlock = ui.slice(ui.indexOf('{isEditing &&'))
  check('the edit form has no subdomain input',
    !/setDraft\(\(d\) => \(\{ \.\.\.d, subdomain/.test(editBlock),
    'renaming a tenant would orphan its schema')
  check('…and the server ignores it too',
    !/subdomain: body\.subdomain,/.test(api) || /never itself editable/.test(api))
  check('…and the store writes neither subdomain nor schema',
    !/put\('subdomain'/.test(store) && !/put\('schema_name'/.test(store))

  // A tenant can exist with an unfilled schema. Saying so beats a green tick.
  check('a partial provision is reported, not hidden',
    /body\.provisioned === false/.test(ui))

  // The accent drives every gold token in the tenant's product; choosing it
  // blind and finding out after provisioning is a slow, costly loop.
  check('the accent is previewed in the colour itself',
    /style=\{\{ background: accent \}\}/.test(ui))

  // The brand is cached per host for a few seconds. A stale entry means
  // somebody changes their colour, does not see it, and changes it again.
  check('saving a brand clears the cached one',
    /bySubdomainCache\.delete\(sub\)/.test(store))

  // Status is a closed set; a typo must not write a state nothing understands.
  check('only the three real statuses can be written',
    /\['trial', 'active', 'suspended'\]/.test(store))
}

console.log(failures === 0
  ? '\n✅ an account is created, designed and live without anybody opening psql.'
  : `\n❌ ${failures} tenant-console guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
