/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {\n    Docs(\n      locale: $locale\n      limit: $limit\n      sort: \"sidebarOrder\"\n      where: { _status: { equals: published } }\n    ) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        category {\n          id\n          name\n          slug\n        }\n      }\n      totalDocs\n    }\n  }\n": typeof types.DocsByLocaleDocument,
    "\n  query DocDraft($slug: String!, $locale: LocaleInputType!) {\n    Docs(where: { slug: { equals: $slug } }, locale: $locale, draft: true, limit: 1) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        _status\n        category {\n          id\n          name\n          slug\n        }\n      }\n    }\n  }\n": typeof types.DocDraftDocument,
    "\n  query Categories($locale: LocaleInputType!) {\n    Categories(locale: $locale, limit: 100, sort: \"order\") {\n      docs {\n        id\n        name\n        slug\n        order\n      }\n    }\n  }\n": typeof types.CategoriesDocument,
};
const documents: Documents = {
    "\n  query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {\n    Docs(\n      locale: $locale\n      limit: $limit\n      sort: \"sidebarOrder\"\n      where: { _status: { equals: published } }\n    ) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        category {\n          id\n          name\n          slug\n        }\n      }\n      totalDocs\n    }\n  }\n": types.DocsByLocaleDocument,
    "\n  query DocDraft($slug: String!, $locale: LocaleInputType!) {\n    Docs(where: { slug: { equals: $slug } }, locale: $locale, draft: true, limit: 1) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        _status\n        category {\n          id\n          name\n          slug\n        }\n      }\n    }\n  }\n": types.DocDraftDocument,
    "\n  query Categories($locale: LocaleInputType!) {\n    Categories(locale: $locale, limit: 100, sort: \"order\") {\n      docs {\n        id\n        name\n        slug\n        order\n      }\n    }\n  }\n": types.CategoriesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {\n    Docs(\n      locale: $locale\n      limit: $limit\n      sort: \"sidebarOrder\"\n      where: { _status: { equals: published } }\n    ) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        category {\n          id\n          name\n          slug\n        }\n      }\n      totalDocs\n    }\n  }\n"): typeof import('./graphql').DocsByLocaleDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DocDraft($slug: String!, $locale: LocaleInputType!) {\n    Docs(where: { slug: { equals: $slug } }, locale: $locale, draft: true, limit: 1) {\n      docs {\n        id\n        slug\n        title\n        description\n        body\n        sidebarLabel\n        sidebarOrder\n        updatedAt\n        _status\n        category {\n          id\n          name\n          slug\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').DocDraftDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Categories($locale: LocaleInputType!) {\n    Categories(locale: $locale, limit: 100, sort: \"order\") {\n      docs {\n        id\n        name\n        slug\n        order\n      }\n    }\n  }\n"): typeof import('./graphql').CategoriesDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
