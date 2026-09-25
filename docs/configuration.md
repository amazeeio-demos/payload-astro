# Configuration

## Environment variables

One `.env` at the repo root, read by both apps. See `.env.example`. The CMS
reads it once, at boot: restart `pnpm dev` after changing a variable.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URI` | CMS | PostgreSQL connection string. Locally, the container from `docker-compose.dev.yml`. |
| `PAYLOAD_SECRET` | CMS | Signs the admin session. |
| `NEXT_PUBLIC_SERVER_URL` | CMS, web | Public origin of the CMS. Required in production: without it Payload's CSRF list is wrong and the admin panel rejects its own writes. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed | Administrator created by `pnpm seed`. |
| `PREVIEW_URL` | CMS | Origin of the Astro site. Added to the CORS/CSRF allowlists and used to build the preview URL. |
| `PREVIEW_SECRET` | CMS, web | Guards `/preview/*`. Any long random string. |
| `PREVIEW_API_KEY` | seed, web | API key of the preview user. Server-side only, never exposed to the browser. |
| `PAYLOAD_GRAPHQL_URL` | web | Payload's GraphQL endpoint. |
| `SITE_URL` | web | Public URL of the site. |
| `CMS_URL` | web | Public URL of the admin, linked from the home page. Falls back to `NEXT_PUBLIC_SERVER_URL`. |
| `DOCS_ENTRY_SLUG` | web | Page the home page links to (default `introduction`). |
| `PAYLOAD_ALLOW_EMPTY` | web | Allows a build with nothing published. |
| `AMAZEE_AI_API_TOKEN` | CMS | amazee.ai key. If unset, the AI assistant is disabled entirely. |
| `AMAZEE_AI_BASE_URL` | CMS | Gateway of the key's region, `https://llm.<region>.amazee.ai/v1`. Default `de-eu101`. |
| `AMAZEE_AI_MODELS` | CMS | Default model for new fields, and the picker's fallback when the gateway is unreachable. Default `chat,chat_with_complex_json`. |

## Commands

```bash
pnpm dev                 # PostgreSQL (Docker), seed if empty, Payload :3000 + Astro :4321
pnpm seed                # idempotent demo content: admin, preview user, 2 categories, 6 pages en/fr
pnpm build               # cms then web
pnpm build:web           # rebuild the static site only
pnpm typecheck           # every package
pnpm generate:types      # apps/cms/src/payload-types.ts
pnpm generate:graphql    # packages/graphql/src/generated (committed)
pnpm --filter cms generate:importmap   # after adding an admin component
```

`pnpm dev` starts PostgreSQL detached, waits for its healthcheck and runs
`pnpm seed --if-empty` before starting the apps. Astro reads the content once,
at startup, and an empty CMS stops it on purpose (see `PAYLOAD_ALLOW_EMPTY`), so
the content has to exist first. The seed leaves a database that already has
users alone; run `pnpm seed` to restore missing demo pages.

`build`, `typecheck`, `generate:types` and `generate:graphql` query the CMS, so
they need `pnpm dev` running (or at least PostgreSQL and Payload).

## Coding agents and `astro dev`

Astro 7 detects coding-agent environments (Claude Code, Cursor, …) and starts
`astro dev` there as a detached background process. Under `concurrently` the
`web` pane then exits immediately and an orphaned server keeps port 4321.
`pnpm --filter web exec astro dev stop` releases it. In a normal terminal,
`astro dev` behaves as usual.
