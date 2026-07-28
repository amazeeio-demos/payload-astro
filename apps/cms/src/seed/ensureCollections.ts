import type { Payload } from 'payload'

interface MongooseLikeModel {
  init?: () => Promise<unknown>
  createCollection?: () => Promise<unknown>
}

/**
 * Prepares the MongoDB collections before any write.
 *
 * On a fresh database Mongoose creates collections and builds their indexes
 * lazily, in the background. Payload, meanwhile, writes inside transactions —
 * and a MongoDB transaction only waits about 5 ms to acquire a lock. The two
 * collide: the first `pnpm seed` fails on a `TransientTransactionError`
 * (`WriteConflict`, then `Unable to acquire IX lock`) while the second succeeds.
 * Confusing behaviour we would rather remove.
 *
 * `Model.init()` is the Mongoose primitive that resolves once the collection
 * exists and its indexes are built. We await it, outside any transaction, for
 * every collection — including the versions ones created by `versions.drafts`.
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
        // Already there: the normal case from the second run onwards.
      }
      // Waits for index builds to finish.
      await model.init?.()
    }),
  )
}
