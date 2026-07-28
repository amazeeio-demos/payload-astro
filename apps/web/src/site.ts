/**
 * Réglages partagés entre `astro.config.mjs` et `src/content.config.ts`.
 *
 * Les locales doivent rester alignées avec `localization` dans
 * `apps/cms/src/payload.config.ts` : le loader interroge Payload avec ces codes.
 */
export const LOCALES = ['en', 'fr'] as const
export const DEFAULT_LOCALE = 'en'

/**
 * Endpoint GraphQL de Payload.
 *
 * En local il pointe sur `localhost:3000`. Sur Lagoon, le build Astro tourne en
 * tâche post-rollout et joint le CMS par son nom de service (`http://cms:3000`).
 */
export const PAYLOAD_GRAPHQL_URL =
  process.env.PAYLOAD_GRAPHQL_URL ?? 'http://localhost:3000/api/graphql'

export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4321'

/**
 * Autorise un build alors que le CMS ne contient encore rien de publié.
 * Utile au tout premier déploiement d'un environnement vierge — voir le README.
 */
export const ALLOW_EMPTY = process.env.PAYLOAD_ALLOW_EMPTY === 'true'
