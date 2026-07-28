import { defineCollection } from 'astro:content'
import { docsSchema } from '@astrojs/starlight/schema'
import { payloadDocsLoader } from '@repo/payload-loader'

import { ALLOW_EMPTY, DEFAULT_LOCALE, LOCALES, PAYLOAD_GRAPHQL_URL } from './site'

export const collections = {
  docs: defineCollection({
    loader: payloadDocsLoader({
      endpoint: PAYLOAD_GRAPHQL_URL,
      locales: LOCALES,
      defaultLocale: DEFAULT_LOCALE,
      allowEmpty: ALLOW_EMPTY,
    }),
    schema: docsSchema(),
  }),
}
