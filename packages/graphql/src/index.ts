export { CategoriesDocument, DocDraftDocument, DocsByLocaleDocument } from './documents'
export { graphqlRequest, PayloadGraphQLError } from './client'
export type { GraphQLRequestOptions } from './client'
export { TypedDocumentString } from './generated/graphql'

import type {
  CategoriesQuery,
  DocDraftQuery,
  DocsByLocaleQuery,
} from './generated/graphql'

/**
 * One published page, as the loader stores it and `@repo/ui` renders it. This
 * type — not Payload's own `payload-types.ts` — is the contract between the CMS
 * and the frontend: it describes exactly the fields the queries ask for.
 */
export type DocEntry = NonNullable<DocsByLocaleQuery['Docs']>['docs'][number]

/** The same page read as a draft; only `_status` is extra. */
export type DocDraftEntry = NonNullable<DocDraftQuery['Docs']>['docs'][number]

export type CategoryEntry = NonNullable<CategoriesQuery['Categories']>['docs'][number]

export type { CategoriesQuery, DocDraftQuery, DocsByLocaleQuery }

/**
 * The locale codes Payload accepts, straight from its schema. Typing the site's
 * locale list with it is what keeps `apps/web/src/site.ts` and the CMS's
 * `localization` config from drifting apart unnoticed.
 */
export type { LocaleInputType } from './generated/graphql'
