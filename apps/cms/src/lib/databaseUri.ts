/**
 * Resolves the PostgreSQL connection string for the current environment.
 *
 * Locally, `DATABASE_URI` comes from `.env` and points at the container started
 * by `docker-compose.dev.yml`. It also wins everywhere else, for the day a
 * database lives outside Lagoon.
 *
 * On Lagoon the `postgres` service type resolves to one of two things, and the
 * container cannot know which in advance:
 * - a database provisioned by the DBaaS operator, whose coordinates arrive as
 *   `POSTGRES_HOST`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`,
 *   `POSTGRES_DATABASE` and `POSTGRES_PORT`;
 * - a single pod running Lagoon's Postgres image, reachable under the service
 *   name with the image defaults (`lagoon` for user, password and database).
 */
export function resolveDatabaseUri(): string {
  const explicit = process.env.DATABASE_URI
  if (explicit) return explicit

  const host = process.env.POSTGRES_HOST
  if (host) {
    const user = encodeURIComponent(process.env.POSTGRES_USERNAME ?? 'lagoon')
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? 'lagoon')
    const database = process.env.POSTGRES_DATABASE ?? 'lagoon'
    const port = process.env.POSTGRES_PORT ?? '5432'
    return `postgres://${user}:${password}@${host}:${port}/${database}`
  }

  if (process.env.LAGOON_ENVIRONMENT) {
    return 'postgres://lagoon:lagoon@postgres:5432/lagoon'
  }

  throw new Error(
    'No PostgreSQL URI: set DATABASE_URI, e.g. postgres://payload:payload@localhost:5432/payload',
  )
}
