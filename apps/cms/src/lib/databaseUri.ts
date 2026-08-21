/**
 * Resolves the PostgreSQL connection string for the current environment.
 *
 * Locally, `DATABASE_URI` comes from `.env` and points at the container started
 * by `docker-compose.dev.yml`.
 *
 * TODO (Lagoon): the database service injects its coordinates as separate
 * environment variables when the container starts (`POSTGRES_HOST`,
 * `POSTGRES_DATABASE`, …). Rebuild the URI from them here — this file is meant
 * to be the only place that knows their names. Check them with:
 *   lagoon get environment-variables -p <project> -e <environment>
 */
export function resolveDatabaseUri(): string {
  const explicit = process.env.DATABASE_URI
  if (explicit) return explicit

  throw new Error(
    'No PostgreSQL URI: set DATABASE_URI, e.g. postgres://payload:payload@localhost:5432/payload',
  )
}
