# astro-payload-lagoon

Proof of concept: a developer documentation site with content managed in
**Payload CMS**, rendered statically by **Astro**, with an **instant live
preview** of drafts driven from the Payload admin panel. Deployment target is
**Lagoon** (amazee.io).

Content travels over **GraphQL**, and the frontend renders Payload's Lexical
JSON itself — no `@payloadcms/*` package ends up in the Astro build.

```
apps/cms                   Payload 3 on Next.js — admin, API, GraphQL
apps/web                   Astro 7 hybrid site: static pages + on-demand preview
packages/ui                React components: DocPage, the Lexical serializer, blocks
packages/graphql           GraphQL documents and their generated types
packages/payload-loader    Content Layer loaders, over GraphQL
lagoon/                    Deployment Dockerfiles
docker-compose.dev.yml     Local PostgreSQL (development only)
docker-compose.yml         Lagoon service manifest (not for local use)
.lagoon.yml                Routes and post-rollout tasks
```

## Getting started

Requires Docker (for PostgreSQL) and Node ≥ 22.

```bash
cp .env.example .env    # then set PREVIEW_SECRET and PREVIEW_API_KEY
pnpm install
pnpm dev                # PostgreSQL + Payload (:3000) + Astro (:4321)
```

In another terminal, once:

```bash
pnpm seed               # admin user, preview user, 2 categories, 6 pages en/fr
```

- Admin panel: <http://localhost:3000/admin>
- Site: <http://localhost:4321>

Admin credentials come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in
`.env`.

Public pages are static: after editing in the admin panel, restart `astro dev` or
run `pnpm build:web` to see the change on the public URL. The live preview, on
the other hand, is instant — see below.

> Astro 7 detects coding-agent environments (Claude Code, Cursor, …) and starts
> `astro dev` there as a detached background process. Under `concurrently` the
> `web` pane then exits immediately and an orphaned server keeps port 4321.
> `pnpm --filter web exec astro dev stop` releases it. In a normal terminal the
> behaviour is the expected one.

`pnpm build`, `pnpm typecheck`, `pnpm generate:types` and `pnpm generate:graphql`
all query the CMS, so they need `pnpm dev` running (or at least PostgreSQL and
Payload).

## How content reaches Astro

Page bodies are Lexical rich text, and the frontend consumes that JSON directly:
`packages/ui/src/RichText.tsx` is a hand-written serializer turning serialized
Lexical nodes into React elements.

Why not import Payload's own converter? `@payloadcms/richtext-lexical` pulls
`payload`, `@payloadcms/next` and `@payloadcms/ui` through its peer dependencies
— an entire CMS inside a static site. What crosses the wire is plain JSON, so a
structural description of it (`packages/ui/src/lexical/types.ts`) is enough.

The virtual `markdown` field (`apps/cms/src/fields/markdown.ts`) is still there
and still computed on read. It is no longer used for rendering, but it remains
the cheapest way to feed search, an LLM or an export.

The queries themselves live in `packages/graphql/src/documents.ts`, and
`pnpm generate:graphql` types them against the running schema. Those generated
types — not `apps/cms/src/payload-types.ts` — are the contract between the CMS
and the frontend: they describe exactly the fields the frontend asks for. The
output is committed, so a build never has to fetch the schema.

`payloadDocsLoader` and `payloadCategoriesLoader` take the build-time snapshot,
one entry per locale and slug. A CMS with nothing published fails the build on
purpose: an empty site deploys without error and breaks production silently. Set
`PAYLOAD_ALLOW_EMPTY=true` for the very first build of a blank environment.

The Lexical editor has no built-in code block. We enable `CodeBlock`, the block
Payload ships, with a language list restricted to identifiers a highlighter will
recognise (`bash` rather than `shell` — see `apps/cms/src/payload.config.ts`).

## Live preview

Open any doc page in the admin panel and the Live Preview panel shows the Astro
site in an iframe. Typing in `title` or `body` updates it without saving.

The whole mechanism:

1. `admin.livePreview.url` in `apps/cms/src/payload.config.ts` builds
   `${PREVIEW_URL}/preview/${locale}/${slug}?secret=${PREVIEW_SECRET}` and points
   the iframe at it. It returns `null` for a document with no slug — a brand new
   one — so "create new" does not load a broken URL.
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
   `credentials: 'include'`. Payload runs it through `findByID` — hooks fire,
   relationships get populated — and returns the complete document, which the
   island renders with the very same `DocPage` component the static pages use.

Things that will bite you if you change them:

- `serverURL` handed to the island must be the **exact origin** of the admin
  (`http://localhost:3000`, no trailing slash): the SDK compares it against
  `event.origin`.
- `depth` in `useLivePreview` must match the depth of the initial fetch. The
  GraphQL query expands `category` one level, hence `depth: 1`; a mismatch makes
  relationships vanish as soon as the first message arrives.
- `PREVIEW_URL` has to be in Payload's `cors` **and** `csrf` lists, which
  `payload.config.ts` does for you. Forget it and the SDK's POST fails silently:
  the callback simply never fires. Check the browser console first.
- The layout (`Site.astro`) sits outside the island, so the navigation and the
  title bar do not update live — only the document does. That is deliberate.
- `versions.drafts.autosave.interval` on the `docs` collection is what persists a
  draft version in the background; the preview itself does not need a save.

The preview never gets cached or indexed: the route sets `Cache-Control:
no-store` and `X-Robots-Tag: noindex, nofollow`, and the page carries a
`noindex` meta tag.

## Rendering: static pages, one dynamic route

`apps/web` is a hybrid: `output: 'static'` plus the node adapter. Everything is
prerendered except `/preview/*`, the only route that opts out.

Public pages render `DocPage` **without a client directive**: React runs at build
time and the HTML ships with zero JavaScript. The preview route renders the same
component inside an island. One serializer for both is what makes the preview
trustworthy.

`/preview` is a namespace of its own rather than a query flag on the public URL,
because `export const prerender` only takes a literal — a prerendered route
cannot decide per request — and middleware does not run for prerendered pages in
production.

After `pnpm build`:

```bash
pnpm --filter web start     # node ./dist/server/entry.mjs
```

serves `dist/client` (the static pages) and answers `/preview/*` on demand.

## i18n

Locales are declared twice and must stay in sync: `localization` in
`apps/cms/src/payload.config.ts`, and `LOCALES` in `apps/web/src/site.ts`. The
latter is typed with `LocaleInputType`, generated from Payload's own schema, so a
locale added on one side and forgotten on the other is a type error rather than a
silent 404.

English is served at the root, French under `/fr/`. `apps/web/src/routes.ts` is
the single place that knows that scheme.

## Environment variables

One `.env` at the repo root, read by both apps. See `.env.example`.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URI` | CMS | PostgreSQL connection string. Locally, the container from `docker-compose.dev.yml`. |
| `PAYLOAD_SECRET` | CMS | Signs the admin session. |
| `NEXT_PUBLIC_SERVER_URL` | CMS, web | Public origin of the CMS. Required in production: without it Payload's CSRF list is wrong and the admin panel rejects its own writes. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed | Administrator created by `pnpm seed`. |
| `PREVIEW_URL` | CMS | Origin of the Astro site; added to the CORS/CSRF allowlists and used to build the preview URL. |
| `PREVIEW_SECRET` | CMS, web | Guards `/preview/*`. Any long random string. |
| `PREVIEW_API_KEY` | seed, web | API key of the preview user. Server-side only — never exposed to the browser. |
| `PAYLOAD_GRAPHQL_URL` | web | Payload's GraphQL endpoint. |
| `SITE_URL` | web | Public URL of the site. |
| `DOCS_ENTRY_SLUG` | web | Page the home page links to (default `introduction`). |
| `PAYLOAD_ALLOW_EMPTY` | web | Allows a build with nothing published. |

## Deploying to Lagoon

**Not covered by this pass.** The manifests still describe the previous
architecture and were only updated where the database switch broke them outright;
each open point carries a `TODO (deployment)` comment. What is known:

- Three services: `cms` (`node`), `web` (`node-persistent`) and `postgres`.
- Lagoon builds images **before** deploying them, so the site cannot be generated
  at `docker build` time — it is built after the rollout by the `post-rollout`
  tasks in `.lagoon.yml`, once `cms` answers on its internal name.
- The site is no longer purely static: `/preview/*` needs the node server from
  `dist/server/entry.mjs`. Serving both from the `web` service works locally; the
  split has not been tested on a cluster.
- With the Postgres adapter the schema is pushed automatically in development
  only. A shared environment needs real migrations (`payload migrate`) before
  anything writes.
- The variables Lagoon injects for its database service still have to be mapped
  in `apps/cms/src/lib/databaseUri.ts`, which today only reads `DATABASE_URI`.

## Out of scope

- Lagoon deployment (above).
- Payload media persistence in production (dedicated volume or S3).
- Syntax highlighting worthy of the name — `CodeBlock` renders
  `<pre><code class="language-…">` and stops there.
- Search, SEO plugin, CI pipeline.
- AI features: see `docs/feasibility-preview-ai.md`.
