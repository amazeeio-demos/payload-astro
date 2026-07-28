import type { Payload } from 'payload'

interface MongooseLikeModel {
  init?: () => Promise<unknown>
  createCollection?: () => Promise<unknown>
}

/**
 * Prépare les collections MongoDB avant toute écriture.
 *
 * Sur une base neuve, Mongoose crée les collections et construit leurs index
 * paresseusement, en tâche de fond. Payload, lui, écrit dans des transactions —
 * et une transaction MongoDB n'attend qu'environ 5 ms pour obtenir un verrou.
 * Les deux se marchent dessus : le premier `pnpm seed` échoue sur un
 * `TransientTransactionError` (`WriteConflict`, puis `Unable to acquire IX
 * lock`), le second passe. Comportement déroutant qu'on préfère supprimer.
 *
 * `Model.init()` est la primitive Mongoose qui résout une fois la collection
 * créée et ses index construits. On l'attend, hors transaction, pour toutes les
 * collections — y compris celles des versions, créées par `versions.drafts`.
 */
export async function ensureCollections(payload: Payload): Promise<void> {
  const db = payload.db as unknown as {
    collections?: Record<string, MongooseLikeModel>
    versions?: Record<string, MongooseLikeModel>
  }

  const models = [...Object.values(db.collections ?? {}), ...Object.values(db.versions ?? {})]

  await Promise.all(
    models.map(async (model) => {
      try {
        await model.createCollection?.()
      } catch {
        // Déjà présente : cas nominal dès le deuxième lancement.
      }
      // Attend la fin de la construction des index.
      await model.init?.()
    }),
  )
}
