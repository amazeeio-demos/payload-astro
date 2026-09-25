# AI assistant (amazee.ai)

Doc pages get an assistant in the admin panel: **Compose**, **Proofread**,
**Translate** and **Rephrase** in the `body` editor, and a *Compose* action
under `title`, `description` and `sidebarLabel`. The model runs behind the
[amazee.ai private gateway](https://docs.amazee.ai), never at a public
provider.

The feature is optional and off by default: without `AMAZEE_AI_API_TOKEN`
neither the plugin nor the editor menu is registered.

## First boot

With the token set, the first boot of the CMS creates one *Compose Setting* per
field (`docs.title`, `docs.description`, `docs.sidebarLabel`, `docs.body`) with
the prompts from `apps/cms/src/ai/amazeeAi.ts`, and a `plugin-ai-instructions`
table appears in PostgreSQL. Prompts are edited in the admin after that, so a
prompt change in code does not reach an existing database.

The CMS reads `.env` once, at boot: changing the token or the base URL needs a
restart of `pnpm dev`.

## Per-field settings

The *Settings* entry of the AI bar opens the field's Compose Setting: prompt,
model, temperature, max tokens.

- **Models.** The picker asks `/api/amazee-ai/models`, which proxies LiteLLM's
  `/model/info` with the token, keeps the `chat` models, and caches the list
  for ten minutes. When the gateway cannot be reached, the picker falls back to
  `AMAZEE_AI_MODELS`. New fields start on the first entry of that variable, by
  default `chat`, an alias every region resolves. Explicit ids
  (`claude-5-sonnet`, `gpt-4.1`, `mistral-large-latest`, …) depend on region
  and plan. A model that later disappears from the gateway stays selectable,
  flagged as not listed.
- **Prompts** are Handlebars templates over the document being edited:
  `{{ title }}`, `{{ description }}`, `{{ toHTML body }}` (HTML of the rich
  text field, as the plugin has no working plain-text helper).

## How it is wired

`@ai-stack/payloadcms` ([payload-ai](https://github.com/ashbuilds/payload-ai))
is a community plugin. Payload's core ships no LLM client, only an MCP server
that exposes the CMS to agents. The plugin drives the Vercel AI SDK, and its
OpenAI provider accepts a custom base URL. The amazee.ai gateway is a LiteLLM
proxy, so the OpenAI protocol is all it needs. Everything specific lives in
`apps/cms/src/ai/`:

- `amazeeAi.ts` reads `AMAZEE_AI_API_TOKEN` and `AMAZEE_AI_BASE_URL` into the
  plugin's `openai` provider. It deliberately avoids the `OPENAI_*` names the
  plugin reads by default, so the private token can never reach api.openai.com.
- It keeps only text models (the gateway serves no image or speech endpoints)
  and replaces the plugin's hard-coded GPT model select with `ModelSelect.tsx`,
  a text field whose options come from the gateway (`models.ts`).
- It seeds static prompts. Otherwise the plugin would ask a model to *write*
  each field's prompt at boot, one request per field, against `gpt-4o-mini`.
- It restricts generation to logged-in users.

## Known limits

- Rich text generation asks the model for the whole Lexical JSON of the field,
  constrained by a JSON schema, and streams it over the OpenAI Responses API.
  Verified on `de-eu101` with `chat` and `claude-5-sonnet`. A small open-weight
  model may return invalid JSON.
- Translate offers the CMS locales only (`en`, `fr`) and does not create a
  locale version by itself: it rewrites the field in the locale you are
  editing.
