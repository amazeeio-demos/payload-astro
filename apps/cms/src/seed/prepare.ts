/**
 * Prepares the database without inserting any content.
 *
 * Useful in production, where we do not want demo content but still want to
 * avoid the very first write colliding with Mongoose's lazy collection creation.
 * See `ensureCollections`.
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { ensureCollections } from './ensureCollections'

const payload = await getPayload({ config })
await ensureCollections(payload)

console.log('[db] collections and indexes ready')
process.exit(0)
