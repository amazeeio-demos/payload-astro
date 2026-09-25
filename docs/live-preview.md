# Live preview

Open any doc page in the admin panel and the Live Preview panel shows the Astro
site in an iframe. Typing in `title` or `body` updates it without saving.

## How it works

1. `admin.livePreview.url` in `apps/cms/src/payload.config.ts` builds
   `${PREVIEW_URL}/preview/${locale}/${slug}?secret=${PREVIEW_SECRET}` and points
   the iframe at it. It returns `null` for a document with no slug (a brand new
   one), so "create new" does not load a broken URL.
2. `apps/web/src/pages/preview/[locale]/[slug].astro` opts out of prerendering
   (`export const prerender = false`), compares the secret, and reads the draft
   over GraphQL with the API key of the `preview@example.com` user. Payload's
   `authenticatedOrPublished` access grants drafts to any authenticated request,
   and an API key counts as one.
3. `apps/web/src/components/PreviewIsland.tsx` hydrates in the browser
   (`client:only="react"`) and calls `useLivePreview`, which tells the admin it
   is ready and then receives every form change over `postMessage`.
4. On each change the SDK POSTs the unsaved document back to
   `${CMS_URL}/api/docs/${id}` with `X-Payload-HTTP-Method-Override: GET` and
   `credentials: 'include'`. Payload runs it through `findByID`, so hooks fire
   and relationships get populated. It returns the complete document, which the
   island renders with the very same `DocPage` component the static pages use.

## What breaks it

- The `serverURL` handed to the island must be the **exact origin** of the
  admin (`http://localhost:3000`, no trailing slash): the SDK compares it
  against `event.origin`.
- `depth` in `useLivePreview` must match the depth of the initial fetch. The
  GraphQL query expands `category` one level, hence `depth: 1`. A mismatch makes
  relationships vanish as soon as the first message arrives.
- `PREVIEW_URL` has to be in Payload's `cors` **and** `csrf` lists, which
  `payload.config.ts` does for you. If it is missing, the SDK's POST fails
  silently and the callback never fires. Check the browser console first.
- The layout (`Site.astro`) sits outside the island, so the navigation and the
  title bar do not update live. Only the document does. That is deliberate.
- `versions.drafts.autosave.interval` on the `docs` collection is what persists
  a draft version in the background. The preview itself does not need a save.

The preview is never cached or indexed: the route sets `Cache-Control:
no-store` and `X-Robots-Tag: noindex, nofollow`, and the page carries a
`noindex` meta tag.
