/**
 * The per-broker Lead-Machine permission CATALOGUE — the shape of the map that
 * `listBrokerPermissions()` / `saveBrokerPermissions()` store.
 *
 * It used to live inside the Ads → Permissions page, which meant the Team app
 * could only have had a second copy of it. One definition, two screens: the
 * permissions page and the Team app's Permissions tab both read this file, so a
 * permission added here appears (and saves) in both.
 */

export type Permission =
  | 'view_campaigns'
  | 'create_campaigns'
  | 'manage_budget'
  | 'view_attribution'
  | 'manage_landings'
  | 'manage_creatives'
  | 'view_leads'
  | 'export_leads'
  | 'manage_requirements'
  | 'view_competitor'

export const PERM_GROUPS: { groupKey: string; items: { id: Permission; labelKey: string; descKey: string }[] }[] = [
  {
    groupKey: 'lm.permissions.group.campaigns',
    items: [
      { id: 'view_campaigns',   labelKey: 'lm.permissions.perm.view_campaigns.label',   descKey: 'lm.permissions.perm.view_campaigns.desc'   },
      { id: 'create_campaigns', labelKey: 'lm.permissions.perm.create_campaigns.label', descKey: 'lm.permissions.perm.create_campaigns.desc' },
      { id: 'manage_budget',    labelKey: 'lm.permissions.perm.manage_budget.label',    descKey: 'lm.permissions.perm.manage_budget.desc'    },
    ],
  },
  {
    groupKey: 'lm.permissions.group.attribution',
    items: [
      { id: 'view_attribution', labelKey: 'lm.permissions.perm.view_attribution.label', descKey: 'lm.permissions.perm.view_attribution.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.assets',
    items: [
      { id: 'manage_landings',  labelKey: 'lm.permissions.perm.manage_landings.label',  descKey: 'lm.permissions.perm.manage_landings.desc'  },
      { id: 'manage_creatives', labelKey: 'lm.permissions.perm.manage_creatives.label', descKey: 'lm.permissions.perm.manage_creatives.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.leads',
    items: [
      { id: 'view_leads',   labelKey: 'lm.permissions.perm.view_leads.label',   descKey: 'lm.permissions.perm.view_leads.desc'   },
      { id: 'export_leads', labelKey: 'lm.permissions.perm.export_leads.label', descKey: 'lm.permissions.perm.export_leads.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.settings',
    items: [
      { id: 'manage_requirements', labelKey: 'lm.permissions.perm.manage_requirements.label', descKey: 'lm.permissions.perm.manage_requirements.desc' },
      { id: 'view_competitor',     labelKey: 'lm.permissions.perm.view_competitor.label',     descKey: 'lm.permissions.perm.view_competitor.desc'     },
    ],
  },
]

/** Total permissions in the catalogue — the denominator of "n of N granted". */
export const PERM_COUNT = PERM_GROUPS.reduce((n, g) => n + g.items.length, 0)

/**
 * The floor every broker starts from when their stored map has no opinion yet.
 * Stored values are merged OVER this, never the other way round.
 */
export const DEFAULT_PERMS: Record<Permission, boolean> = {
  view_campaigns: true, create_campaigns: false, manage_budget: false,
  view_attribution: false, manage_landings: false, manage_creatives: false,
  view_leads: true, export_leads: false, manage_requirements: false, view_competitor: false,
}

/** Tier is DERIVED from how many permissions are actually granted. */
export function deriveTier(n: number): 'Bronze' | 'Silver' | 'Gold' {
  return n >= 8 ? 'Gold' : n >= 4 ? 'Silver' : 'Bronze'
}

export const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400 border-orange-400/25 bg-orange-400/10',
  Silver:   'text-slate-300   border-white/15      bg-surface-2',
  Gold:     'text-gold  border-gold/25  bg-gold/10',
  Platinum: 'text-violet-300 border-violet-400/25 bg-violet-400/10',
}

/** Merge a stored map over the defaults — the one way a broker's map is read. */
export function permsWithDefaults(stored?: Record<string, boolean>): Record<Permission, boolean> {
  return { ...DEFAULT_PERMS, ...(stored ?? {}) } as Record<Permission, boolean>
}
