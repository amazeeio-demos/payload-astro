/**
 * Résolution de l'URI MongoDB selon l'environnement.
 *
 * En local, `DATABASE_URI` vient du `.env` et pointe sur le replica set lancé
 * par `@repo/mongo-dev`.
 *
 * Sur Lagoon, le service de base de données injecte ses coordonnées dans des
 * variables d'environnement au démarrage du conteneur. Tout ce qui est incertain
 * sur les noms exacts de ces variables est concentré ici : si le cluster
 * amazee.io en utilise d'autres, seul ce fichier change.
 *
 * À vérifier sur le cluster avec :
 *   lagoon get environment-variables -p <projet> -e <environnement>
 */
export function resolveMongoUri(): string {
  const explicit = process.env.DATABASE_URI
  if (explicit) return explicit

  const host = process.env.MONGODB_HOST
  if (!host) {
    throw new Error(
      "Aucune URI MongoDB : renseignez DATABASE_URI, ou MONGODB_HOST et ses variables associées.",
    )
  }

  const port = process.env.MONGODB_PORT ?? '27017'
  const database = process.env.MONGODB_DATABASE ?? 'docs'
  const username = process.env.MONGODB_USERNAME
  const password = process.env.MONGODB_PASSWORD

  // Le service `mongodb-single` de Lagoon tourne sans authentification ;
  // `mongodb-dbaas` fournit un couple identifiant/mot de passe.
  const credentials =
    username && password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : ''

  return `mongodb://${credentials}${host}:${port}/${database}`
}
