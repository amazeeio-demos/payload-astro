// @ts-check
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `.env` unique à la racine du monorepo. Absent en conteneur : Lagoon injecte
// directement les variables au moment de la tâche post-rollout.
try {
  process.loadEnvFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
  )
} catch {
  // Pas de .env : les variables viennent de l'environnement.
}

import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { fetchStarlightSidebar } from '@repo/payload-loader'

import { DEFAULT_LOCALE, LOCALES, PAYLOAD_GRAPHQL_URL, SITE_URL } from './src/site'

// La sidebar fait partie de la configuration de l'intégration, pas du contenu :
// elle doit donc être connue avant que le loader ne tourne, d'où cet appel ici.
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
      // `root` = locale par défaut servie sans préfixe d'URL.
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
