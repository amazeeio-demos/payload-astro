import type { Loader } from 'astro/loaders'
import { CategoriesDocument, graphqlRequest, type LocaleInputType } from '@repo/graphql'

export interface PayloadCategoriesLoaderOptions {
  endpoint: string
  locales: readonly LocaleInputType[]
}

/**
 * Build-time snapshot of the categories, one entry per locale and slug.
 *
 * They carry the navigation: the layout groups the documents by category and
 * orders the groups by `order`. Unlike the documents, an empty list is not an
 * error — a site can perfectly well have none.
 */
export function payloadCategoriesLoader(options: PayloadCategoriesLoaderOptions): Loader {
  const { endpoint, locales } = options

  return {
    name: 'payload-categories',
    async load({ store, parseData, generateDigest, logger }) {
      store.clear()

      for (const locale of locales) {
        const result = await graphqlRequest(endpoint, CategoriesDocument, { locale })
        const categories = result.Categories?.docs ?? []

        for (const category of categories) {
          const id = `${locale}/${category.slug}`
          store.set({
            id,
            data: await parseData({ id, data: { ...category, locale } }),
            digest: generateDigest(category),
          })
        }

        logger.info(`${locale}: ${categories.length} category(ies)`)
      }
    },
  }
}
