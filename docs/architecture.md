# Architecture

```
apps/cms                   Payload 3 on Next.js: admin, API, GraphQL, AI assistant
apps/web                   Astro 7 hybrid site: static pages + on-demand preview
packages/ui                React components: DocPage, the Lexical serializer, blocks
packages/graphql           GraphQL documents and their generated types
packages/payload-loader    Content Layer loaders, over GraphQL
lagoon/                    Deployment Dockerfiles
docker-compose.dev.yml     Local PostgreSQL (development only)
docker-compose.yml         Lagoon service manifest (not for local use)
.lagoon.yml                Routes and post-rollout tasks
```

Content travels over **GraphQL**, and the frontend renders Payload's Lexical
JSON itself. No `@payloadcms/*` package ends up in the Astro build, apart from
the live preview client SDK.

## How content reaches Astro

Page bodies are Lexical rich text, and the frontend consumes that JSON directly:
`packages/ui/src/RichText.tsx` is a hand-written serializer turning serialized
Lexical nodes into React elements.

Why not import Payload's own converter? `@payloadcms/richtext-lexical` pulls in
`payload`, `@payloadcms/next` and `@payloadcms/ui` through its peer
dependencies, which would put an entire CMS inside a static site. What crosses
the wire is plain JSON, so a structural description of it
(`packages/ui/src/lexical/types.ts`) is enough.

The virtual `markdown` field (`apps/cms/src/fields/markdown.ts`) is still there
and still computed on read. It is no longer used for rendering, but it remains
the cheapest way to feed search, an LLM or an export.

The queries live in `packages/graphql/src/documents.ts`, and
`pnpm generate:graphql` types them against the running schema. Those generated
types are the contract between the CMS and the frontend, not
`apps/cms/src/payload-types.ts`: they describe exactly the fields the frontend
asks for. The output is committed, so a build never has to fetch the schema.
Adding a field to the frontend means editing a document and regenerating.

`payloadDocsLoader` and `payloadCategoriesLoader` take the build-time snapshot,
one entry per locale and slug. A CMS with nothing published fails the build on
purpose: an empty site deploys without error and breaks production silently.
Set `PAYLOAD_ALLOW_EMPTY=true` for the very first build of a blank environment.

The Lexical editor has no built-in code block. We enable `CodeBlock`, the block
Payload ships, with a language list restricted to identifiers a highlighter will
recognise (`bash` rather than `shell`, see `apps/cms/src/payload.config.ts`).

## Rendering: static pages, one dynamic route

`apps/web` is a hybrid: `output: 'static'` plus the node adapter. Everything is
prerendered except `/preview/*`, the only route that opts out.

Public pages render `DocPage` **without a client directive**: React runs at
build time and the HTML ships with zero JavaScript. The preview route renders
the same component inside an island. Using one serializer for both is what makes
the preview trustworthy.

`/preview` is a namespace of its own rather than a query flag on the public URL,
because `export const prerender` only takes a literal (a prerendered route
cannot decide per request), and middleware does not run for prerendered pages in
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
locale added on one side and forgotten on the other is a type error rather than
a silent 404.

English is served at the root, French under `/fr/`. `apps/web/src/routes.ts` is
the single place that knows that scheme.

## Out of scope

- Payload media persistence in production (dedicated volume or S3).
- Proper syntax highlighting: `CodeBlock` renders
  `<pre><code class="language-…">` and stops there.
- Search, SEO plugin, CI pipeline.
- Roles: any logged-in user can edit everything.
- AI beyond the editor assistant: alt text, embeddings on the amazee.ai pgvector
  database, semantic search.
