import type { Endpoint } from 'payload'

/**
 * Which models the editor may pick, asked to the gateway itself.
 *
 * LiteLLM's `/model/info` lists every model the token may use, each with a
 * `mode` (`chat`, `embedding`, `image_generation`, …). Only `chat` models are
 * offered: the plugin's text and rich text generation needs nothing else.
 *
 * The list is cached in memory for a while and, when the gateway cannot be
 * reached, replaced by `AMAZEE_AI_MODELS` so the settings UI keeps working.
 */

export const MODELS_ENDPOINT_PATH = '/amazee-ai/models'

/** Region-bound endpoint. The token only works against the region it was created in. */
export const gatewayBaseURL = (): string =>
  process.env.AMAZEE_AI_BASE_URL ?? 'https://llm.de-eu101.amazee.ai/v1'

/** Aliases every amazee.ai region resolves, whatever the plan. */
const DEFAULT_MODELS = ['chat', 'chat_with_complex_json']

const CACHE_TTL_MS = 10 * 60 * 1000

export type GatewayModel = { id: string; provider?: string }

export type ModelsResponse = {
  models: GatewayModel[]
  /** `gateway` when the list is live, `fallback` when it comes from the env. */
  source: 'fallback' | 'gateway'
  error?: string
}

/** `AMAZEE_AI_MODELS`, or the region-agnostic aliases. Default for new fields, fallback for the picker. */
export function fallbackModels(): string[] {
  const configured = (process.env.AMAZEE_AI_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : DEFAULT_MODELS
}

type ModelInfoEntry = {
  model_name?: string
  model_info?: { mode?: string; litellm_provider?: string }
}

let cache: { expires: number; models: GatewayModel[] } | null = null

async function fetchChatModels(): Promise<GatewayModel[]> {
  if (cache && cache.expires > Date.now()) return cache.models

  // `/model/info` lives next to `/v1`, not under it.
  const infoURL = new URL('model/info', gatewayBaseURL().replace(/\/v1\/?$/, '/'))

  const response = await fetch(infoURL, {
    headers: { Authorization: `Bearer ${process.env.AMAZEE_AI_API_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`gateway answered ${response.status}`)

  const body = (await response.json()) as { data?: ModelInfoEntry[] }
  const models = (body.data ?? [])
    .filter((entry) => entry.model_info?.mode === 'chat' && entry.model_name)
    .map((entry) => ({ id: entry.model_name as string, provider: entry.model_info?.litellm_provider }))
    .sort((a, b) => a.id.localeCompare(b.id))

  if (models.length === 0) throw new Error('gateway listed no chat model')

  cache = { expires: Date.now() + CACHE_TTL_MS, models }
  return models
}

export async function listModels(): Promise<ModelsResponse> {
  try {
    return { models: await fetchChatModels(), source: 'gateway' }
  } catch (error) {
    return {
      models: fallbackModels().map((id) => ({ id })),
      source: 'fallback',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** `GET /api/amazee-ai/models`, for the model picker in the Compose Settings. */
export const modelsEndpoint: Endpoint = {
  path: MODELS_ENDPOINT_PATH,
  method: 'get',
  handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json(await listModels())
  },
}
