/**
 * Minimal GraphQL client — native `fetch`, no dependency.
 *
 * Documents come from `./documents`, where codegen has paired each query with
 * its result and variable types; `TypedDocumentString` carries that pairing at
 * the type level while staying a plain string at runtime, so nothing of the
 * `graphql` package ends up in the Astro build.
 */
import type { TypedDocumentString } from './generated/graphql'

export interface GraphQLError {
  message: string
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

export class PayloadGraphQLError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
  ) {
    super(message)
    this.name = 'PayloadGraphQLError'
  }
}

export interface GraphQLRequestOptions {
  /**
   * Extra headers, typically `Authorization: users API-Key …` to read drafts.
   * Server-side only: this must never run in the browser.
   */
  headers?: Record<string, string>
}

export async function graphqlRequest<TResult, TVariables>(
  endpoint: string,
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
  options: GraphQLRequestOptions = {},
): Promise<TResult> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify({ query: document.toString(), variables }),
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

  const body = (await response.json()) as GraphQLResponse<TResult>

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
