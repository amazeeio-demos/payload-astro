# HANDOFF — Payload live preview on an Astro hybrid frontend

Handoff for Claude Code. Written 2026-08-21 after two feasibility studies (in
French, not published in this repository). Everything below was verified against
Payload 3.88 / Astro 7.2 sources and docs on that date.

Repository conventions: English for code, comments, commit messages and docs.
Keep the existing style (explanatory comments that state *why*, not *what*).

## 1. Goal

Replace the Starlight frontend with a plain Astro 7 site whose public pages are
prerendered (SSG) from Payload, and add an **instant live preview** of drafts
driven from the Payload admin panel (iframe + `postMessage`), without a separate
preview application. Deliver a working local POC; Lagoon deployment is out of
scope for this pass.

## 2. Decisions already taken (do not reopen)

| Topic | Decision |
|---|---|
| Frontend | Astro 7 hybrid: `output: 'static'` + `@astrojs/node` (standalone) + `@astrojs/react`. Public routes prerendered, `/preview/*` rendered on demand. |
| Rendering components | React, in a new workspace package `packages/ui`. Public pages render them server-only (no client directive → zero JS). The preview route hydrates the same components inside one island. |
| Rich text | Frontend consumes **Lexical JSON** (`body` over GraphQL) and renders it with a **hand-written serializer** in `packages/ui`. No `@payloadcms/*` dependency in the frontend. Keep the virtual `markdown` field on the CMS side (still useful for search/LLM/export) but stop using it for rendering. |
| Live preview | Client-side, instant: `@payloadcms/live-preview-react` `useLivePreview` in a `client:only="react"` island on the preview route. |
| Preview auth | `PREVIEW_SECRET` in the preview URL + a Payload service user with an API key used server-side by Astro to read drafts. |
| Types | GraphQL codegen (`@graphql-codegen/cli`) in `packages/graphql`; these types are the contract of `packages/ui`. |
| Payload | Upgrade to 3.88.x (all `@payloadcms/*` pinned to the same version). |
| Database (local) | Switch to PostgreSQL via `@payloadcms/db-postgres` (Docker Compose for local dev). `packages/mongo-dev` is removed. |
| Starlight | Removed entirely. `@repo/payload-loader` is kept but simplified (no Starlight schema, no `renderMarkdown`). |
| Deployment | Not now. Leave `lagoon/`, `.lagoon.yml`, `docker-compose.yml` untouched except where the DB switch breaks them obviously; add a TODO rather than redesigning. |

## 3. Target layout

```
apps/cms                     Payload 3.88 (Next 16) — unchanged shape, + livePreview, + Postgres
apps/web                     Astro 7 hybrid site (replaces the Starlight app)
  astro.config.mjs           output 'static', adapter node standalone, react()
  src/content.config.ts      docs collection via @repo/payload-loader (build-time snapshot)
  src/pages/[...path].astro  prerendered; getStaticPaths from the collection
  src/pages/preview/[locale]/[slug].astro   prerender = false; secret check; draft fetch
  src/components/PreviewIsland.tsx          useLivePreview → <DocPage/>
  src/layouts/Site.astro     html shell, nav, locale switch (Astro, not React)
packages/ui                  React: DocPage, RichText (Lexical serializer), blocks
packages/graphql             codegen config, generated types, shared documents
packages/payload-loader      Astro loader over GraphQL (simplified)
```

URL scheme stays as today: English at the root (`/introduction`), French under
`/fr/introduction`. Preview: `/preview/en/introduction`, `/preview/fr/introduction`.

## 4. Work plan

Work in this order; each step leaves the repo green (`pnpm typecheck`, `pnpm build`).

### Step 0 — Upgrade and database

1. Bump `payload`, `@payloadcms/next`, `@payloadcms/richtext-lexical`,
   `@payloadcms/ui` to the latest 3.88.x (same version everywhere). Check the
   release notes between 3.86 and 3.88 for config changes.
2. Replace `@payloadcms/db-mongodb` with `@payloadcms/db-postgres`
   (`postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI } })`).
   Local Postgres via a `docker-compose.dev.yml` (or `packages/postgres-dev` if a
   no-Docker setup is wanted — Docker is fine for this POC). Update `.env.example`
   (`DATABASE_URI=postgres://payload:payload@localhost:5432/payload`), root
   `dev`/`dev:db` scripts, README. Remove `packages/mongo-dev` and
   `apps/cms/src/lib/mongoUri.ts` (replace by a small `resolveDatabaseUri` that
   only reads `DATABASE_URI` for now; leave a TODO for Lagoon's injected vars).
3. Check `apps/cms/src/seed/*` — `ensureCollections.ts` / `prepare.ts` may be
   Mongo-specific (replica set / collection creation). Postgres with
   `push: true` (dev default) needs none of that; drop what no longer applies.
4. `pnpm seed` must still create the admin user, 2 categories, 6 pages en/fr.

### Step 1 — Payload: preview plumbing

In `apps/cms/src/payload.config.ts` and `collections/Docs.ts`:

```ts
// payload.config.ts
admin: {
  user: Users.slug,
  livePreview: {
    collections: ['docs'],
    url: ({ data, locale }) => {
      const slug = data?.slug
      if (!slug) return null // new, unsaved doc: no preview yet
      const code = typeof locale === 'string' ? locale : locale?.code ?? 'en'
      return `${process.env.PREVIEW_URL}/preview/${code}/${slug}?secret=${process.env.PREVIEW_SECRET}`
    },
    breakpoints: [
      { name: 'mobile', label: 'Mobile', width: 375, height: 667 },
      { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
    ],
  },
},
```

```ts
// Docs.ts
versions: { drafts: { autosave: { interval: 375 } } },
```

Notes:
- `url` runs on every form change when autosave is on; keep it cheap and sync.
- `cors` / `csrf` already include `http://localhost:4321` via `allowedOrigins`;
  add `PREVIEW_URL` to that list so a different preview host works later.
- Add to `Users`: `auth: { useAPIKey: true }` (keep the rest). The seed creates a
  second user `preview@example.com` with `enableAPIKey: true` and a fixed
  `apiKey` from `PREVIEW_API_KEY` (Payload hashes/stores it; passing `apiKey` in
  `payload.create` works). Existing access `authenticatedOrPublished` already
  grants drafts to any authenticated user — good enough for the POC.
- New env vars (root `.env.example`): `PREVIEW_URL=http://localhost:4321`,
  `PREVIEW_SECRET=…`, `PREVIEW_API_KEY=…` (a UUID).
- GraphQL draft read, to be used by the Astro preview route:

```graphql
query DocDraft($slug: String!, $locale: LocaleInputType!) {
  Docs(where: { slug: { equals: $slug } }, locale: $locale, draft: true, limit: 1) {
    docs { id slug title description body category { id title slug } updatedAt _status }
  }
}
```
  sent with header `Authorization: users API-Key <PREVIEW_API_KEY>`.
  Verify with curl that the same query *without* the header returns only the
  published version (or nothing for a never-published page).

### Step 2 — `packages/graphql` (codegen)

- `@graphql-codegen/cli`, `@graphql-codegen/typescript`,
  `@graphql-codegen/typescript-operations`, `@graphql-codegen/typed-document-node`.
- `codegen.ts`: schema `http://localhost:3000/api/graphql`, documents
  `src/documents/*.graphql`, output `src/generated/`. Script `pnpm generate:graphql`
  at the root (requires the CMS running, like `generate:types`). Commit the
  generated files so the frontend builds without the CMS schema fetch.
- Documents: `DocsByLocale` (published list, used by the loader), `DocDraft`
  (above), `Categories`.
- Lexical `body` arrives as the `JSON` scalar → `unknown`. `packages/ui` owns
  the node types (see Step 3); do not import them from `@payloadcms/*`.

### Step 3 — `packages/ui` (React 19)

Dependencies: `react`, `react-dom` only. `exports` map pointing at `src/*.tsx`
like `@repo/payload-loader` does (workspace TS sources, no build step).

- `lexical/types.ts`: minimal serialized node types — `root`, `paragraph`,
  `heading` (tag h1–h6), `text` (with `format` bitmask: 1 bold, 2 italic,
  4 strikethrough, 8 underline, 16 code, 32 subscript, 64 superscript),
  `linebreak`, `tab`, `link` / `autolink` (`fields.url`, `fields.newTab`,
  `fields.linkType` 'custom' | 'internal', `fields.doc`), `list` (`listType`
  bullet | number | check, `tag`), `listitem` (`value`, `checked`), `quote`,
  `horizontalrule`, `upload` (`value` populated media with `url`, `alt`,
  `width`, `height`), `block` (`fields.blockType`, then block-specific fields).
- `RichText.tsx`: recursive serializer `nodes → ReactNode`, with a
  `converters` prop to override/extend per node type and a `blocks` map
  `{ [blockType]: Component }`. Unknown node → `null` plus a `console.warn` in
  dev. Apply `format` via nested `<strong>`/`<em>`/… ; `indent` via a CSS var.
- `blocks/CodeBlock.tsx`: `<pre><code class="language-{language}">`. Syntax
  highlighting is a follow-up (Shiki at build time for public pages; in the
  island keep plain `<pre>` or load Shiki lazily) — not required for the POC.
- `DocPage.tsx`: `{ doc: DocFragment; locale: string }` → title, description,
  `<RichText data={doc.body} />`. Keep it presentational; no fetching.
- `internalDocToHref({ relationTo, value })` helper for internal links:
  `docs` → `/${locale === 'en' ? '' : locale + '/'}${slug}`.

### Step 4 — `apps/web` rewrite (without Starlight)

- Remove `@astrojs/starlight`, `sirv-cli`; add `@astrojs/node`, `@astrojs/react`,
  `react`, `react-dom`, `@repo/ui`, `@repo/graphql`, `@payloadcms/live-preview-react`.
- `astro.config.mjs`: `output: 'static'`, `adapter: node({ mode: 'standalone' })`,
  `integrations: [react()]`, `site: SITE_URL`. Drop `fetchStarlightSidebar`; the
  navigation is built in the layout from the `docs`/`categories` collections.
- Loader: rewrite `payloadDocsLoader` to store `{ slug, locale, title,
  description, body (JSON), category, sidebarLabel, sidebarOrder, updatedAt }`
  with id `${locale}/${slug}`; no `parseData` against Starlight's schema (define
  a small zod schema in `content.config.ts` instead), no `renderMarkdown`, no
  synthetic `filePath`. Keep the "fail the build when nothing is published"
  behaviour and `PAYLOAD_ALLOW_EMPTY`.
- `src/pages/[...path].astro` (prerendered): `getStaticPaths()` from
  `getCollection('docs')`; `path` = `slug` for `en`, `fr/slug` for `fr`. Renders
  `<Site><DocPage doc={entry.data} locale={…} /></Site>` — **no client directive**.
- `src/pages/[...locale]/index.astro`: keep a simple home page per locale
  (links to the first doc and to the admin), now on the new layout.
- Keep `site.ts` (`LOCALES`, `DEFAULT_LOCALE`, `PAYLOAD_GRAPHQL_URL`, …) and add
  `PREVIEW_SECRET`, `PREVIEW_API_KEY` readers (server-only; never expose through
  `import.meta.env.PUBLIC_*`).
- `package.json` scripts: `dev: astro dev`, `build: astro build`,
  `start: node ./dist/server/entry.mjs` (replaces `serve`).

### Step 5 — Preview route + island

`src/pages/preview/[locale]/[slug].astro`:

```astro
---
export const prerender = false

import { graphqlRequest } from '@repo/payload-loader'  // or a fetch in @repo/graphql
import { DocDraftDocument } from '@repo/graphql'
import PreviewIsland from '../../../components/PreviewIsland'
import Site from '../../../layouts/Site.astro'
import { PAYLOAD_GRAPHQL_URL, PREVIEW_API_KEY, PREVIEW_SECRET, LOCALES } from '../../../site'

const { locale, slug } = Astro.params
if (Astro.url.searchParams.get('secret') !== PREVIEW_SECRET || !LOCALES.includes(locale)) {
  return new Response('Not found', { status: 404 })
}
const data = await graphqlRequest(PAYLOAD_GRAPHQL_URL, DocDraftDocument, { slug, locale }, {
  Authorization: `users API-Key ${PREVIEW_API_KEY}`,
})
const doc = data.Docs.docs[0]
if (!doc) return new Response('Not found', { status: 404 })
Astro.response.headers.set('Cache-Control', 'no-store')
Astro.response.headers.set('X-Robots-Tag', 'noindex')
---
<Site locale={locale} preview>
  <PreviewIsland client:only="react" initialData={doc} locale={locale} serverURL={CMS_URL} />
</Site>
```

`graphqlRequest` needs an optional `headers` argument — add it.

`src/components/PreviewIsland.tsx`:

```tsx
import { useLivePreview } from '@payloadcms/live-preview-react'
import { DocPage } from '@repo/ui'

export default function PreviewIsland({ initialData, locale, serverURL }) {
  const { data } = useLivePreview({ initialData, serverURL, depth: 1 })
  return <DocPage doc={data} locale={locale} />
}
```

Facts that matter here:
- `serverURL` must be the **exact origin** of the admin (`http://localhost:3000`,
  no trailing slash): the SDK checks `event.origin === serverURL`.
- `depth` must equal the depth of the data you fetched initially (GraphQL
  nested selection of `category` = depth 1). Mismatch → relationships disappear
  while typing.
- On each form change the SDK POSTs the unsaved data to
  `${serverURL}/api/docs/${id}` with `X-Payload-HTTP-Method-Override: GET` and
  `credentials: 'include'`; Payload runs `findByID` on that data (hooks run,
  relations populated) and returns the full doc. This is why `cors`/`csrf` must
  list the preview origin. On `localhost` the admin cookie is sent fine.
- The island must call `ready()` — `useLivePreview` does it. Nothing is sent by
  the admin before that.
- The layout (`Site.astro`) is not inside the island, so it does not update
  live; only the document does. That is expected for the POC.

### Step 6 — Local run

`pnpm dev` → Postgres + CMS (:3000) + Astro dev (:4321). In Astro dev every
route is on demand, so the preview works without a build. Then also verify the
production path: `pnpm build` (CMS running) and `pnpm --filter web start`,
check that `dist/client/introduction/index.html` exists (static) and that
`/preview/en/introduction?secret=…` is served by the node server.

## 5. Acceptance criteria

1. `pnpm install && pnpm dev && pnpm seed` on a clean checkout gives a working
   admin and site with no Starlight left in the tree.
2. Opening a doc in the admin shows the Live Preview panel; typing in `title` or
   `body` updates the iframe without saving. Switching locale in the admin
   reloads the iframe on the other locale.
3. `/preview/en/introduction` without the secret → 404. With the secret but for
   a never-published draft → the draft is shown.
4. `pnpm build` prerenders every published page for both locales under
   `dist/client/`; no page under `/preview` is prerendered.
5. Public pages ship no JavaScript except what the layout deliberately adds.
6. `pnpm typecheck` passes in all workspaces; generated GraphQL types are
   committed.
7. README updated: architecture, env vars, how preview works, what is out of
   scope (Lagoon, code highlighting, media persistence).

## 6. Known pitfalls (verified)

- `export const prerender` accepts only a literal `true`/`false` per file; no
  expressions. Middleware does not run at request time for prerendered pages in
  production; `Astro.rewrite()` does not work on prerendered routes. Hence the
  `/preview` namespace rather than a "same URL, two modes" trick.
- Route priority: `/preview/[locale]/[slug]` beats `/[...path]`; make sure
  `getStaticPaths()` never emits a path starting with `preview`.
- Astro 7: HTML compression default is `'jsx'` (whitespace between inline
  elements is dropped — use `{' '}` in JSX where it matters); Node ≥ 22.12;
  unclosed tags are build errors.
- `@payloadcms/live-preview-react` peer deps are only `react`/`react-dom`
  (16.8–19); safe. Do **not** add `@payloadcms/richtext-lexical` to the frontend
  (it pulls `payload`, `@payloadcms/next`, `@payloadcms/ui` through peers).
- `livePreview.url` must return `null` for documents without a slug, otherwise
  the iframe loads a broken URL on "create new".
- Payload's `csrf` list: forgetting the preview origin makes the SDK's POST fail
  silently (the callback never fires). Check the browser console first.
- Postgres dev adapter uses `push: true` by default (schema synced on boot);
  fine for the POC, but generate migrations before any shared environment.
- `generate:graphql`, `generate:types`, `typecheck` and `build` all need the CMS
  running — same constraint as today, document it.

## 7. Out of scope for this pass

Lagoon deployment (needs a node service for the preview route or a static +
node split), media storage in production, Shiki/Expressive-Code-grade code
highlighting, search, SEO plugin, AI features.

**Roles and access control** are also out of scope for this pass, but they are
needed before any shared environment. Verified state today: `Docs` and
`Categories` gate writes behind `authenticated`, while `Media` and `Users`
declare no access rules at all — so any signed-in account can edit or delete any
document *and* manage user accounts. That also means the `preview@` service user
from Step 1, whose API key only needs to read drafts, currently has full write
access to the CMS. The proposed fix is an admin/editor/viewer scheme (a
`roles` field on the auth collection plus access functions, ~100 lines), with
four decisions to take first — including which role the preview service user
should get (§ 2 above gives it an API key, not a role). Settle it before the POC
is exposed beyond localhost.

A comparison of Payload with Drupal habits, which stress-tested a Payload
starter on Vercel, found traps that bear directly on this plan, notably: a Lexical node type that is not
enabled in the editor config breaks the admin panel while the frontend still
renders it (relevant to the hand-written serializer in `packages/ui`), and
adding any Lexical feature also requires `generate:importmap`.
