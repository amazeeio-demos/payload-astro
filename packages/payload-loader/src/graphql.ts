/** Minimal GraphQL client — native `fetch`, no dependencies. */

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
      `Payload unreachable at ${endpoint}: ${(cause as Error).message}`,
      endpoint,
    )
  }

  if (!response.ok) {
    throw new PayloadGraphQLError(
      `Payload answered ${response.status} ${response.statusText}`,
      endpoint,
    )
  }

  const body = (await response.json()) as GraphQLResponse<T>

  if (body.errors?.length) {
    throw new PayloadGraphQLError(
      `GraphQL errors: ${body.errors.map((e) => e.message).join(' | ')}`,
      endpoint,
    )
  }

  if (!body.data) {
    throw new PayloadGraphQLError('GraphQL response carried no data', endpoint)
  }

  return body.data
}
