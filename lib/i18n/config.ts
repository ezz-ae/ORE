// Locale configuration — English, Arabic (RTL), Russian.
export const LOCALES = ['en', 'ar', 'ru'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const RTL_LOCALES: Locale[] = ['ar']

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  ru: 'Русский',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  ar: '🇦🇪',
  ru: '🇷🇺',
}

export const LOCALE_COOKIE = 'fh_locale'

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

export function normalizeLocale(value: string | undefined | null): Locale {
  const v = (value || '').toLowerCase().slice(0, 2)
  return (LOCALES as readonly string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE
}
