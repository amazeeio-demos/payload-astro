import { defineCollection } from 'astro:content'
// Astro 7 deprecated re-exporting `z` from `astro:content`; the bundled zod
// still ships under `astro/zod`, which keeps the schema on the exact version
// Astro validates with.
import { z } from 'astro/zod'
import { payloadCategoriesLoader, payloadDocsLoader } from '@repo/payload-loader'

import { ALLOW_EMPTY, LOCALES, PAYLOAD_GRAPHQL_URL } from './site'

/**
 * Shape stored for each entry. It mirrors the GraphQL documents in
 * `@repo/graphql` — those types are the real contract, this schema is what
 * Astro validates the snapshot against before writing it to disk.
 *
 * `body` stays `unknown`: it is Lexical JSON, and only `@repo/ui` knows how to
 * read it.
 */
const docsSchema = z.object({
  id: z.number(),
  slug: z.string(),
  locale: z.enum(LOCALES),
  title: z.string(),
  description: z.string().nullable().default(null),
  body: z.unknown(),
  sidebarLabel: z.string().nullable().default(null),
  sidebarOrder: z.number().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
  category: z
    .object({
      id: z.number(),
      name: z.string().nullable().default(null),
      slug: z.string(),
    })
    .nullable()
    .default(null),
})

const categoriesSchema = z.object({
  id: z.number(),
  slug: z.string(),
  locale: z.enum(LOCALES),
  name: z.string().nullable().default(null),
  order: z.number(),
})

export const collections = {
  docs: defineCollection({
    loader: payloadDocsLoader({
      endpoint: PAYLOAD_GRAPHQL_URL,
      locales: LOCALES,
      allowEmpty: ALLOW_EMPTY,
    }),
    schema: docsSchema,
  }),
  categories: defineCollection({
    loader: payloadCategoriesLoader({
      endpoint: PAYLOAD_GRAPHQL_URL,
      locales: LOCALES,
    }),
    schema: categoriesSchema,
  }),
}
