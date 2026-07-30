import type { FormatKey, LayoutKey } from '@/lib/freehold/ad-compose'

/**
 * CREATIVE SUITE — the registry behind /drive/create.
 * Templates are REAL: each one is a (layout × palette × format) recipe rendered
 * live by the shared ad-compose engine, so the gallery previews our own design
 * language, not stock screenshots. "Use" deep-links into the Ad Designer with
 * the recipe preselected.
 */

export type SuiteCopy = 'launch' | 'offer' | 'open'

export interface SuiteTemplate {
  id: string
  layout: LayoutKey
  palette: number      // index into PALETTES
  format: FormatKey
  copy: SuiteCopy      // which sample copy set the preview renders with
}

// Curated set — every layout family, palette and format appears at least once.
export const SUITE_TEMPLATES: SuiteTemplate[] = [
  { id: 'feed-hero-sand',    layout: 'heroPrice',  palette: 0, format: 'feed',   copy: 'launch' },
  { id: 'feed-frame-night',  layout: 'frame',      palette: 1, format: 'feed',   copy: 'offer'  },
  { id: 'feed-stat-ivory',   layout: 'statFooter', palette: 2, format: 'feed',   copy: 'open'   },
  { id: 'square-hero-night', layout: 'heroPrice',  palette: 1, format: 'square', copy: 'launch' },
  { id: 'square-frame-sand', layout: 'frame',      palette: 0, format: 'square', copy: 'open'   },
  { id: 'square-stat-night', layout: 'statFooter', palette: 1, format: 'square', copy: 'offer'  },
  { id: 'story-frame-night', layout: 'frame',      palette: 1, format: 'story',  copy: 'launch' },
  { id: 'story-hero-ivory',  layout: 'heroPrice',  palette: 2, format: 'story',  copy: 'offer'  },
  { id: 'story-stat-sand',   layout: 'statFooter', palette: 0, format: 'story',  copy: 'open'   },
]

export function templateHref(tpl: SuiteTemplate): string {
  return `/freehold-intelligence/drive/ad-designer?format=${tpl.format}&layout=${tpl.layout}&palette=${tpl.palette}`
}

// The doc starter templates the doc editor already ships (ed.doc.tpl.*).
export const DOC_TEMPLATE_KEYS = ['brochure', 'offer', 'report', 'whatsapp', 'social'] as const
