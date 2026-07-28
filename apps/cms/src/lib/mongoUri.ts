/**
 * Resolves the MongoDB URI for the current environment.
 *
 * Locally, `DATABASE_URI` comes from `.env` and points at the replica set
 * started by `@repo/mongo-dev`.
 *
 * On Lagoon, the database service injects its coordinates as environment
 * variables when the container starts. Every uncertainty about the exact names
 * of those variables is concentrated here: if the amazee.io cluster uses
 * different ones, this file is the only thing that changes.
 *
 * Check them on the cluster with:
 *   lagoon get environment-variables -p <project> -e <environment>
 */
export function resolveMongoUri(): string {
  const explicit = process.env.DATABASE_URI
  if (explicit) return explicit

  const host = process.env.MONGODB_HOST
  if (!host) {
    throw new Error(
      'No MongoDB URI: set DATABASE_URI, or MONGODB_HOST and its companion variables.',
    )
  }

  const port = process.env.MONGODB_PORT ?? '27017'
  const database = process.env.MONGODB_DATABASE ?? 'docs'
  const username = process.env.MONGODB_USERNAME
  const password = process.env.MONGODB_PASSWORD

  // Lagoon's `mongodb-single` service runs without authentication;
  // `mongodb-dbaas` supplies a username and password.
  const credentials =
    username && password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : ''

  return `mongodb://${credentials}${host}:${port}/${database}`
}
