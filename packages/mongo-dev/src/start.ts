/**
 * MongoDB de développement, sans Docker ni installation système.
 *
 * `mongodb-memory-server` télécharge un binaire `mongod` officiel au premier
 * lancement et le met en cache. On le démarre en replica set mono-nœud parce
 * que Payload utilise des transactions, indisponibles sur une instance seule.
 *
 * Malgré le nom du paquet, les données ne sont pas en mémoire : `dbPath` pointe
 * sur `.data/mongo` à la racine du dépôt, donc elles survivent aux redémarrages.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../../..')
const dataDir = path.join(repoRoot, '.data')
const dbPath = path.join(dataDir, 'mongo')

const PORT = 27017
const REPL_SET_NAME = 'rs0'
const DB_NAME = 'docs'

mkdirSync(dbPath, { recursive: true })

// Le binaire mongod est mis en cache par le postinstall du paquet, dans
// node_modules/.cache — il n'est téléchargé qu'une fois.
const { MongoMemoryReplSet } = await import('mongodb-memory-server')

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, name: REPL_SET_NAME, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: PORT, dbPath, storageEngine: 'wiredTiger' }],
})

const uri = `mongodb://127.0.0.1:${PORT}/${DB_NAME}?replicaSet=${REPL_SET_NAME}&directConnection=true`

console.log(`[mongo-dev] prêt sur ${uri}`)
console.log(`[mongo-dev] données : ${dbPath}`)

let stopping = false
const shutdown = async (signal: NodeJS.Signals) => {
  if (stopping) return
  stopping = true
  console.log(`[mongo-dev] ${signal} reçu, arrêt…`)
  // `doCleanup: false` : sans ça le paquet efface `dbPath` en sortant.
  await replSet.stop({ doCleanup: false })
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
