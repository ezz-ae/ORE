'use client'

/**
 * CRM view preferences — one `crmView` key in account memory shared by the
 * CRM surfaces (overview stage filter + search, leads list filters, reports
 * date range). Loaded once per page mount, saved debounced on change.
 */

import { loadAccountMemory, saveAccountMemoryDebounced } from '@/lib/freehold/account-memory'

export type CrmViewPrefs = {
  overviewStage?: string
  overviewSearch?: string
  leadsStage?: string
  leadsAgent?: string
  leadsLanding?: string
  leadsSearch?: string
  reportsRange?: string
}

export async function loadCrmView(): Promise<CrmViewPrefs> {
  const memory = await loadAccountMemory()
  const v = memory.crmView
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as CrmViewPrefs) : {}
}

/** Merge a partial patch into the shared crmView object and save (debounced). */
export function saveCrmView(patch: Partial<CrmViewPrefs>): void {
  loadAccountMemory()
    .then((memory) => {
      const v = memory.crmView
      const current = v && typeof v === 'object' && !Array.isArray(v) ? (v as CrmViewPrefs) : {}
      saveAccountMemoryDebounced('crmView', { ...current, ...patch })
    })
    .catch(() => {})
}
