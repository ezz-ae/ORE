/**
 * WHETHER A LEAD CAN COME BACK — locked.
 *
 * This account has already run the failure this module exists to catch: 571
 * CRM rows reading "General enquiry", with no campaign against them, because
 * the landing URL carried no utm_id. The money was spent, the leads arrived,
 * and nothing could say which campaign bought them — while every per-campaign
 * number downstream was computed as though the attribution had worked.
 *
 * So the assertions are about the three ways this could go on being invisible:
 * reading the wrong field on an ad that has both, calling a link ours when it
 * is not, and averaging one broken live ad away behind several good ones.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  readDestination, summariseDestinations, correctedUrl, isOwnHost, taggedCampaignId,
  ATTRIBUTION_PARAM, DESTINATION_KINDS, ATTRIBUTION_STATES,
  type AdDestination,
} from '../lib/freehold/campaign-destination'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const CID = '120210000000001'
const DOMAIN = 'freeholdproperty.ae'
const OPTS = { campaignId: CID, domain: DOMAIN }

const ad = (o: Partial<AdDestination> = {}): AdDestination => ({
  adId: 'a1', adName: 'Design 1', url: null, leadFormId: null, active: true, ...o,
})
const read = (o: Partial<AdDestination> = {}) => readDestination(ad(o), OPTS)

console.log('\n── the form wins, because the form is what opens ──')
{
  // An ad can carry BOTH a form id and a link. Reading the link first would
  // report a landing page nobody ever sees and declare it unattributed, while
  // the form's own sync was attributing it perfectly.
  const both = read({ leadFormId: 'f1', url: `https://${DOMAIN}/lp/venice` })
  check('an ad with a form reads as a form, not as its link', both.kind === 'form', both.kind)
  check('…and its leads are attributed with nothing to configure',
    both.attribution === 'attributed', both.attribution)
}

console.log('\n── the parameter the whole contract hangs on ──')
{
  const tagged = read({ url: `https://${DOMAIN}/lp/venice?${ATTRIBUTION_PARAM}=${CID}` })
  check('our page carrying this campaign\'s id is attributed',
    tagged.attribution === 'attributed', tagged.attribution)

  // THE 571-ROW BUG, in one assertion.
  const bare = read({ url: `https://${DOMAIN}/lp/venice` })
  check('our page WITHOUT it is anonymous — the leads arrive with no campaign',
    bare.kind === 'landing' && bare.attribution === 'anonymous', `${bare.kind}/${bare.attribution}`)
  check('…and the fix is offered as a corrected link',
    correctedUrl(bare, CID) === `https://${DOMAIN}/lp/venice?${ATTRIBUTION_PARAM}=${CID}`,
    String(correctedUrl(bare, CID)))
  check('…while a link that is already right is offered no pointless button',
    correctedUrl(tagged, CID) === null)

  // MISTAGGED IS WORSE THAN UNTAGGED, because it looks correct. It happens
  // when somebody duplicates a working campaign and edits the budget: the
  // leads land against the ORIGINAL, so one buy reads too cheap and the other
  // reads as having produced nothing.
  const stale = read({ url: `https://${DOMAIN}/lp/venice?${ATTRIBUTION_PARAM}=999999` })
  check('another campaign\'s id is caught, not accepted',
    stale.mistagged && stale.attribution === 'anonymous', `${stale.mistagged}/${stale.attribution}`)
  check('…and the corrected link replaces it rather than appending a second',
    correctedUrl(stale, CID)?.includes('999999') === false, String(correctedUrl(stale, CID)))

  check('the id is read back out of a URL', taggedCampaignId(`https://x.com/?${ATTRIBUTION_PARAM}=abc`) === 'abc')
  check('…and an empty one is null, not an empty string',
    taggedCampaignId(`https://x.com/?${ATTRIBUTION_PARAM}=`) === null)
  check('…and unparseable input never throws', taggedCampaignId('not a url') === null)
}

console.log('\n── ours is decided on the domain, not on the string ──')
{
  check('a subdomain of ours is ours', isOwnHost(`https://lp.${DOMAIN}/x`, DOMAIN))
  check('…and www is ours', isOwnHost(`https://www.${DOMAIN}/x`, DOMAIN))
  check('…and the bare domain is ours', isOwnHost(`https://${DOMAIN}/x`, DOMAIN))

  // THE ATTACK A SUBSTRING TEST WOULD ACCEPT. It is also the honest mistake:
  // a partner microsite at `freeholdproperty.ae.partner.com` is not ours and
  // its submissions never reach this CRM.
  check('a host that merely CONTAINS our domain is not ours',
    !isOwnHost(`https://${DOMAIN}.evil.com/x`, DOMAIN))
  check('…and a look-alike is not ours', !isOwnHost('https://freeholdproperty.com/x', DOMAIN))

  const off = read({ url: `https://${DOMAIN}.evil.com/x?${ATTRIBUTION_PARAM}=${CID}` })
  check('an external page is offCrm however well-tagged it is',
    off.kind === 'external' && off.attribution === 'offCrm', `${off.kind}/${off.attribution}`)
}

console.log('\n── a conversation is a real lead this page cannot see ──')
{
  // Not scored as a failure. A WhatsApp campaign is a legitimate choice; what
  // is wrong is reading a cost-per-lead computed as though those leads were
  // being counted.
  for (const u of ['https://wa.me/9715xxxxxxx', 'https://api.whatsapp.com/send?phone=971']) {
    check(`${u.slice(8, 24)} reads as a conversation`,
      read({ url: u }).kind === 'whatsapp' && read({ url: u }).attribution === 'conversation')
  }
  check('a phone link too', read({ url: 'tel:+9715000000' }).kind === 'phone')
  check('…and neither is called unattributed, because neither was ever going to be',
    read({ url: 'tel:+9715000000' }).attribution === 'conversation')
}

console.log('\n── one broken LIVE ad is never averaged away ──')
{
  const ads: AdDestination[] = [
    ad({ adId: 'good1', leadFormId: 'f1' }),
    ad({ adId: 'good2', url: `https://${DOMAIN}/lp/a?${ATTRIBUTION_PARAM}=${CID}` }),
    ad({ adId: 'bad', url: `https://${DOMAIN}/lp/b` }),
  ]
  const s = summariseDestinations(ads, OPTS)
  check('the headline is the WORST live state, not the commonest',
    s.headline === 'anonymous', s.headline)
  check('…and it is counted', s.unattributedLive === 1, String(s.unattributedLive))

  // A PAUSED AD IS A PLAN, NOT A LEAK. Shouting about one trains people to
  // ignore the panel on the day it is about a live one.
  const paused = summariseDestinations(
    [ads[0], ads[1], { ...ads[2], active: false }], OPTS,
  )
  check('a paused broken ad does not raise the headline',
    paused.headline === 'attributed', paused.headline)
  check('…and is still reported in the list rather than hidden',
    paused.reads.some((r) => r.adId === 'bad' && r.attribution === 'anonymous'))
  check('…and not counted as a live leak', paused.unattributedLive === 0)

  const stale = summariseDestinations(
    [ad({ url: `https://${DOMAIN}/lp/b?${ATTRIBUTION_PARAM}=other` })], OPTS,
  )
  check('a mistagged live ad is counted separately, because its fix is different',
    stale.mistaggedLive === 1, String(stale.mistaggedLive))

  const none = summariseDestinations([], OPTS)
  check('a campaign with no ads is unknown, never "attributed"',
    none.headline === 'unknown', none.headline)
}

console.log('\n── every kind and state is reachable ──')
{
  const kinds = new Set<string>()
  const states = new Set<string>()
  for (const r of [
    read({ leadFormId: 'f' }),
    read({ url: `https://${DOMAIN}/lp/a?${ATTRIBUTION_PARAM}=${CID}` }),
    read({ url: `https://${DOMAIN}/lp/a` }),
    read({ url: 'https://elsewhere.com/a' }),
    read({ url: 'https://wa.me/971' }),
    read({ url: 'tel:+971' }),
    read({}),
  ]) { kinds.add(r.kind); states.add(r.attribution) }

  const mk = DESTINATION_KINDS.filter((k) => !kinds.has(k))
  const ms = ATTRIBUTION_STATES.filter((s) => !states.has(s))
  check('every destination kind can happen', mk.length === 0, mk.join(','))
  check('every attribution state can happen', ms.length === 0, ms.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} campaign-destination rule(s) broken.`)
  process.exit(1)
}
console.log('\nA campaign says where its leads go, and whether they can come back.\n')
