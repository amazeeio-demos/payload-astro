import type { LinkDocument } from './lexical/types'

/**
 * Where the site is being rendered: the URL scheme puts the default locale at
 * the root (`/introduction`) and prefixes the others (`/fr/introduction`).
 */
export interface LocaleContext {
  locale: string
  defaultLocale: string
}

/** Public URL of a doc page in the current locale. */
export function docHref(slug: string, { locale, defaultLocale }: LocaleContext): string {
  return locale === defaultLocale ? `/${slug}` : `/${locale}/${slug}`
}

/**
 * Resolves an internal Lexical link to a site URL.
 *
 * The editor stores the target as `{ relationTo, value }`, where `value` is the
 * populated document at depth ≥ 1 and a bare id at depth 0. Only `docs` has
 * public URLs; anything else — and any link whose document was not populated —
 * returns null, and the serializer renders the text without an anchor rather
 * than a link to nowhere.
 */
export function internalDocToHref(
  doc: LinkDocument | null | undefined,
  context: LocaleContext,
): string | null {
  if (!doc || doc.relationTo !== 'docs') return null

  const slug = typeof doc.value === 'object' && doc.value ? doc.value.slug : null
  if (!slug) return null

  return docHref(slug, context)
}
