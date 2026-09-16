// Entrypoint of the `web` container on Lagoon.
//
// Lagoon marks a pod ready when port 3000 accepts a connection, and only runs
// the post-rollout tasks once every pod is ready. On the first rollout the site
// does not exist yet — the post-rollout task is what builds it — so a container
// that waited for the build before listening would block the rollout that
// triggers the build. This script listens right away, answers 503 until the
// build lands on the persistent volume, then hands the port over to Astro's
// own server. Pods that restart on an already filled volume skip the wait.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'

const webDir = new URL('../apps/web/', import.meta.url)
const entry = new URL('dist/server/entry.mjs', webDir)
const host = process.env.HOST ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

if (!existsSync(entry)) {
  const placeholder = createServer((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' })
    res.end('The site is being built for the first time. Try again in a minute.\n')
  })
  await new Promise((resolve) => placeholder.listen(port, host, resolve))
  console.log(`Waiting for the post-rollout task to build the site (placeholder on :${port})…`)
  while (!existsSync(entry)) await sleep(5000)
  await new Promise((resolve) => placeholder.close(resolve))
  console.log('Site built, starting the Astro server.')
}

// Same thing `pnpm --filter web start` runs, without pnpm in between so signals
// reach the server directly.
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
  cwd: webDir,
  stdio: 'inherit',
})
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal))
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
