import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from './config'
import { DICTIONARIES } from './dictionaries'

/**
 * Server-side translator for Server Components (which can't use the client
 * useI18n hook). Reads the locale cookie and returns { locale, t }.
 *
 * Usage in a server component:
 *   const { t, locale } = await getServerT()
 *   <h1>{t('inv.title')}</h1>
 */
export async function getServerT(): Promise<{
  locale: Locale
  t: (key: string, vars?: Record<string, string | number>) => string
}> {
  let locale: Locale = DEFAULT_LOCALE
  try {
    const store = await cookies()
    locale = normalizeLocale(store.get(LOCALE_COOKIE)?.value)
  } catch {}

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
    let str = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    return str
  }

  return { locale, t }
}
