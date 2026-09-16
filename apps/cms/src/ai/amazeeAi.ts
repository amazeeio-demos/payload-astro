import type { GenerationModel, SeedPromptFunction } from '@ai-stack/payloadcms/types'
import type { Plugin } from 'payload'

import { payloadAiPlugin } from '@ai-stack/payloadcms'

/**
 * amazee.ai private gateway behind the Payload AI plugin.
 *
 * The gateway is a LiteLLM proxy, so it speaks the OpenAI protocol: the plugin
 * only needs a base URL and a bearer token, both read here from `AMAZEE_AI_*`
 * variables rather than the `OPENAI_*` ones the plugin would pick up on its own.
 * Keeping the names distinct makes it impossible to hit api.openai.com by
 * accident with a token meant for the private gateway.
 *
 * Everything is a no-op when `AMAZEE_AI_API_TOKEN` is missing: the plugin is not
 * registered and the editor gets no AI menu, so the CMS runs unchanged.
 */

/** Region-bound endpoint. The token only works against the region it was created in. */
const DEFAULT_BASE_URL = 'https://llm.de-eu101.amazee.ai/v1'

/**
 * Generic aliases every amazee.ai region resolves to a concrete model, so the
 * default configuration works whatever the region. Explicit ids
 * (`claude-5-sonnet`, `gpt-4.1`, `mistral-large-latest`, …) can be listed in
 * `AMAZEE_AI_MODELS`; `GET /v1/models` on the gateway returns what a token may use.
 */
const DEFAULT_MODELS = ['chat', 'chat_with_complex_json']

export const amazeeAiEnabled = Boolean(process.env.AMAZEE_AI_API_TOKEN)

function resolveModels(): string[] {
  const configured = (process.env.AMAZEE_AI_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : DEFAULT_MODELS
}

/**
 * The plugin ships its OpenAI text models with a hard-coded list of GPT ids.
 * The handler itself is generic — it sends whatever the "Model" select holds —
 * so swapping the options of that select is enough to drive the gateway's own
 * model names through the plugin's unmodified generation path.
 */
function withGatewayModels(model: GenerationModel, models: string[]): GenerationModel {
  if (!model.settings) return model

  return {
    ...model,
    name: model.name.replace(/^OpenAI GPT( Text)?$/, 'amazee.ai$1'),
    settings: {
      ...model.settings,
      label: 'amazee.ai settings',
      fields: model.settings.fields.map((field) =>
        field.type === 'select' && field.name === 'model'
          ? { ...field, defaultValue: models[0], options: models }
          : field,
      ),
    },
  }
}

/**
 * Static prompts for the `docs` fields. The plugin's default behaviour is to ask
 * the model to write these prompts at boot, one request per field, against
 * `gpt-4o-mini` — an id the gateway may not serve. Returning the text directly
 * keeps start-up free of network calls; `false` leaves a field without AI menu.
 *
 * `{{ title }}`-style placeholders are filled from the document being edited;
 * `toHTML` renders a rich text field as HTML (the plugin declares a `toText` helper but never registers it).
 */
const seedPrompts: SeedPromptFunction = ({ path }) => {
  switch (path) {
    case 'docs.title':
      return {
        data: {
          prompt:
            'Write a short, descriptive title for a developer documentation page. ' +
            'Its summary is: {{ description }}',
        },
      }
    case 'docs.description':
      return {
        data: {
          prompt:
            'Write a one-sentence meta description, 160 characters at most, for the ' +
            'developer documentation page titled "{{ title }}". Its content: {{ toHTML body }}',
        },
      }
    case 'docs.sidebarLabel':
      return {
        data: {
          prompt: 'Write a sidebar label of at most three words for the page titled "{{ title }}".',
        },
      }
    case 'docs.body':
      return {
        data: {
          prompt:
            'Write a developer documentation page titled "{{ title }}". Summary: {{ description }}. ' +
            'Use headings, short paragraphs, lists and code blocks where they help.',
        },
      }
    default:
      // Anything else (slug, fields added later) gets no AI menu until a prompt
      // is written here, rather than a model-authored one at start-up.
      return false
  }
}

export const amazeeAiPlugin = (): Plugin => {
  const models = resolveModels()

  return payloadAiPlugin({
    collections: { docs: true },
    providers: {
      openai: {
        apiKey: process.env.AMAZEE_AI_API_TOKEN,
        baseURL: process.env.AMAZEE_AI_BASE_URL ?? DEFAULT_BASE_URL,
      },
    },
    // Text only: the gateway serves no DALL-E or TTS, and the plugin would
    // otherwise list them for upload fields.
    generationModels: (defaults) =>
      defaults
        .filter((model) => model.output === 'text' && model.id.startsWith('Oai-'))
        .map((model) => withGatewayModels(model, models)),
    seedPrompts,
    // Anyone logged into the admin may generate; tighten with a role check when
    // roles exist (see docs/roles-and-access-control.md).
    access: {
      generate: ({ req }) => Boolean(req.user),
      settings: ({ req }) => Boolean(req.user),
    },
  })
}
