/**
 * THE FRONT DOOR OF THE COMPANY WAS SELLING APARTMENTS — locked.
 *
 * One deployment answers on three kinds of host: a tenant's instance, the
 * vendor's apex, and the reserved product doors. Only the first was ever
 * routed. The other two fell through to the property-marketing site that
 * ships in this codebase, so a visitor to entrestate.com — and to
 * machine.entrestate.com, the address printed on the business card — was met
 * with a Dubai property portal: Golden Visa, off-plan, featured listings.
 *
 * The rule is small and the cost of it silently reverting is the whole
 * funnel, so it is asserted here rather than trusted.
 *
 * Pure — no server. Runs in `pnpm guards`.
 *
 * The imports are dynamic and the work is inside main(): lib/tenancy/config
 * reads NEXT_PUBLIC_TENANT_BASE_DOMAIN once at module load, so the variable
 * has to be set before the module is first evaluated, and cleared before the
 * second copy is loaded for the switched-off case.
 */

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const show = (a: unknown) => JSON.stringify(a)

async function main(): Promise<void> {
  process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN = 'entrestate.com'
  const { vendorHostAction, PRODUCT_DOORS } = await import('../lib/tenancy/vendor-host')

  console.log('\n── the apex is the platform site, not a property portal ──')
  {
    const root = vendorHostAction('entrestate.com', '/')
    check('entrestate.com/ goes to the platform site',
      root.kind === 'redirect' && root.to === '/business', show(root))

    const www = vendorHostAction('www.entrestate.com', '/')
    check('www does the same', www.kind === 'redirect' && www.to === '/business', show(www))

    check('a port does not defeat it',
      vendorHostAction('entrestate.com:3000', '/').kind === 'redirect')
    check('neither does casing',
      vendorHostAction('EntreState.COM', '/').kind === 'redirect')
  }

  console.log('\n── the property site is not served on a vendor host ──')
  for (const p of ['/projects', '/areas/dubai-marina', '/developers', '/blog', '/tools', '/chat', '/lp/some-tower', '/market']) {
    const a = vendorHostAction('entrestate.com', p)
    check(`${p} → the platform site`, a.kind === 'redirect' && a.to === '/business', show(a))
  }

  console.log('\n── the vendor surface itself passes untouched ──')
  {
    for (const p of ['/business', '/business/pricing', '/signup', '/server', '/privacy', '/terms', '/api/wl/signup']) {
      check(`${p} is left alone`, vendorHostAction('entrestate.com', p).kind === 'pass')
    }
    // An operator must be able to reach the application to run the platform.
    for (const p of ['/freehold-intelligence', '/freehold-intelligence/crm', '/crm']) {
      check(`${p} stays reachable for the operator`, vendorHostAction('entrestate.com', p).kind === 'pass')
    }
    check('files are never treated as page routes',
      vendorHostAction('entrestate.com', '/og-image.png').kind === 'pass')
  }

  console.log('\n── product doors keep their short address ──')
  {
    const machine = vendorHostAction('machine.entrestate.com', '/')
    check('machine. serves Lead Machine without changing the address',
      machine.kind === 'rewrite' && machine.to === '/business/lead-machine', show(machine))

    const meta = vendorHostAction('meta.entrestate.com', '/')
    check('meta. serves Meta for Realtors',
      meta.kind === 'rewrite' && meta.to === '/business/meta-for-realtors', show(meta))

    const listing = vendorHostAction('listing.entrestate.com', '/')
    check('listing. serves Listing-to-Landing',
      listing.kind === 'rewrite' && listing.to === '/business/listing-to-landing', show(listing))

    check('every door points at a page under /business',
      Object.values(PRODUCT_DOORS).every((p) => p.startsWith('/business/')), show(PRODUCT_DOORS))

    // A door is only a front page. Deeper paths follow the ordinary rules, so
    // a door cannot become a second, uncanonical copy of the whole site.
    const deep = vendorHostAction('machine.entrestate.com', '/projects')
    check('a door does not mirror the property site either',
      deep.kind === 'redirect' && deep.to === '/business', show(deep))
  }

  console.log('\n── a tenant instance is never touched by these rules ──')
  for (const p of ['/', '/projects', '/lp/some-tower', '/freehold-intelligence']) {
    check(`skyline.entrestate.com${p} passes to the tenancy rules`,
      vendorHostAction('skyline.entrestate.com', p).kind === 'pass')
  }

  console.log('\n── unrelated hosts pass ──')
  {
    // Preview deployments and custom domains are not the vendor's hosts and
    // must not be rewritten to a page the visitor did not ask for.
    for (const h of ['entrestate-abc123.vercel.app', 'freeholdproperty.ae', 'localhost:3000', 'a.b.entrestate.com']) {
      check(`${h} is left alone`, vendorHostAction(h, '/').kind === 'pass')
    }
    check('a missing host is left alone', vendorHostAction(null, '/').kind === 'pass')
  }

  console.log('\n── switched off, it does nothing at all ──')
  {
    // The Freehold deployment leaves the base domain unset. Proven by loading
    // a second, isolated copy of the module with the variable cleared.
    delete process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN
    const fresh = (await import(
      `../lib/tenancy/vendor-host?off=${Date.now()}`
    )) as typeof import('../lib/tenancy/vendor-host')
    for (const p of ['/', '/projects', '/blog']) {
      check(`with tenancy off, ${p} is untouched`, fresh.vendorHostAction('freeholdproperty.ae', p).kind === 'pass')
    }
  }

  console.log(
    failures === 0
      ? '\nThe vendor’s own front door shows the vendor’s own product.\n'
      : `\n${failures} failure(s).\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

void main()
