import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Charge le `.env` unique de la racine du monorepo.
 *
 * Importé en tout premier par `payload.config.ts`, donc emprunté par tous les
 * points d'entrée : serveur Next, CLI Payload, script de seed.
 *
 * `process.loadEnvFile` est natif à Node — pas de dépendance. En conteneur le
 * fichier n'existe pas : Lagoon injecte directement les variables, et l'absence
 * du fichier n'est donc pas une erreur.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRootEnv = path.resolve(dirname, '../../../../.env')

try {
  process.loadEnvFile(repoRootEnv)
} catch {
  // Pas de .env : les variables viennent de l'environnement.
}
