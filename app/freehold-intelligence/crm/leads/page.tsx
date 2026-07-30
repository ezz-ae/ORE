import { redirect } from 'next/navigation'

// The leads index merged into the CRM home — one surface for the pipeline.
// Lead DETAIL routes (/crm/leads/[id]/…) are untouched and stay canonical.
export default function CrmLeadsIndex() {
  redirect('/freehold-intelligence/crm')
}
