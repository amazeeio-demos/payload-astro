/**
 * Development MongoDB, without Docker or a system-wide installation.
 *
 * `mongodb-memory-server` downloads an official `mongod` binary on first run and
 * caches it. We start it as a single-node replica set because Payload uses
 * transactions, which a standalone instance does not offer.
 *
 * Despite the package name the data is not held in memory: `dbPath` points at
 * `.data/mongo` in the repo root, so it survives restarts.
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

// The mongod binary is cached by the package's postinstall, under
// node_modules/.cache — it is only downloaded once.
const { MongoMemoryReplSet } = await import('mongodb-memory-server')

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, name: REPL_SET_NAME, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: PORT, dbPath, storageEngine: 'wiredTiger' }],
})

const uri = `mongodb://127.0.0.1:${PORT}/${DB_NAME}?replicaSet=${REPL_SET_NAME}&directConnection=true`

console.log(`[mongo-dev] ready on ${uri}`)
console.log(`[mongo-dev] data: ${dbPath}`)

let stopping = false
const shutdown = async (signal: NodeJS.Signals) => {
  if (stopping) return
  stopping = true
  console.log(`[mongo-dev] got ${signal}, shutting down…`)
  // `doCleanup: false` — without it the package deletes `dbPath` on the way out.
  await replSet.stop({ doCleanup: false })
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
