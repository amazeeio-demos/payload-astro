import type { GenerationModel, SeedPromptFunction } from '@ai-stack/payloadcms/types'
import type { Plugin } from 'payload'

import { payloadAiPlugin } from '@ai-stack/payloadcms'

import { fallbackModels, gatewayBaseURL, modelsEndpoint } from './models'

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

export const amazeeAiEnabled = Boolean(process.env.AMAZEE_AI_API_TOKEN)

/**
 * The plugin ships its OpenAI text models with a hard-coded select of GPT ids.
 * The handler itself is generic — it sends whatever the "Model" field holds —
 * so that field is the only thing to replace: a text field rendered by
 * `ModelSelect`, which asks the gateway for its models (see ./models.ts). The
 * generation path stays the plugin's own.
 */
function withGatewayModels(model: GenerationModel, defaultModel: string): GenerationModel {
  if (!model.settings) return model

  return {
    ...model,
    name: model.name.replace(/^OpenAI GPT( Text)?$/, 'amazee.ai$1'),
    settings: {
      ...model.settings,
      label: 'amazee.ai settings',
      fields: model.settings.fields.map((field) =>
        field.type === 'select' && field.name === 'model'
          ? {
              name: 'model',
              type: 'text' as const,
              label: 'Model',
              defaultValue: defaultModel,
              admin: { components: { Field: '/ai/ModelSelect#ModelSelect' } },
            }
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

export const amazeeAiPlugin = (): Plugin => async (config) => {
  const [defaultModel] = fallbackModels()

  // The Translate menu lists every locale tag by default; the site only has
  // the ones declared in `localization`.
  const locales = config.localization
    ? config.localization.locales.map((locale) => (typeof locale === 'string' ? locale : locale.code))
    : []

  const plugin = payloadAiPlugin({
    collections: { docs: true },
    options: { enabledLanguages: locales },
    providers: {
      openai: {
        apiKey: process.env.AMAZEE_AI_API_TOKEN,
        baseURL: gatewayBaseURL(),
      },
    },
    // Text only: the gateway serves no DALL-E or TTS, and the plugin would
    // otherwise list them for upload fields.
    generationModels: (defaults) =>
      defaults
        .filter((model) => model.output === 'text' && model.id.startsWith('Oai-'))
        .map((model) => withGatewayModels(model, defaultModel)),
    seedPrompts,
    // Anyone logged into the admin may generate; tighten with a role check when
    // roles exist (see docs/roles-and-access-control.md).
    access: {
      generate: ({ req }) => Boolean(req.user),
      settings: ({ req }) => Boolean(req.user),
    },
  })

  const withAi = await plugin(config)
  return { ...withAi, endpoints: [...(withAi.endpoints ?? []), modelsEndpoint] }
}
