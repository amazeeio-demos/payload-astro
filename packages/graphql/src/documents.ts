import { graphql } from './generated'

/**
 * The three queries the frontend sends to Payload.
 *
 * They live here rather than next to their call sites so that codegen has a
 * single glob to scan, and so that the shape of what Astro reads is visible in
 * one place.
 */

/**
 * Published pages of one locale — the build-time snapshot behind every static
 * page. Read anonymously: `authenticatedOrPublished` narrows the result to
 * published documents on its own, the explicit `where` only avoids relying on
 * that.
 */
export const DocsByLocaleDocument = graphql(`
  query DocsByLocale($locale: LocaleInputType!, $limit: Int!) {
    Docs(
      locale: $locale
      limit: $limit
      sort: "sidebarOrder"
      where: { _status: { equals: published } }
    ) {
      docs {
        id
        slug
        title
        description
        body
        sidebarLabel
        sidebarOrder
        updatedAt
        category {
          id
          name
          slug
        }
      }
      totalDocs
    }
  }
`)

/**
 * One page, drafts included — the preview route only.
 *
 * `draft: true` alone is not enough: without an authenticated request Payload
 * still applies `authenticatedOrPublished` and returns nothing. The route sends
 * the preview user's API key server-side.
 *
 * The selection has to stay depth-1 (`category` expanded one level and no
 * further), because the live-preview SDK is told the same depth: a mismatch
 * makes relationships vanish as soon as the first message arrives.
 */
export const DocDraftDocument = graphql(`
  query DocDraft($slug: String!, $locale: LocaleInputType!) {
    Docs(where: { slug: { equals: $slug } }, locale: $locale, draft: true, limit: 1) {
      docs {
        id
        slug
        title
        description
        body
        sidebarLabel
        sidebarOrder
        updatedAt
        _status
        category {
          id
          name
          slug
        }
      }
    }
  }
`)

/** Categories of one locale, in sidebar order — used to group the navigation. */
export const CategoriesDocument = graphql(`
  query Categories($locale: LocaleInputType!) {
    Categories(locale: $locale, limit: 100, sort: "order") {
      docs {
        id
        name
        slug
        order
      }
    }
  }
`)
