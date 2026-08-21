/**
 * Settings shared between `astro.config.mjs`, the content config and the pages.
 *
 * `LOCALES` is typed with Payload's own `LocaleInputType`, so adding a locale to
 * `localization` in `apps/cms/src/payload.config.ts` without adding it here — or
 * the other way round — is a type error rather than a silent 404.
 */
import type { LocaleInputType } from '@repo/graphql'

export const LOCALES = ['en', 'fr'] as const satisfies readonly LocaleInputType[]
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** English at the root, the other locales under their code. */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`
}

/**
 * Payload's GraphQL endpoint.
 *
 * Locally it points at `localhost:3000`. On Lagoon the Astro build runs as a
 * post-rollout task and reaches the CMS by its service name (`http://cms:3000`).
 */
export const PAYLOAD_GRAPHQL_URL =
  process.env.PAYLOAD_GRAPHQL_URL ?? 'http://localhost:3000/api/graphql'

export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4321'

/**
 * Allows a build while the CMS has nothing published yet. Useful for the very
 * first deployment of a blank environment — see the README.
 */
export const ALLOW_EMPTY = process.env.PAYLOAD_ALLOW_EMPTY === 'true'

/** First page of the documentation, linked from the home page. */
export const DOCS_ENTRY_SLUG = process.env.DOCS_ENTRY_SLUG ?? 'introduction'

/**
 * Public origin of the Payload CMS.
 *
 * `CMS_URL` first, then `NEXT_PUBLIC_SERVER_URL` — the same value under the name
 * the CMS already uses, which is the one to set on Lagoon since Payload needs it
 * too. The preview island compares it against `event.origin`, so it must be a
 * bare origin: no trailing slash, no path.
 */
export const CMS_URL = (process.env.CMS_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(
  /\/+$/,
  '',
)

/** Admin panel, linked from the home page; dropped when the origin is unknown. */
export const CMS_ADMIN_URL = CMS_URL ? `${CMS_URL}/admin` : null

/**
 * Secrets of the preview route. Server-side only — they are read here through
 * `process.env` rather than `import.meta.env.PUBLIC_*` precisely so that no
 * bundler can inline them into a client script.
 */
export const PREVIEW_SECRET = process.env.PREVIEW_SECRET ?? ''
export const PREVIEW_API_KEY = process.env.PREVIEW_API_KEY ?? ''
