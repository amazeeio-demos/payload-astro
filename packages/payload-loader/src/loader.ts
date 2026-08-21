import type { Loader } from 'astro/loaders'
import { DocsByLocaleDocument, graphqlRequest, type LocaleInputType } from '@repo/graphql'

export interface PayloadDocsLoaderOptions {
  /** Payload's GraphQL endpoint, e.g. http://localhost:3000/api/graphql */
  endpoint: string
  /** Payload locales to load — the codes its schema declares. */
  locales: readonly LocaleInputType[]
  /** Guard rail: past this, pagination becomes necessary. */
  limit?: number
  /**
   * By default a CMS with nothing published fails the build — an empty site
   * deploys without error and breaks production silently. Flip this for the very
   * first deployment of an environment whose CMS is still untouched.
   */
  allowEmpty?: boolean
}

/**
 * Build-time snapshot of the published documentation, one entry per locale and
 * slug.
 *
 * Entry ids carry the locale (`en/introduction`, `fr/introduction`) because the
 * routes are built by `src/pages/[...path].astro`, which reads the locale back
 * off the entry — the URL prefix is a routing decision, not a content one.
 */
export function payloadDocsLoader(options: PayloadDocsLoaderOptions): Loader {
  const { endpoint, locales, limit = 500, allowEmpty = false } = options

  return {
    name: 'payload-docs',
    async load({ store, parseData, generateDigest, logger }) {
      if (!endpoint) {
        throw new Error('payloadDocsLoader: no endpoint. Set PAYLOAD_GRAPHQL_URL in .env')
      }

      store.clear()
      let total = 0

      for (const locale of locales) {
        const result = await graphqlRequest(endpoint, DocsByLocaleDocument, { locale, limit })
        const docs = result.Docs?.docs ?? []
        const totalDocs = result.Docs?.totalDocs ?? 0

        if (totalDocs > limit) {
          logger.warn(
            `${locale}: ${totalDocs} documents against a limit of ${limit}. Some are being dropped — raise \`limit\` or paginate.`,
          )
        }

        for (const doc of docs) {
          const id = `${locale}/${doc.slug}`

          store.set({
            id,
            data: await parseData({ id, data: { ...doc, locale } }),
            digest: generateDigest(doc),
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
