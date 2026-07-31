import type { FormatKey, LayoutKey, Overlay } from '@/lib/freehold/ad-compose'

/**
 * CREATIVE SUITE — the registry behind /drive/create.
 *
 * Templates are REAL: each one is a (layout × palette × format × copy) recipe
 * rendered live by the shared ad-compose engine, so the gallery previews our
 * own design language, not stock screenshots. "Use" deep-links into the Ad
 * Designer with the recipe AND its copy preselected.
 *
 * LANGUAGE IS THE AD'S, NOT THE UI'S. A Dubai agent working in an English
 * dashboard still sells to Arabic- and Russian-speaking buyers, so the sample
 * copy lives here as DATA keyed by ad language — never in the UI dictionary,
 * which would flip it to whatever chrome language the agent happens to use.
 * The compose engine already detects RTL from the headline, so an Arabic
 * template lays itself out right-to-left automatically.
 *
 * COPY IS WRITTEN FOR BUYERS, NOT THE INDUSTRY. No payment-split ratios
 * ("60/40", "80/20"), no "post-handover", no yield jargon — a buyer thinks in
 * the monthly payment, the deposit, the move-in date, and what they can see
 * from the balcony. The samples are what the agent edits, so they have to
 * model the language that actually sells.
 */

export type SuiteLang = 'en' | 'ar' | 'ru'
export const SUITE_LANGS: SuiteLang[] = ['en', 'ar', 'ru']

/** The buyer situations a real-estate ad speaks to. */
export type SuiteCopy = 'launch' | 'monthly' | 'ready' | 'open' | 'family' | 'income'
export const SUITE_COPY_KEYS: SuiteCopy[] = ['launch', 'monthly', 'ready', 'open', 'family', 'income']

/** Sample ad copy, per ad language. Illustrative placeholders the agent edits. */
export const SUITE_COPY: Record<SuiteLang, Record<SuiteCopy, Overlay>> = {
  en: {
    launch:  { eyebrow: 'Now launching · Dubai Marina',   headline: 'Wake up to the water, every morning',        price: '1.4M',   priceUnit: 'AED',       footnote: '10% to book · keys in 2027' },
    monthly: { eyebrow: 'Jumeirah Village Circle',        headline: 'Own it for less than your rent',             price: '4,900',  priceUnit: 'AED/month', footnote: '10% deposit · keys in 2027' },
    ready:   { eyebrow: 'Ready to move in · Business Bay', headline: 'Get the keys this month',                   price: '1.2M',   priceUnit: 'AED',       footnote: 'Built, finished, waiting for you' },
    open:    { eyebrow: 'Open house · Saturday & Sunday',  headline: 'See the sunset from your own terrace',      price: '2.1M',   priceUnit: 'AED',       footnote: 'Book a viewing this weekend' },
    family:  { eyebrow: 'Arabian Ranches',                headline: 'Three bedrooms, a garden, school 5 min away', price: '2.6M',  priceUnit: 'AED',       footnote: 'Pool, park and quiet streets' },
    income:  { eyebrow: 'Downtown Dubai',                 headline: 'Already rented — it pays you from day one',  price: '95,000', priceUnit: 'AED/year',  footnote: 'Tenant in place · contract running' },
  },
  ar: {
    launch:  { eyebrow: 'يفتتح الآن · دبي مارينا',        headline: 'استيقظ على البحر كل صباح',                  price: '1.4M',   priceUnit: 'درهم',       footnote: 'احجز بـ10% · التسليم 2027' },
    monthly: { eyebrow: 'قرية جميرا الدائرية',            headline: 'تملّك بأقل من إيجارك الشهري',                price: '4,900',  priceUnit: 'درهم/شهر',   footnote: 'دفعة أولى 10% · المفاتيح 2027' },
    ready:   { eyebrow: 'جاهز للسكن · الخليج التجاري',    headline: 'استلم المفاتيح هذا الشهر',                   price: '1.2M',   priceUnit: 'درهم',       footnote: 'مبني ومجهّز وبانتظارك' },
    open:    { eyebrow: 'يوم مفتوح · السبت والأحد',       headline: 'شاهد الغروب من شرفتك أنت',                   price: '2.1M',   priceUnit: 'درهم',       footnote: 'احجز جولتك هذا الأسبوع' },
    family:  { eyebrow: 'المرابع العربية',                headline: 'ثلاث غرف وحديقة ومدرسة على بعد 5 دقائق',     price: '2.6M',   priceUnit: 'درهم',       footnote: 'مسبح وحديقة وشوارع هادئة' },
    income:  { eyebrow: 'وسط مدينة دبي',                  headline: 'مؤجّرة بالفعل — دخل من أول يوم',            price: '95,000', priceUnit: 'درهم/سنة',   footnote: 'مستأجر حالي · العقد ساري' },
  },
  ru: {
    launch:  { eyebrow: 'Старт продаж · Дубай Марина',    headline: 'Просыпайтесь у воды каждое утро',            price: '1.4M',   priceUnit: 'AED',       footnote: '10% при бронировании · ключи в 2027' },
    monthly: { eyebrow: 'Джумейра Вилладж Серкл',         headline: 'Своя квартира дешевле аренды',              price: '4 900',  priceUnit: 'AED/мес',   footnote: 'Первый взнос 10% · ключи в 2027' },
    ready:   { eyebrow: 'Готово к заселению · Бизнес Бей', headline: 'Получите ключи уже в этом месяце',          price: '1.2M',   priceUnit: 'AED',       footnote: 'Построено, отделано, ждёт вас' },
    open:    { eyebrow: 'День открытых дверей · сб и вс',  headline: 'Закат — с вашей собственной террасы',       price: '2.1M',   priceUnit: 'AED',       footnote: 'Запишитесь на просмотр' },
    family:  { eyebrow: 'Арабиан Ранчес',                 headline: 'Три спальни, сад и школа в 5 минутах',      price: '2.6M',   priceUnit: 'AED',       footnote: 'Бассейн, парк и тихие улицы' },
    income:  { eyebrow: 'Даунтаун Дубай',                 headline: 'Уже сдана — доход с первого дня',           price: '95 000', priceUnit: 'AED/год',   footnote: 'Арендатор на месте · договор действует' },
  },
}

export interface SuiteTemplate {
  id: string
  layout: LayoutKey
  palette: number      // index into PALETTES
  format: FormatKey
  copy: SuiteCopy      // which sample copy set the preview renders with
  lang: SuiteLang      // the AD's language — drives copy and RTL layout
}

type Recipe = Omit<SuiteTemplate, 'lang' | 'id'> & { id: string }

/** Curated recipes — every layout family, palette, format and buyer situation
 *  appears, and each is offered in all three ad languages. */
const RECIPES: Recipe[] = [
  { id: 'feed-hero-sand',       layout: 'heroPrice',  palette: 0, format: 'feed',   copy: 'launch'  },
  { id: 'feed-frame-night',     layout: 'frame',      palette: 1, format: 'feed',   copy: 'monthly' },
  { id: 'feed-stat-ivory',      layout: 'statFooter', palette: 2, format: 'feed',   copy: 'open'    },
  { id: 'feed-split-pearl',     layout: 'splitCard',  palette: 4, format: 'feed',   copy: 'family'  },
  { id: 'feed-badge-sand',      layout: 'badge',      palette: 0, format: 'feed',   copy: 'ready'   },
  { id: 'square-hero-night',    layout: 'heroPrice',  palette: 1, format: 'square', copy: 'monthly' },
  { id: 'square-frame-sand',    layout: 'frame',      palette: 0, format: 'square', copy: 'open'    },
  { id: 'square-stat-night',    layout: 'statFooter', palette: 1, format: 'square', copy: 'income'  },
  { id: 'square-badge-emerald', layout: 'badge',      palette: 3, format: 'square', copy: 'ready'   },
  { id: 'square-split-emerald', layout: 'splitCard',  palette: 3, format: 'square', copy: 'launch'  },
  { id: 'story-frame-night',    layout: 'frame',      palette: 1, format: 'story',  copy: 'launch'  },
  { id: 'story-hero-ivory',     layout: 'heroPrice',  palette: 2, format: 'story',  copy: 'monthly' },
  { id: 'story-stat-sand',      layout: 'statFooter', palette: 0, format: 'story',  copy: 'family'  },
  { id: 'story-split-night',    layout: 'splitCard',  palette: 1, format: 'story',  copy: 'open'    },
  { id: 'story-badge-pearl',    layout: 'badge',      palette: 4, format: 'story',  copy: 'income'  },
]

export const SUITE_TEMPLATES: SuiteTemplate[] =
  SUITE_LANGS.flatMap((lang) => RECIPES.map((r) => ({ ...r, lang, id: `${r.id}-${lang}` })))

/** The sample copy a template previews (and seeds the designer) with. */
export const templateOverlay = (tpl: SuiteTemplate): Overlay => SUITE_COPY[tpl.lang][tpl.copy]

export function templateHref(tpl: SuiteTemplate): string {
  return `/freehold-intelligence/drive/ad-designer?format=${tpl.format}&layout=${tpl.layout}` +
    `&palette=${tpl.palette}&copy=${tpl.copy}&lang=${tpl.lang}`
}

// The doc starter templates the doc editor already ships (ed.doc.tpl.*).
export const DOC_TEMPLATE_KEYS = ['brochure', 'offer', 'report', 'whatsapp', 'social'] as const
