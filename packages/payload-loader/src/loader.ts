import type { Loader } from 'astro/loaders'
import { graphqlRequest } from './graphql.js'

export interface PayloadDocsLoaderOptions {
  /** Endpoint GraphQL de Payload, ex. http://localhost:3000/api/graphql */
  endpoint: string
  /** Locales Payload à charger. */
  locales: readonly string[]
  /** Locale servie à la racine du site, sans préfixe d'URL. */
  defaultLocale: string
  /** Garde-fou : au-delà, il faudra paginer. */
  limit?: number
  /**
   * Par défaut, un CMS sans contenu publié fait échouer le build — un site vide
   * se déploie sans erreur et casse la production en silence. À basculer pour le
   * tout premier déploiement d'un environnement dont le CMS est encore vierge.
   */
  allowEmpty?: boolean
}

export interface PayloadDoc {
  id: string
  slug: string
  title: string
  description: string | null
  markdown: string | null
  sidebarLabel: string | null
  updatedAt: string
}

const DOCS_QUERY = /* GraphQL */ `
  query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {
    Docs(locale: $locale, limit: $limit, where: { _status: { equals: published } }) {
      docs {
        id
        slug
        title
        description
        markdown
        sidebarLabel
        updatedAt
      }
      totalDocs
    }
  }
`

/**
 * Astro appelle le loader avec une locale et attend en retour des entrées dont
 * l'`id` porte le préfixe de langue : Starlight en déduit le routage i18n
 * (`getting-started` pour la locale racine, `fr/getting-started` sinon).
 */
export function payloadDocsLoader(options: PayloadDocsLoaderOptions): Loader {
  const { endpoint, locales, defaultLocale, limit = 500, allowEmpty = false } = options

  return {
    name: 'payload-docs',
    async load({ store, parseData, renderMarkdown, generateDigest, logger }) {
      if (!endpoint) {
        throw new Error(
          'payloadDocsLoader : endpoint manquant. Renseignez PAYLOAD_GRAPHQL_URL dans .env',
        )
      }

      store.clear()
      let total = 0

      for (const locale of locales) {
        const data = await graphqlRequest<{ Docs: { docs: PayloadDoc[]; totalDocs: number } }>(
          endpoint,
          DOCS_QUERY,
          { locale, limit },
        )

        const { docs, totalDocs } = data.Docs

        if (totalDocs > limit) {
          logger.warn(
            `${locale} : ${totalDocs} documents pour une limite de ${limit}. Certains sont ignorés — augmentez \`limit\` ou paginez.`,
          )
        }

        for (const doc of docs) {
          const id = locale === defaultLocale ? doc.slug : `${locale}/${doc.slug}`

          // Starlight suppose un loader basé sur des fichiers et déréférence
          // `entry.filePath!`. On fournit un chemin synthétique cohérent.
          const filePath = `src/content/docs/${id}.md`

          // `parseData` applique le schéma de la collection. Indispensable :
          // `docsSchema()` définit `draft: false` par défaut, et Starlight écarte
          // en production toute entrée dont `draft` n'est pas exactement `false`.
          const parsed = await parseData({
            id,
            filePath,
            data: {
              title: doc.title,
              ...(doc.description ? { description: doc.description } : {}),
              ...(doc.sidebarLabel ? { sidebar: { label: doc.sidebarLabel } } : {}),
            },
          })

          store.set({
            id,
            data: parsed,
            filePath,
            rendered: await renderMarkdown(doc.markdown ?? ''),
            digest: generateDigest(`${doc.updatedAt}:${doc.markdown ?? ''}`),
          })
          total++
        }

        logger.info(`${locale} : ${docs.length} document(s)`)
      }

      if (total === 0) {
        const message = `aucun document publié trouvé sur ${endpoint}. Lancez \`pnpm seed\` ou publiez du contenu.`
        if (!allowEmpty) {
          throw new Error(
            `payloadDocsLoader : ${message} Passez PAYLOAD_ALLOW_EMPTY=true pour construire malgré tout.`,
          )
        }
        logger.warn(`Site construit à vide : ${message}`)
      }
    },
  }
}
