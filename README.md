# astro-payload-lagoon

Proof of concept: a developer documentation site with content managed in
**Payload CMS**, rendered statically by **Astro / Starlight**, deployed on
**Lagoon** (amazee.io).

Content travels over **GraphQL**. Local development needs neither Docker nor an
installed MongoDB.

```
apps/cms                   Payload 3 on Next.js — admin, API, GraphQL
apps/web                   Astro 7 + Starlight — static site
packages/payload-loader    Content Layer loader and sidebar, both over GraphQL
packages/mongo-dev         Local MongoDB (single-node replica set, no Docker)
lagoon/                    Deployment Dockerfiles
docker-compose.yml         Lagoon service manifest (not for local use)
.lagoon.yml                Routes and post-rollout tasks
```

## Getting started

```bash
cp .env.example .env
pnpm install          # downloads a mongod binary on first run
pnpm dev              # MongoDB + Payload (:3000) + Astro (:4321)
```

In another terminal, once:

```bash
pnpm seed             # admin user, 2 categories, 6 pages in en/fr
```

- Admin panel: <http://localhost:3000/admin>
- Site: <http://localhost:4321>

Admin credentials come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in
`.env`.

The site is static: after editing in the admin panel, restart `astro dev` or run
`pnpm build:web` to see the change.

> Astro 7 detects coding-agent environments (Claude Code, Cursor, …) and starts
> `astro dev` there as a detached background process. Under `concurrently` the
> `web` pane then exits immediately and an orphaned server keeps port 4321.
> `pnpm --filter web exec astro dev stop` releases it. In a normal terminal the
> behaviour is the expected one.

`pnpm build` and `pnpm typecheck` query the CMS, so they need `pnpm dev` running
(or at least MongoDB and Payload).

## How content reaches Astro

Page bodies are Lexical rich text. A **virtual** `markdown` field converts them
on read (`apps/cms/src/fields/markdown.ts`) and exposes the result over GraphQL —
nothing is stored twice.

On the Astro side, `payloadDocsLoader` queries that field and hands the Markdown
to `renderMarkdown()`, Astro's own pipeline. Starlight therefore gets heading
anchors, a table of contents and Expressive Code syntax highlighting without any
of it being reimplemented.

Two details Starlight does not document, both commented in
`packages/payload-loader/src/loader.ts`:

- the loader must go through `parseData()`, otherwise the schema's `draft: false`
  default is never applied and Starlight discards every entry in production;
- Starlight assumes a file-based loader and dereferences `entry.filePath!`, so we
  supply a synthetic path.

The Lexical editor has no built-in code block. We enable `CodeBlock`, the block
Payload ships, with a language list restricted to identifiers Shiki recognises
(`bash` rather than `shell` — see `apps/cms/src/payload.config.ts`).

## i18n

Locales are declared twice and must stay in sync: `localization` in
`apps/cms/src/payload.config.ts`, and `LOCALES` in `apps/web/src/site.ts`.

English is served at the root, French under `/fr/`. An untranslated page falls
back to English instead of disappearing — Starlight's native behaviour.

## Deploying to Lagoon

Three services: `cms` (`node`), `web` (`node-persistent`) and `mongodb`.

Lagoon builds images **before** deploying them: at `docker build` time the CMS is
unreachable, so the static site cannot be generated there. It is generated after
the rollout instead, by the `post-rollout` tasks in `.lagoon.yml`, once the `cms`
service answers on its internal name. The output lands in `/app/dist`, a
persistent volume — hence `node-persistent` rather than `nginx`: Lagoon has no
`nginx-persistent` service type.

Before the first deployment:

1. Replace `docs.example.com` with the real domains in `.lagoon.yml`.
2. Set the project's environment variables (they do not belong in the repo):

   ```bash
   lagoon add variable -p <project> -e main -N PAYLOAD_SECRET   -V "<secret>" -S runtime
   lagoon add variable -p <project> -e main -N SEED_ADMIN_EMAIL -V "..."      -S runtime
   ```

3. Check the variables injected by the MongoDB service:

   ```bash
   lagoon get environment-variables -p <project> -e main
   ```

   All the uncertainty about their names is isolated in
   `apps/cms/src/lib/mongoUri.ts`: if the cluster uses different ones, that file
   is the only thing to change.

On a fresh production environment the seed is deliberately skipped, so nothing is
published and the loader fails the build rather than shipping an empty site. For
that very first deployment either publish a page from the admin panel and
redeploy, or set `PAYLOAD_ALLOW_EMPTY=true` for the initial build.

Publishing content does not rebuild the site on its own: trigger a redeploy, or
wire a Payload `afterChange` hook to the Lagoon API.

## Out of scope

- Payload media persistence in production (dedicated volume or S3).
- Draft preview from Astro.
- CI pipeline.
