import { redirect } from 'next/navigation'

// The quick smart-form surface lives at /presenters now (the home became the
// suite's tool grid). Old links keep working via this redirect. The _client in
// this directory stays: the presenters page imports it.
export default function QuickGenerateRedirect() {
  redirect('/freehold-intelligence/creative-studio/presenters')
}
