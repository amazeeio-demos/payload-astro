/** Client GraphQL minimal — `fetch` natif, aucune dépendance. */

export interface GraphQLError {
  message: string
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

export class PayloadGraphQLError extends Error {
  constructor(message: string, readonly endpoint: string) {
    super(message)
    this.name = 'PayloadGraphQLError'
  }
}

export async function graphqlRequest<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch (cause) {
    throw new PayloadGraphQLError(
      `Payload injoignable sur ${endpoint} : ${(cause as Error).message}`,
      endpoint,
    )
  }

  if (!response.ok) {
    throw new PayloadGraphQLError(
      `Payload a répondu ${response.status} ${response.statusText}`,
      endpoint,
    )
  }

  const body = (await response.json()) as GraphQLResponse<T>

  if (body.errors?.length) {
    throw new PayloadGraphQLError(
      `Erreurs GraphQL : ${body.errors.map((e) => e.message).join(' | ')}`,
      endpoint,
    )
  }

  if (!body.data) {
    throw new PayloadGraphQLError('Réponse GraphQL sans données', endpoint)
  }

  return body.data
}
