/**
 * THE ANSWER IS CHECKED BEFORE IT IS SHOWN — locked.
 *
 * The transcript this exists for, from a live workspace:
 *
 *   "There are currently no automation rules for the Zada Tower campaign.
 *    This is why it's continued to spend despite the low lead quality score
 *    of 45… 50 leads this month… Starting from AED 699,999."
 *
 * There is no Zada Tower. The campaign, the score, the lead count and the
 * price were all produced by the model, in confident business prose, with
 * buttons under them — while the system prompt forbade every one of those in
 * capital letters.
 *
 * So these assertions are about two properties, and the second matters as much
 * as the first: the check CATCHES that transcript, and it does not fire on
 * honest answers. A verifier that cries wolf is switched off in a week, and
 * then the real lie ships.
 *
 * Pure — no model, no network. Runs in `pnpm guards`.
 */
import {
  numbersIn, groundingCorpus, ungroundedNumbers, campaignNamesClaimed,
  unknownCampaigns, verifyAnswer, GROUNDING_FAULTS, MIN_CHECKED_DIGITS,
} from '../lib/freehold/answer-grounding'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

// The real workspace, as the live account actually holds it.
const KNOWN = ['cash offer new audiences', 'Sea Legend One — Quick', 'Cash offer', 'R. Hills — Lead Gen']
const CONTEXT = {
  campaigns: [
    { name: 'cash offer new audiences', spend: 501, leads: 2, impressions: 27433 },
    { name: 'Sea Legend One — Quick', spend: 0, leads: 0 },
  ],
}

console.log('\n── the transcript that produced this module ──')
{
  const answer = `There are currently no automation rules set up for the Zada Tower campaign. `
    + `This is why it's continued to spend the budget despite the low lead quality score of 45. `
    + `Starting from AED 699,999. Book your viewing today.`
  const corpus = groundingCorpus({ context: CONTEXT, userMessage: 'Show me the automation rules for the Zada Tower campaign' })
  const v = verifyAnswer({ answer, corpus, knownCampaigns: KNOWN })

  check('the answer is refused', !v.ok, JSON.stringify(v))
  check('…because it names a campaign this workspace does not have',
    v.campaigns.includes('Zada Tower'), v.campaigns.join(','))
  check('…and because the quality score came from nowhere',
    v.numbers.includes('45'), v.numbers.join(','))
  check('…and so did the price', v.numbers.includes('699999'), v.numbers.join(','))
  check('both faults are reported, not just the first',
    v.faults.length === 2, v.faults.join(','))

  // The second half of the same transcript.
  const fifty = verifyAnswer({
    answer: 'I have searched the CRM and found 50 leads associated with the Zada Tower project.',
    corpus, knownCampaigns: KNOWN,
  })
  check('an invented lead count is caught', fifty.numbers.includes('50'), fifty.numbers.join(','))
}

console.log('\n── and it does not cry wolf ──')
{
  const corpus = groundingCorpus({ context: CONTEXT, userMessage: 'how is cash offer doing' })
  const honest = verifyAnswer({
    answer: 'cash offer new audiences has spent AED 501 and brought 2 leads from 27,433 impressions.',
    corpus, knownCampaigns: KNOWN,
  })
  check('an answer quoting the real numbers passes', honest.ok, JSON.stringify(honest))

  check('a thousands separator is the same number as without one',
    !ungroundedNumbers('27,433 impressions', groundingCorpus({ context: { n: 27433 } })).length)
  check('a currency prefix does not make a number new',
    !ungroundedNumbers('AED 501 spent', groundingCorpus({ context: { spend: 501 } })).length)
  check('a percent sign does not make a number new',
    !ungroundedNumbers('45% of spend', groundingCorpus({ context: { pct: 45 } })).length)

  check('the honest refusal passes, because it contains no figures at all',
    verifyAnswer({
      answer: "I don't have live data for that. Connect Meta Ads under Integrations and it will appear here.",
      corpus, knownCampaigns: KNOWN,
    }).ok)

  // A user who puts a number in the question has put it in the conversation.
  check('a number quoted back from the USER\'s own question is grounded',
    verifyAnswer({
      answer: 'I cannot filter to the last 24 hours.',
      corpus: groundingCorpus({ context: {}, userMessage: 'leads in the last 24 hours?' }),
      knownCampaigns: KNOWN,
    }).ok)

  check('a tool result grounds the numbers it returned',
    verifyAnswer({
      answer: 'That ad set has spent AED 93 for 946 impressions.',
      corpus: groundingCorpus({ context: {}, toolResults: [{ spend: 93, impressions: 946 }] }),
      knownCampaigns: KNOWN,
    }).ok)
}

console.log('\n── small numbers are reasoning, not claims ──')
{
  // Enforcing these produces false alarms that train people to ignore the real
  // ones. Every fabricated figure in the live transcript was two digits or more.
  check(`under ${MIN_CHECKED_DIGITS} digits is not checked`,
    numbersIn('two ad sets, 3 designs, 1 form').length === 0,
    numbersIn('two ad sets, 3 designs, 1 form').join(','))
  check('…and two digits is', numbersIn('45 leads').join(',') === '45')

  // A year is a date, and property copy is full of them.
  check('a handover year is not a metric',
    !numbersIn('handover 2027').includes('2027'), numbersIn('handover 2027').join(','))
  check('…but a price that looks like a year is still a price',
    numbersIn('AED 2,027,000').includes('2027000'))
}

console.log('\n── the campaign pattern is narrow on purpose ──')
{
  check('"the Zada Tower campaign" names Zada Tower',
    campaignNamesClaimed('the Zada Tower campaign is spending').join(',') === 'Zada Tower')
  check('the article is not part of the name',
    !campaignNamesClaimed('Your Marina Views campaign').join(',').startsWith('Your'))
  check('a lower-case mention is not a claimed name',
    campaignNamesClaimed('every campaign in the account').length === 0,
    campaignNamesClaimed('every campaign in the account').join(','))

  // Abbreviating a real campaign is not inventing one.
  check('an abbreviated real name passes',
    unknownCampaigns('the Sea Legend campaign is paused', KNOWN).length === 0,
    unknownCampaigns('the Sea Legend campaign is paused', KNOWN).join(','))
  check('…and so does a longer form of it',
    unknownCampaigns('the Cash Offer New Audiences campaign', KNOWN).length === 0)
  check('punctuation and case never decide it',
    unknownCampaigns('the "cash-offer new audiences" campaign', KNOWN).length === 0)

  // With no workspace list to check against, claim nothing rather than
  // flagging every name — an empty known-list must not fail every answer.
  check('an empty workspace list makes NO accusation',
    unknownCampaigns('the Zada Tower campaign', []).length === 0)
}

console.log('\n── the verdict is a verdict, not a rewrite ──')
{
  const v = verifyAnswer({
    answer: 'The Zada Tower campaign has 45 leads.',
    corpus: groundingCorpus({ context: CONTEXT }),
    knownCampaigns: KNOWN,
  })
  check('it reports what was wrong so the server can log it',
    v.numbers.length > 0 && v.campaigns.length > 0, JSON.stringify(v))
  check('every fault it can raise is named, or the replacement renders a blank',
    v.faults.every((f) => (GROUNDING_FAULTS as readonly string[]).includes(f)), v.faults.join(','))
  check('a clean answer reports no faults at all',
    verifyAnswer({ answer: 'Nothing to report.', corpus: new Set(), knownCampaigns: KNOWN }).faults.length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} answer-grounding rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo figure and no campaign name reaches a screen unless it came from the data.\n')
