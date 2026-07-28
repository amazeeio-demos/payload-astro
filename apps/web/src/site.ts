/**
 * Settings shared between `astro.config.mjs` and `src/content.config.ts`.
 *
 * The locales must stay in sync with `localization` in
 * `apps/cms/src/payload.config.ts`: the loader queries Payload with these codes.
 */
export const LOCALES = ['en', 'fr'] as const
export const DEFAULT_LOCALE = 'en'

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
