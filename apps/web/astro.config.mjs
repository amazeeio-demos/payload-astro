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

import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { fetchStarlightSidebar } from '@repo/payload-loader'

import { DEFAULT_LOCALE, LOCALES, PAYLOAD_GRAPHQL_URL, SITE_URL } from './src/site'

// The sidebar belongs to the integration's configuration, not to the content, so
// it has to be known before the loader runs — hence this call here.
const sidebar = await fetchStarlightSidebar({
  endpoint: PAYLOAD_GRAPHQL_URL,
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
})

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [
    starlight({
      title: 'Docs',
      // `root` = default locale, served without a URL prefix.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      sidebar,
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/uselagoon/lagoon' },
      ],
    }),
  ],
})
