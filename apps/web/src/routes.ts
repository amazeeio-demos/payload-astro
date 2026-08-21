import { DEFAULT_LOCALE, localePrefix, type Locale } from './site'

/**
 * URL of a doc page. The single place that knows the URL scheme — English at
 * the root, the other locales behind their code — so `[...path].astro`, the
 * navigation and the rich text links cannot disagree about it.
 */
export function docHrefFor(slug: string, locale: Locale): string {
  return `${localePrefix(locale)}/${slug}`
}

/** Home page of a locale. */
export function homeHrefFor(locale: Locale): string {
  return localePrefix(locale) || '/'
}

/** `path` parameter of `[...path].astro` for a given entry. */
export function docPathFor(slug: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? slug : `${locale}/${slug}`
}
