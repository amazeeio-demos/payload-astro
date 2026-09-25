# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proof of concept: Payload CMS content, rendered statically by Astro, with an instant live preview of drafts and an AI writing assistant behind the amazee.ai gateway. Target host is Lagoon. `docs/` is the reference for how each mechanism works (`architecture.md`, `live-preview.md`, `ai-assistant.md`, `configuration.md`, `lagoon.md`) and is kept current; read the relevant file there before changing one of those areas rather than re-deriving it from the code.

## Commands

pnpm workspace: `apps/cms` (Payload 3 on Next 16), `apps/web` (Astro 7), `packages/{ui,graphql,payload-loader}` shipped as TypeScript sources.

```bash
pnpm dev                 # PostgreSQL (Docker), seed --if-empty, Payload :3000 + Astro :4321
pnpm seed                # idempotent demo content (restores missing pages)
pnpm typecheck           # every package (tsc / astro check)
pnpm build               # cms then web
pnpm generate:types      # apps/cms/src/payload-types.ts
pnpm generate:graphql    # packages/graphql/src/generated (committed)
pnpm --filter cms generate:importmap
pnpm --filter cms typecheck   # one package
```

`build`, `typecheck`, `generate:types` and `generate:graphql` query the running CMS; start `pnpm dev` first. There are no tests.

The CMS reads the single root `.env` once, at boot (`apps/cms/src/lib/env.ts`). Changing a variable means restarting `pnpm dev`; hot reload re-evaluates the config but not the environment, and `onInit` hooks (the AI prompt seeding) run only on a cold boot.

In a coding-agent environment Astro 7 starts `astro dev` detached, so the `web` pane exits and an orphan holds :4321. `pnpm --filter web exec astro dev stop` releases it.

## Architecture in one pass

- **Contract = GraphQL, not Payload types.** `packages/graphql/src/documents.ts` holds the queries; `pnpm generate:graphql` types them against the live schema into `src/generated`, which is committed. Those generated types, not `payload-types.ts`, are what `packages/ui` and the loader consume. Adding a field to the frontend means editing a document and regenerating.
- **No `@payloadcms/*` in the frontend.** `packages/ui/src/RichText.tsx` is a hand-written serializer of Lexical JSON (`packages/ui/src/lexical/types.ts` describes the wire shape). Blocks live in `packages/ui/src/blocks`. Pulling `@payloadcms/richtext-lexical` into `apps/web` would drag the whole CMS in; the one exception is `@payloadcms/live-preview-react`, a pure client SDK.
- **Hybrid Astro.** `output: 'static'` plus the node adapter. Everything is prerendered from the build-time snapshot (`@repo/payload-loader`, one entry per locale and slug) except `apps/web/src/pages/preview/[locale]/[slug].astro`, which sets `prerender = false`, checks `PREVIEW_SECRET`, reads drafts with the preview user's API key, and hydrates `PreviewIsland` with `useLivePreview`. Public pages render `DocPage` with no client directive: zero JS. Both paths use the same `DocPage`; that shared component is what makes the preview trustworthy.
- **Locales are declared twice on purpose**: `localization` in `apps/cms/src/payload.config.ts` and `LOCALES` in `apps/web/src/site.ts`. The latter is typed from the generated schema, so a mismatch is a type error. English at the root, French under `/fr/`; `apps/web/src/routes.ts` is the only file that knows the scheme.
- **AI assistant** is `@ai-stack/payloadcms` pointed at the amazee.ai gateway (a LiteLLM proxy, OpenAI-compatible). Everything specific lives in `apps/cms/src/ai/`: `amazeeAi.ts` configures the plugin (text models only, static seed prompts so boot makes no network call, `AMAZEE_AI_*` variables rather than the plugin's `OPENAI_*`), `models.ts` proxies the gateway's `/model/info` for the picker, `ModelSelect.tsx` is that picker. The plugin and the Lexical AI feature are registered only when `AMAZEE_AI_API_TOKEN` is set, so the CMS runs unchanged without it. Prompts are seeded into the `plugin-ai-instructions` collection on first boot and edited in the admin afterwards, so a prompt change in code does not reach an existing database.
- `apps/cms/src/app/(payload)/admin/importMap.js` is generated and committed; regenerate it after adding any admin component path.

## Conventions

- English everywhere. Comments explain *why*, at the length that needs; existing files set the tone.
- Conventional commits, one line, no scope (`feat: …`, `docs: …`), as in `git log`.
- `README.md` stays a short local quickstart (with the amazee.ai gateway); details go in `docs/*.md`, one file per mechanism, linked from its "Go further" table. `HANDOFF.md` lists decisions already taken; reopen one only with a reason.
- Deployment: `docker-compose.yml` and `lagoon/` are for Lagoon only, never run locally. Images are built before the CMS exists, so `next build` runs with placeholder env and the site is built post-rollout (`.lagoon.yml`), while `lagoon/web-entrypoint.mjs` keeps port 3000 answering 503 until then. The Lagoon node images have no `bash`, no `curl`, and run as a non-root uid in group 0 (hence `sh`, the node wait script and `fix-permissions`). Production URLs come from `LAGOON_ROUTES`, the schema from `apps/cms/src/migrations` via `prodMigrations`: a collection change needs `payload migrate:create` and a committed migration, or production boots against a stale schema.
