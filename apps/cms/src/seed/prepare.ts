/**
 * Prépare la base sans y injecter de contenu.
 *
 * Utile en production, où l'on ne veut pas de contenu de démonstration mais où
 * l'on veut quand même éviter que la toute première écriture ne se heurte à la
 * création paresseuse des collections par Mongoose. Voir `ensureCollections`.
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { ensureCollections } from './ensureCollections'

const payload = await getPayload({ config })
await ensureCollections(payload)

console.log('[db] collections et index prêts')
process.exit(0)
