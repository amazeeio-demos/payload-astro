# Payload Astro on Lagoon with amazee.ai

Demo of a developer documentation site with content managed in
**Payload CMS**, rendered statically by **Astro**, with an **instant live
preview** of drafts driven from the Payload admin panel. Deployment target is
**Lagoon** (amazee.io), with the optional use of amazee.ai private gateway to enhance
the editorial workflow with [payload-ai](https://github.com/ashbuilds/payload-ai).

Content travels over **GraphQL**, and the frontend renders Payload's Lexical
JSON itself — no `@payloadcms/*` package ends up in the Astro build.

```
apps/cms                   Payload 3 on Next.js — admin, API, GraphQL, AI assistant
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

## AI assistant (amazee.ai)

Doc pages get an assistant in the admin panel: **Compose**, **Proofread**,
**Translate** and **Rephrase** in the `body` editor, and a *Compose* action under
`title`, `description` and `sidebarLabel`. The model runs behind the
[amazee.ai private gateway](https://docs.amazee.ai), never at a public provider.

The feature is optional and off by default: without `AMAZEE_AI_API_TOKEN` neither
the plugin nor the editor menu is registered.

### Try it

1. Create a key at <https://my.amazee.io> (it is bound to one region) and put it
   in `.env` as `AMAZEE_AI_API_TOKEN`. If the region is not `de-eu101`, also set
   `AMAZEE_AI_BASE_URL=https://llm.<region>.amazee.ai/v1`.
2. Check the key before touching the CMS — the response lists the model ids the
   key may use:

   ```bash
   curl -H "Authorization: Bearer $AMAZEE_AI_API_TOKEN" \
     https://llm.de-eu101.amazee.ai/v1/models
   ```

3. Restart `pnpm dev`. On the first boot the plugin creates one *Compose
   Setting* per field (`docs.title`, `docs.description`, `docs.sidebarLabel`,
   `docs.body`) with the prompts from `apps/cms/src/ai/amazeeAi.ts`, and a
   `plugin-ai-instructions` table appears in PostgreSQL.
4. Open a doc page in the admin panel and click into a field. An AI bar appears
   under the focused field: *Compose* when it is empty, *Rephrase*, *Proofread*
   and *Translate* once it has content. In `body` the same actions work on the
   current selection.
5. The *Settings* entry of that bar opens the field's Compose Setting: prompt,
   model, temperature, max tokens. The model list is the gateway's own: the
   picker asks `/api/amazee-ai/models`, which proxies LiteLLM's `/model/info`
   with the token and keeps the `chat` models, cached for ten minutes. When the
   gateway cannot be reached the picker falls back to `AMAZEE_AI_MODELS`. Prompts are Handlebars templates over the
   document being edited: `{{ title }}`, `{{ description }}`,
   `{{ toHTML body }}` (HTML of the rich text field; the plugin has no working plain-text helper). Edits persist in the
   database, not in code.

### How it is wired

`@ai-stack/payloadcms` is a community plugin — Payload's core ships no LLM
client, only an MCP server that exposes the CMS to agents. It drives the Vercel
AI SDK, and its OpenAI provider accepts a custom base URL. The amazee.ai gateway
is a LiteLLM proxy, so the OpenAI protocol is all it needs.
`apps/cms/src/ai/amazeeAi.ts` does the rest:

- Reads `AMAZEE_AI_API_TOKEN` and `AMAZEE_AI_BASE_URL` into the plugin's `openai`
  provider — deliberately not the `OPENAI_*` names the plugin reads by default,
  so the private token can never reach api.openai.com.
- Replaces the plugin's hard-coded GPT model select with `ModelSelect`, a text
  field whose options come from the gateway (`apps/cms/src/ai/models.ts`), and
  keeps only text models: the gateway serves no image or speech endpoints.
- Seeds static prompts. The plugin would otherwise ask a model to *write* each
  field's prompt at boot, one request per field, against `gpt-4o-mini`.
- Restricts generation to logged-in users.

New fields start on the first entry of `AMAZEE_AI_MODELS`, by default `chat`, an
alias every region resolves. Explicit ids (`claude-5-sonnet`, `gpt-4.1`,
`mistral-large-latest`, …) depend on region and plan; a model that later
disappears from the gateway stays selectable, flagged as not listed.

Known limits: rich text generation asks the model for the whole Lexical JSON of
the field, constrained by a JSON schema, and streams it over the OpenAI
Responses API. Verified on `de-eu101` with `chat` and `claude-5-sonnet`; a small
open-weight model may return invalid JSON. Changing the token or the base URL
needs a restart: the CMS reads `.env` once, at boot.
Translate offers the CMS locales only (`en`, `fr`) and does not create a locale
version by itself — it rewrites the field in the locale you are editing. On Lagoon, set the same variables on the `cms`
service (`lagoon add variable`).

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
| `AMAZEE_AI_API_TOKEN` | CMS | amazee.ai key. Unset disables the AI assistant entirely. |
| `AMAZEE_AI_BASE_URL` | CMS | Gateway of the key's region, `https://llm.<region>.amazee.ai/v1`. Default `de-eu101`. |
| `AMAZEE_AI_MODELS` | CMS | Default model for new fields, and the picker's fallback when the gateway is unreachable. Default `chat,chat_with_complex_json`. |

## Deploying to Lagoon

Three services, declared in `docker-compose.yml` for Lagoon only (local
development never uses Docker for the apps): `cms` (`node`), `web`
(`node-persistent`, the build output on a volume) and `postgres`. Environments
are `prod` and `dev` (`.lagoon.yml`), routes are autogenerated.

Lagoon builds images **before** deploying them, so the site cannot be generated
at `docker build` time. `.lagoon.yml` does it in two post-rollout tasks: seed a
blank database from the `cms` pod, then from the `web` pod wait for the CMS,
build the site and move it into `apps/web/dist` (the persistent volume). Lagoon
only runs those tasks once every pod is ready, and ready means port 3000
accepts connections, so the `web` container cannot wait for the build before
listening: `lagoon/web-entrypoint.mjs` answers 503 until the build lands, then
hands the port to Astro's server. A pod restarting on a filled volume starts
Astro directly. Static pages refresh as soon as they are moved into place; the
preview server's own bundle only on the next pod start.

Two traits of the Lagoon node images shape those files: they ship neither
`bash` nor `curl` (tasks use `sh` and a node script for the waits), and the
container runs as an arbitrary uid in group 0, so the Dockerfiles run
`fix-permissions` on the tree or the build fails with `EACCES`.

**Schema.** Development pushes it on the fly. Production runs the migrations in
`apps/cms/src/migrations` when Payload initialises (`prodMigrations` in the
config), in the server and in the seed alike. After changing a collection:

```bash
pnpm --filter cms payload migrate:create <name>   # needs pnpm dev running
```

and commit the result. The initial migration includes the AI plugin's table,
generated with the token set.

**Variables.** URLs need none: the CMS reads its own origin and the site's from
`LAGOON_ROUTES` (`apps/cms/src/lib/lagoonRoutes.ts`), the site does the same
(`apps/web/src/site.ts`), and the database URI is rebuilt from what the
`postgres` service injects (`apps/cms/src/lib/databaseUri.ts`). Custom domains
break the `cms.`/`web.` hostname convention: put the site first under
`environments.<name>.routes` and set `NEXT_PUBLIC_SERVER_URL` and `SITE_URL` as
environment variables.

The rest is set once, as **project** variables with the `runtime` scope, so any
new environment inherits them:

| Variable | Value |
|---|---|
| `PAYLOAD_SECRET`, `PREVIEW_SECRET` | `openssl rand -hex 32` |
| `PREVIEW_API_KEY` | a UUID; the seed gives it to the preview user |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | administrator created on first install |
| `PAYLOAD_GRAPHQL_URL` | `http://cms:3000/api/graphql`, the internal service name |
| `AMAZEE_AI_API_TOKEN`, `AMAZEE_AI_BASE_URL` | see the AI section |

```bash
lagoon add variable -p payload-astro -N PAYLOAD_SECRET -V "$(openssl rand -hex 32)" -S runtime
lagoon list project-variables -p payload-astro
```

Known limits: media uploads land on the `cms` pod's filesystem and do not
survive a restart; the `postgres` meta type gives a single pod without a DBaaS
operator, with no backup beyond Lagoon's own.

## Out of scope

- Payload media persistence in production (dedicated volume or S3).
- Syntax highlighting worthy of the name — `CodeBlock` renders
  `<pre><code class="language-…">` and stops there.
- Search, SEO plugin, CI pipeline.
- AI beyond the editor assistant — alt text, embeddings on the amazee.ai
  pgvector database, semantic search. The survey in
  `docs/feasibility-preview-ai.md` lists the candidates.
