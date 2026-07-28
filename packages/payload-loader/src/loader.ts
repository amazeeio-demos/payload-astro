import type { Loader } from 'astro/loaders'
import { graphqlRequest } from './graphql.js'

export interface PayloadDocsLoaderOptions {
  /** Payload's GraphQL endpoint, e.g. http://localhost:3000/api/graphql */
  endpoint: string
  /** Payload locales to load. */
  locales: readonly string[]
  /** Locale served at the site root, without a URL prefix. */
  defaultLocale: string
  /** Guard rail: past this, pagination becomes necessary. */
  limit?: number
  /**
   * By default a CMS with nothing published fails the build — an empty site
   * deploys without error and breaks production silently. Flip this for the very
   * first deployment of an environment whose CMS is still untouched.
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
 * Astro calls the loader once per locale and expects entries whose `id` carries
 * the language prefix: Starlight derives its i18n routing from it
 * (`getting-started` for the root locale, `fr/getting-started` otherwise).
 */
export function payloadDocsLoader(options: PayloadDocsLoaderOptions): Loader {
  const { endpoint, locales, defaultLocale, limit = 500, allowEmpty = false } = options

  return {
    name: 'payload-docs',
    async load({ store, parseData, renderMarkdown, generateDigest, logger }) {
      if (!endpoint) {
        throw new Error('payloadDocsLoader: no endpoint. Set PAYLOAD_GRAPHQL_URL in .env')
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
            `${locale}: ${totalDocs} documents against a limit of ${limit}. Some are being dropped — raise \`limit\` or paginate.`,
          )
        }

        for (const doc of docs) {
          const id = locale === defaultLocale ? doc.slug : `${locale}/${doc.slug}`

          // Starlight assumes a file-based loader and dereferences
          // `entry.filePath!`. We supply a consistent synthetic path.
          const filePath = `src/content/docs/${id}.md`

          // `parseData` applies the collection schema. This is essential:
          // `docsSchema()` defines `draft: false` as a default, and in production
          // Starlight discards any entry whose `draft` is not exactly `false`.
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

        logger.info(`${locale}: ${docs.length} document(s)`)
      }

      if (total === 0) {
        const message = `no published document found at ${endpoint}. Run \`pnpm seed\` or publish some content.`
        if (!allowEmpty) {
          throw new Error(
            `payloadDocsLoader: ${message} Set PAYLOAD_ALLOW_EMPTY=true to build anyway.`,
          )
        }
        logger.warn(`Building an empty site: ${message}`)
      }
    },
  }
}
