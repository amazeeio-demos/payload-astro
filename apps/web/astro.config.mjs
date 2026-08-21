// @ts-check
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The single `.env` at the monorepo root. Absent in a container: Lagoon injects
// the variables directly when the post-rollout task runs.
try {
  process.loadEnvFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
  )
} catch {
  // No .env: the variables come from the environment.
}

import node from '@astrojs/node'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { SITE_URL } from './src/site'

/**
 * Hybrid site: every route is prerendered by default, and the handful that opt
 * out with `export const prerender = false` — only `/preview/*` — are rendered
 * on demand by the node adapter. The public pages therefore stay a pile of
 * static files, while the preview can read drafts per request.
 */
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    ssr: {
      // The workspace packages ship TypeScript sources, not a build. Vite
      // externalises anything resolved through node_modules by default, which
      // hands those .ts files straight to Node's ESM loader — and it cannot read
      // them. Listing them here keeps them inside the transform pipeline.
      noExternal: ['@repo/graphql', '@repo/payload-loader', '@repo/ui'],
    },
  },
})
