import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Loads the single `.env` at the monorepo root.
 *
 * Imported first by `payload.config.ts`, so every entry point picks it up: the
 * Next server, the Payload CLI, the seed script.
 *
 * `process.loadEnvFile` is built into Node — no dependency. In a container the
 * file does not exist: Lagoon injects the variables directly, so its absence is
 * not an error.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRootEnv = path.resolve(dirname, '../../../../.env')

try {
  process.loadEnvFile(repoRootEnv)
} catch {
  // No .env: the variables come from the environment.
}
