# Payload + Astro with amazee.ai

A developer documentation site: content in **Payload CMS**, rendered statically
by **Astro**, with an instant live preview of drafts and an AI writing assistant
(Compose, Proofread, Translate, Rephrase) running through the
[amazee.ai private gateway](https://docs.amazee.ai).

## Requirements

- Node ≥ 22 and pnpm
- Docker (local PostgreSQL only)
- An amazee.ai API key from <https://my.amazee.io> (optional: without it the
  site and CMS run, minus the assistant)

## Run it

```bash
cp .env.example .env   # set AMAZEE_AI_API_TOKEN
                       # + AMAZEE_AI_BASE_URL if your region is not de-eu101
pnpm install
pnpm dev               # PostgreSQL, demo content on first run,
                       # Payload (:3000) + Astro (:4321)
```

- Admin: <http://localhost:3000/admin>, credentials from `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` in `.env`
- Site: <http://localhost:4321>

The other defaults in `.env.example` work as they are for local use.

The key is bound to the region it was created in. The gateway URL is
`https://llm.<region>.amazee.ai/v1` (`de-eu101`, `ch103`, `us103`, `uk103`,
`au103`). To check the key and see which models it can use:

```bash
curl -H "Authorization: Bearer $AMAZEE_AI_API_TOKEN" \
  https://llm.de-eu101.amazee.ai/v1/models
```

## Try it

1. Open a doc page in the admin panel. The **Live Preview** panel updates as you
   type, without saving.
2. Click into a field. An AI bar appears under it: *Compose* when the field is
   empty, *Rephrase*, *Proofread* and *Translate* once it has content.
3. *Settings* in that bar lets you choose the prompt, model and temperature for
   that field. The model list comes from the gateway.

Public pages are static: restart `pnpm dev` (or run `pnpm build:web`) to see
saved changes there.

## Go further

| | |
|---|---|
| [Architecture](docs/architecture.md) | Repository layout, how content reaches Astro, rendering, i18n |
| [Live preview](docs/live-preview.md) | How drafts reach the iframe, and what breaks it |
| [AI assistant](docs/ai-assistant.md) | How the plugin is wired to the gateway, models, prompts, limits |
| [Configuration](docs/configuration.md) | Every environment variable, development commands |
| [Deploying to Lagoon](docs/lagoon.md) | Services, post-rollout build, migrations, variables |
