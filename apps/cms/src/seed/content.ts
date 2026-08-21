/** Demo content, authored in Markdown then converted to Lexical. */

export interface SeedCategory {
  slug: string
  order: number
  name: { en: string; fr: string }
}

export interface SeedDoc {
  slug: string
  category: string
  sidebarOrder: number
  en: SeedTranslation
  fr: SeedTranslation
}

export interface SeedTranslation {
  title: string
  description: string
  body: string
}

export const CATEGORIES: SeedCategory[] = [
  { slug: 'guides', order: 0, name: { en: 'Guides', fr: 'Guides' } },
  { slug: 'reference', order: 1, name: { en: 'Reference', fr: 'Référence' } },
]

export const DOCS: SeedDoc[] = [
  {
    slug: 'introduction',
    category: 'guides',
    sidebarOrder: 0,
    en: {
      title: 'Introduction',
      description: 'What this stack is and why it exists.',
      body: [
        'This site is built from content stored in Payload CMS and rendered statically by Astro.',
        '',
        '## How it fits together',
        '',
        'Payload owns the content and exposes it over GraphQL. Astro pulls it at build time through a custom Content Layer loader, then emits plain HTML.',
        '',
        '## Why static',
        '',
        'A documentation site changes far less often than it is read. Rebuilding on publish costs seconds; serving static files costs almost nothing.',
      ].join('\n'),
    },
    fr: {
      title: 'Introduction',
      description: "Ce qu'est cette stack et pourquoi elle existe.",
      body: [
        'Ce site est construit à partir de contenu stocké dans Payload CMS et rendu statiquement par Astro.',
        '',
        '## Comment les pièces s’assemblent',
        '',
        'Payload détient le contenu et l’expose en GraphQL. Astro le récupère au build via un loader Content Layer sur mesure, puis produit du HTML.',
        '',
        '## Pourquoi du statique',
        '',
        'Une documentation change bien moins souvent qu’elle n’est lue. Reconstruire à la publication coûte quelques secondes ; servir des fichiers statiques ne coûte presque rien.',
      ].join('\n'),
    },
  },
  {
    slug: 'local-development',
    category: 'guides',
    sidebarOrder: 1,
    en: {
      title: 'Local development',
      description: 'Running the whole stack from one command.',
      body: [
        'Everything runs from one command:',
        '',
        '```bash',
        'pnpm install',
        'pnpm dev',
        '```',
        '',
        '## PostgreSQL in a container',
        '',
        '`pnpm dev:db` starts the `postgres` service of `docker-compose.dev.yml`. The data lives in a named volume, so it survives `docker compose down`.',
        '',
        'A system-wide PostgreSQL already listening on 5432 wins over the container for connections to `127.0.0.1`, and the only symptom is `role "payload" does not exist`. Stop it, or move the mapping to 5433 and follow through in `DATABASE_URI`.',
        '',
        '## Schema',
        '',
        'The Postgres adapter pushes the schema on boot in development, so there is nothing to migrate locally. A shared environment needs real migrations.',
      ].join('\n'),
    },
    fr: {
      title: 'Développement local',
      description: 'Faire tourner toute la stack en une commande.',
      body: [
        'Tout démarre en une commande :',
        '',
        '```bash',
        'pnpm install',
        'pnpm dev',
        '```',
        '',
        '## PostgreSQL dans un conteneur',
        '',
        '`pnpm dev:db` démarre le service `postgres` de `docker-compose.dev.yml`. Les données vivent dans un volume nommé : elles survivent à un `docker compose down`.',
        '',
        'Un PostgreSQL installé sur la machine et déjà à l’écoute sur 5432 l’emporte sur le conteneur pour les connexions à `127.0.0.1`, avec pour seul symptôme `role "payload" does not exist`. Arrêtez-le, ou déplacez le mapping sur 5433 et répercutez-le dans `DATABASE_URI`.',
        '',
        '## Schéma',
        '',
        'L’adaptateur Postgres pousse le schéma au démarrage en développement : rien à migrer en local. Un environnement partagé, lui, a besoin de vraies migrations.',
      ].join('\n'),
    },
  },
  {
    slug: 'writing-content',
    category: 'guides',
    sidebarOrder: 2,
    en: {
      title: 'Writing content',
      description: 'Authoring pages in the admin panel.',
      body: [
        'Pages live in the **Docs** collection. Each one carries a slug shared across locales, a rich text body, and a position in the sidebar.',
        '',
        '## Translations',
        '',
        'Switch locale in the admin panel to translate a page. Untranslated pages fall back to English rather than disappearing.',
        '',
        '## Drafts',
        '',
        'Only published pages reach the static site. Drafts stay invisible to the build.',
      ].join('\n'),
    },
    fr: {
      title: 'Rédiger du contenu',
      description: "Créer des pages depuis l'interface d'administration.",
      body: [
        'Les pages vivent dans la collection **Docs**. Chacune porte un slug partagé entre les locales, un corps en texte riche et une position dans la sidebar.',
        '',
        '## Traductions',
        '',
        'Changez de locale dans l’administration pour traduire une page. Les pages non traduites retombent sur l’anglais au lieu de disparaître.',
        '',
        '## Brouillons',
        '',
        'Seules les pages publiées atteignent le site statique. Les brouillons restent invisibles au build.',
      ].join('\n'),
    },
  },
  {
    slug: 'graphql-api',
    category: 'reference',
    sidebarOrder: 0,
    en: {
      title: 'GraphQL API',
      description: 'The queries the frontend relies on.',
      body: [
        'Payload exposes GraphQL at `/api/graphql`. The loader issues one query per locale:',
        '',
        '```graphql',
        'query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {',
        '  Docs(locale: $locale, limit: $limit, where: { _status: { equals: published } }) {',
        '    docs { slug title description markdown sidebarLabel updatedAt }',
        '  }',
        '}',
        '```',
        '',
        '## The markdown field',
        '',
        'The `markdown` field is virtual: nothing is stored. An `afterRead` hook converts the Lexical body on the fly, so the frontend never touches Lexical JSON.',
      ].join('\n'),
    },
    fr: {
      title: 'API GraphQL',
      description: 'Les requêtes dont dépend le frontend.',
      body: [
        'Payload expose GraphQL sur `/api/graphql`. Le loader émet une requête par locale :',
        '',
        '```graphql',
        'query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {',
        '  Docs(locale: $locale, limit: $limit, where: { _status: { equals: published } }) {',
        '    docs { slug title description markdown sidebarLabel updatedAt }',
        '  }',
        '}',
        '```',
        '',
        '## Le champ markdown',
        '',
        'Le champ `markdown` est virtuel : rien n’est stocké. Un hook `afterRead` convertit le corps Lexical à la volée, si bien que le frontend ne manipule jamais de JSON Lexical.',
      ].join('\n'),
    },
  },
  {
    slug: 'deploying-to-lagoon',
    category: 'reference',
    sidebarOrder: 1,
    en: {
      title: 'Deploying to Lagoon',
      description: 'How the static build reaches production.',
      body: [
        'Lagoon builds container images before it deploys them, so the CMS is unreachable at image build time. The Astro build therefore runs as a post-rollout task, once the `cms` service answers on its internal name.',
        '',
        '## Shared storage',
        '',
        'The `cli` and `nginx` services share one persistent volume mounted at `/app/dist`. The task writes there; nginx serves from it.',
        '',
        '## Rebuilding',
        '',
        'Publishing content does not rebuild the site on its own. Trigger a redeploy, or wire a Payload hook to the Lagoon API.',
      ].join('\n'),
    },
    fr: {
      title: 'Déployer sur Lagoon',
      description: 'Comment le build statique atteint la production.',
      body: [
        'Lagoon construit les images avant de les déployer : le CMS est donc injoignable au moment du build d’image. Le build Astro tourne par conséquent en tâche post-rollout, une fois que le service `cms` répond sur son nom interne.',
        '',
        '## Stockage partagé',
        '',
        'Les services `cli` et `nginx` partagent un volume persistant monté sur `/app/dist`. La tâche y écrit, nginx sert depuis ce volume.',
        '',
        '## Reconstruire',
        '',
        'Publier du contenu ne reconstruit pas le site tout seul. Relancez un déploiement, ou branchez un hook Payload sur l’API Lagoon.',
      ].join('\n'),
    },
  },
  {
    slug: 'troubleshooting',
    category: 'reference',
    sidebarOrder: 2,
    en: {
      title: 'Troubleshooting',
      description: 'Things that go wrong, and why.',
      body: [
        '## The build fails with "aucun document publié"',
        '',
        'The loader refuses to produce an empty site. Either nothing is published, or Payload is not reachable at `PAYLOAD_GRAPHQL_URL`.',
        '',
        '## Pages are missing from the sidebar',
        '',
        'The sidebar is built from categories. A page without a category lands in a catch-all group at the bottom.',
        '',
        '## Content changes do not appear',
        '',
        'The site is static. Restart `astro dev`, or rebuild.',
      ].join('\n'),
    },
    fr: {
      title: 'Dépannage',
      description: 'Ce qui casse, et pourquoi.',
      body: [
        '## Le build échoue sur « aucun document publié »',
        '',
        'Le loader refuse de produire un site vide. Soit rien n’est publié, soit Payload est injoignable sur `PAYLOAD_GRAPHQL_URL`.',
        '',
        '## Des pages manquent dans la sidebar',
        '',
        'La sidebar est construite à partir des catégories. Une page sans catégorie atterrit dans un groupe fourre-tout en bas.',
        '',
        '## Les modifications n’apparaissent pas',
        '',
        'Le site est statique. Relancez `astro dev`, ou reconstruisez.',
      ].join('\n'),
    },
  },
]
