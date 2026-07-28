import type { Access } from 'payload'

/**
 * Payload interdit tout par défaut aux visiteurs non authentifiés. Le build
 * Astro interroge GraphQL sans session : il faut donc ouvrir la lecture — mais
 * uniquement sur le contenu publié.
 */
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)
