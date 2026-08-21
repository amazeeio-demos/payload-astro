import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // API keys, on top of the usual email/password login: the Astro preview route
  // reads drafts server-side with the key of the `preview@` user created by the
  // seed, without holding a session.
  auth: {
    useAPIKey: true,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
