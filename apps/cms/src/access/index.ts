import type { Access } from 'payload'

/**
 * Payload denies everything to unauthenticated visitors by default. The Astro
 * build queries GraphQL without a session, so reads have to be opened up — but
 * only over published content.
 */
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)
